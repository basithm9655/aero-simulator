import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DEG = Math.PI / 180;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (min, max, value) => {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
};

// Verified GeoFS -> Three.js Aircraft Axes
export const AIRCRAFT_FORWARD_AXIS = new THREE.Vector3(0, 0, -1);
export const AIRCRAFT_UP_AXIS = new THREE.Vector3(0, 1, 0);
export const AIRCRAFT_RIGHT_AXIS = new THREE.Vector3(1, 0, 0);

// Pre-allocated math helpers outside render loop (zero GC)
const _vForward = new THREE.Vector3();
const _vHorizFwd = new THREE.Vector3();
const _vDesiredCam = new THREE.Vector3();
const _vDesiredTarget = new THREE.Vector3();
const _vUpOffset = new THREE.Vector3();
const _vTmp = new THREE.Vector3();

// Detect software WebGL (SwiftShader / llvmpipe) from GPU renderer string
function detectSoftwareWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch (_) {
    return false;
  }
}

export class Aircraft3D {
  constructor(container) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.currentModel = null;
    this.currentAircraftId = '';
    this.currentAircraftDef = null;
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.contextLost = false;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.5, 5000);
    this.camera.up.set(0, 1, 0);
    this.cameraMode = 'follow';
    this.currentFov = 65;

    // Model bounding dimensions (measured via Box3)
    this.modelDimensions = { wingspan: 10.56, length: 15.74, height: 4.78 };
    this.scaleRatio = 1.0;
    this.baseDistance = 22.0;
    this.baseHeight = 6.5;
    this.baseLookAhead = 18.0;
    this.baseTargetOffset = 3.5;
    this.minimumHeight = 3.5;
    this.currentDistance = 22.0;

    this.smoothedCameraPosition = new THREE.Vector3(0, 6.5, 22);
    this.smoothedTarget = new THREE.Vector3(0, 3.5, -18);
    this.camera.position.copy(this.smoothedCameraPosition);
    this.camera.lookAt(this.smoothedTarget);

    // Free Orbit Camera State
    this.freeOrbit = {
      yaw: 0,
      pitch: 15,
      distance: 26,
      isDragging: false,
      lastX: 0,
      lastY: 0
    };

    // Renderer with alpha transparency for seamless Google 3D / Cesium globe backdrop
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;

    const el = this.renderer.domElement;
    el.id = 'aircraft3dCanvas';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '5';
    this.container.appendChild(el);

    // WebGL context loss resilience
    el.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.contextLost = true;
    });
    el.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
    });

    // Studio IBL Environment Map for metallic PBR reflections
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.studioEnvMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.studioEnvMap;
      pmrem.dispose();
    } catch (_) {
      this.studioEnvMap = null;
    }

    // Balanced 3-Point Atmospheric Lighting Rig (dynamically shifts with time-of-day/weather)
    this.sunLight = new THREE.DirectionalLight(0xfff6e5, 2.7);
    this.sunLight.position.set(35, 65, -40);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 1.15);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 0.85);
    this.rimLight.position.set(-40, 18, 45);
    this.scene.add(this.rimLight);

    // Authentic GeoFS reflections & specular maps
    this.reflectionTexture = this.textureLoader.load('/textures/reflection.jpg');
    this.reflectionTexture.mapping = THREE.EquirectangularReflectionMapping;
    this.reflectionTexture.colorSpace = THREE.SRGBColorSpace;
    this.specularTexture = this.textureLoader.load('/textures/specular.jpg');

    // Root aircraft transform group
    this.aircraftGroup = new THREE.Group();
    this.aircraftGroup.rotation.order = 'YXZ';
    this.scene.add(this.aircraftGroup);

    // Subsystems
    this.initAfterburnerSystem();
    this.initMultiEnginePlumes();
    this.initLandingGear();
    this.initNavLights();
    this.initVortexTrails();
    this.initVaporCone();
    this.initTouchdownSmoke();

    // Crash explosion state
    this.explosionGroup = new THREE.Group();
    this.scene.add(this.explosionGroup);
    this.isExploding = false;
    this.explosionTime = 0;
    this.debrisObjects = [];
    this.fireballObjects = [];
    this.smokeObjects = [];
    this.shakeAmp = 0;

    this.initFreeOrbitEvents();
    window.addEventListener('resize', () => this.onResize());
  }

  // Dynamic Time-of-Day & Weather Lighting Rig
  setTimeOfDay(mode = 'day') {
    if (mode === 'sunset') {
      this.sunLight.color.setHex(0xff9e5e);
      this.sunLight.intensity = 3.1;
      this.sunLight.position.set(-55, 18, -35);
      this.hemiLight.color.setHex(0xfdba74);
      this.hemiLight.groundColor.setHex(0x1e293b);
      this.hemiLight.intensity = 1.05;
      this.rimLight.color.setHex(0xf43f5e);
      this.rimLight.intensity = 1.1;
      this.renderer.toneMappingExposure = 1.18;
    } else if (mode === 'night') {
      this.sunLight.color.setHex(0x93c5fd);
      this.sunLight.intensity = 0.85;
      this.sunLight.position.set(20, 50, -30);
      this.hemiLight.color.setHex(0x1e3a8a);
      this.hemiLight.groundColor.setHex(0x020617);
      this.hemiLight.intensity = 0.65;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 0.55;
      this.renderer.toneMappingExposure = 1.05;
    } else if (mode === 'storm') {
      this.sunLight.color.setHex(0xcbd5e1);
      this.sunLight.intensity = 1.45;
      this.sunLight.position.set(15, 55, -20);
      this.hemiLight.color.setHex(0x64748b);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.95;
      this.rimLight.color.setHex(0x94a3b8);
      this.rimLight.intensity = 0.7;
      this.renderer.toneMappingExposure = 1.1;
    } else {
      this.sunLight.color.setHex(0xfff6e5);
      this.sunLight.intensity = 2.7;
      this.sunLight.position.set(35, 65, -40);
      this.hemiLight.color.setHex(0x93c5fd);
      this.hemiLight.groundColor.setHex(0x334155);
      this.hemiLight.intensity = 1.15;
      this.rimLight.color.setHex(0xbae6fd);
      this.rimLight.intensity = 0.85;
      this.renderer.toneMappingExposure = 1.22;
    }
  }

  // Composite 3D Retractable Tricycle Landing Gear (Nose + Left/Right Main Bogies + Landing Beams)
  initLandingGear() {
    this.gearGroup = new THREE.Group();
    this.aircraftGroup.add(this.gearGroup);

    const strutMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.25 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.05, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.35 });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef9c3,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const buildLeg = (isTwinWheel = true) => {
      const leg = new THREE.Group();
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 1.55, 10), strutMat);
      strut.position.y = -0.78;
      leg.add(strut);

      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), strutMat);
      brace.position.set(0, -0.55, 0.32);
      brace.rotation.x = 0.52;
      leg.add(brace);

      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, isTwinWheel ? 0.75 : 0.35, 8), hubMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.y = -1.52;
      leg.add(axle);

      const wheelOffsets = isTwinWheel ? [-0.30, 0.30] : [0];
      wheelOffsets.forEach(wx => {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 14), tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(wx, -1.52, 0);
        leg.add(tire);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 10), hubMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, -1.52, 0);
        leg.add(hub);
      });
      return leg;
    };

    this.noseGear = buildLeg(true);
    this.leftGear = buildLeg(true);
    this.rightGear = buildLeg(true);

    // Forward Volumetric Landing Light Beam attached to nose strut
    const beamGeo = new THREE.ConeGeometry(1.4, 14, 14, 1, true);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, -7.2);
    this.landingBeam = new THREE.Mesh(beamGeo, beamMat);
    this.landingBeam.position.set(0, -0.9, -0.2);
    this.noseGear.add(this.landingBeam);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bulb.position.set(0, -0.9, -0.18);
    this.noseGear.add(bulb);

    this.gearGroup.add(this.noseGear, this.leftGear, this.rightGear);
  }

  // Supersonic Afterburner Jet Flame System (F-16)
  initAfterburnerSystem() {
    this.afterburnerGroup = new THREE.Group();
    this.aircraftGroup.add(this.afterburnerGroup);

    const innerGeo = new THREE.ConeGeometry(0.50, 6.8, 16, 1, true);
    innerGeo.rotateX(Math.PI / 2);
    innerGeo.translate(0, 0, 3.4);
    this.innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.innerFlameMesh = new THREE.Mesh(innerGeo, this.innerFlameMat);
    this.afterburnerGroup.add(this.innerFlameMesh);

    const outerGeo = new THREE.ConeGeometry(0.82, 10.6, 16, 1, true);
    outerGeo.rotateX(Math.PI / 2);
    outerGeo.translate(0, 0, 5.3);
    this.outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.outerFlameMesh = new THREE.Mesh(outerGeo, this.outerFlameMat);
    this.afterburnerGroup.add(this.outerFlameMesh);

    this.machDiamonds = [];
    const diamondGeo = new THREE.OctahedronGeometry(0.34, 0);
    diamondGeo.scale(1.0, 0.9, 2.2);
    this.diamondMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    [1.2, 2.6, 4.0, 5.4, 6.8].forEach(z => {
      const mesh = new THREE.Mesh(diamondGeo, this.diamondMat);
      mesh.position.set(0, 0, z);
      this.afterburnerGroup.add(mesh);
      this.machDiamonds.push({ mesh, baseZ: z });
    });

    const ringGeo = new THREE.TorusGeometry(0.60, 0.08, 8, 24);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMat);
    this.ringMesh.position.set(0, 0, 0.05);
    this.afterburnerGroup.add(this.ringMesh);

    this.afterburnerLight = new THREE.PointLight(0x38bdf8, 0, 28);
    this.afterburnerLight.position.set(0, 0, 1.8);
    this.afterburnerGroup.add(this.afterburnerLight);

    // Plasma sparks
    const sparkCount = 28;
    const sparkPositions = new Float32Array(sparkCount * 3);
    this.sparkVelocities = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 2] = Math.random() * 12.0;
      this.sparkVelocities.push({ speed: 18 + Math.random() * 20 });
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    this.sparkMat = new THREE.PointsMaterial({
      color: 0xffedd5,
      size: 0.36,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.sparkPoints = new THREE.Points(sparkGeo, this.sparkMat);
    this.afterburnerGroup.add(this.sparkPoints);
    this.afterburnerGroup.scale.set(0, 0, 0);
  }

  // Multi-Engine Turbofan Exhaust Heat Plumes (for A380 4-engine & Phenom 2-engine)
  initMultiEnginePlumes() {
    this.multiPlumeGroup = new THREE.Group();
    this.aircraftGroup.add(this.multiPlumeGroup);
    this.multiPlumes = [];

    const plumeGeo = new THREE.ConeGeometry(0.55, 4.8, 12, 1, true);
    plumeGeo.rotateX(Math.PI / 2);
    plumeGeo.translate(0, 0, 2.4);

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(plumeGeo, mat);
      mesh.visible = false;
      this.multiPlumeGroup.add(mesh);
      this.multiPlumes.push(mesh);
    }
  }

  // Wingtip Navigation Lights, Dual White Strobes & Red Anti-Collision Beacons
  initNavLights() {
    this.navLightsGroup = new THREE.Group();
    this.aircraftGroup.add(this.navLightsGroup);

    const makeLightBulb = (hex, radius, lightDist, baseIntensity) => {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 8, 8),
        new THREE.MeshBasicMaterial({ color: hex })
      );
      group.add(mesh);
      const pl = new THREE.PointLight(hex, baseIntensity, lightDist);
      group.add(pl);
      return { group, mesh, light: pl };
    };

    this.redNav = makeLightBulb(0xef4444, 0.16, 14, 1.8);
    this.greenNav = makeLightBulb(0x22c55e, 0.16, 14, 1.8);
    this.leftStrobe = makeLightBulb(0xffffff, 0.18, 22, 0);
    this.rightStrobe = makeLightBulb(0xffffff, 0.18, 22, 0);
    this.tailStrobe = makeLightBulb(0xffffff, 0.18, 22, 0);
    this.topBeacon = makeLightBulb(0xff1e1e, 0.17, 16, 0);

    this.navLightsGroup.add(
      this.redNav.group,
      this.greenNav.group,
      this.leftStrobe.group,
      this.rightStrobe.group,
      this.tailStrobe.group,
      this.topBeacon.group
    );
  }

  // Dynamic Wingtip Vortices / High-G & High-Altitude Contrails
  initVortexTrails() {
    this.vortexGroup = new THREE.Group();
    this.aircraftGroup.add(this.vortexGroup);

    const trailGeo = new THREE.CylinderGeometry(0.05, 0.35, 18, 8, 1, true);
    trailGeo.rotateX(Math.PI / 2);
    trailGeo.translate(0, 0, 9);

    this.vortexMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.leftVortex = new THREE.Mesh(trailGeo, this.vortexMat);
    this.rightVortex = new THREE.Mesh(trailGeo, this.vortexMat);
    this.vortexGroup.add(this.leftVortex, this.rightVortex);
  }

  // Prandtl-Glauert Transonic Vapor Cone (Mach 0.95 - 1.05 on F-16)
  initVaporCone() {
    const coneGeo = new THREE.ConeGeometry(4.4, 7.2, 24, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    this.vaporMat = new THREE.MeshBasicMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.vaporCone = new THREE.Mesh(coneGeo, this.vaporMat);
    this.vaporCone.visible = false;
    this.aircraftGroup.add(this.vaporCone);
  }

  // Touchdown Tire Smoke Puffs
  initTouchdownSmoke() {
    this.tireSmokeGroup = new THREE.Group();
    this.scene.add(this.tireSmokeGroup);
    this.tireSmokePuffs = [];
  }

  triggerTouchdownSmoke(intensity = 1.0) {
    const puffGeo = new THREE.DodecahedronGeometry(0.95 * this.scaleRatio, 1);
    const spanOffset = this.modelDimensions.wingspan * 0.14;
    const gearY = -this.modelDimensions.height * 0.52;

    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.65 * clamp(intensity, 0.5, 1.2),
        depthWrite: false
      });
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.position.set(
        side * spanOffset + (Math.random() - 0.5) * 0.8,
        gearY + Math.random() * 0.4,
        (Math.random() - 0.5) * 1.4
      );
      this.tireSmokeGroup.add(mesh);
      this.tireSmokePuffs.push({
        mesh,
        age: 0,
        vel: new THREE.Vector3(
          side * (1.2 + Math.random() * 1.8),
          0.9 + Math.random() * 1.5,
          14 + Math.random() * 12
        )
      });
    }
  }

  initFreeOrbitEvents() {
    window.addEventListener('pointerdown', e => {
      if (this.cameraMode !== 'free') return;
      if (e.target.closest && (
        e.target.closest('.hud-panel') ||
        e.target.closest('.hud-dock') ||
        e.target.closest('.screen-throttle') ||
        e.target.closest('button')
      )) return;
      this.freeOrbit.isDragging = true;
      this.freeOrbit.lastX = e.clientX;
      this.freeOrbit.lastY = e.clientY;
    });

    window.addEventListener('pointermove', e => {
      if (!this.freeOrbit.isDragging || this.cameraMode !== 'free') return;
      const dx = e.clientX - this.freeOrbit.lastX;
      const dy = e.clientY - this.freeOrbit.lastY;
      this.freeOrbit.lastX = e.clientX;
      this.freeOrbit.lastY = e.clientY;
      this.freeOrbit.yaw -= dx * 0.45;
      this.freeOrbit.pitch = clamp(this.freeOrbit.pitch + dy * 0.4, -70, 80);
    });

    const stopDrag = () => { this.freeOrbit.isDragging = false; };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    window.addEventListener('wheel', e => {
      if (this.cameraMode !== 'free') return;
      this.freeOrbit.distance = clamp(this.freeOrbit.distance + Math.sign(e.deltaY) * 3, 8, 140);
    }, { passive: true });
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  async loadAircraft(planeDef) {
    if (this.currentAircraftId === planeDef.id) return;
    this.currentAircraftId = planeDef.id;
    this.currentAircraftDef = planeDef;

    if (this.currentModel) {
      this.aircraftGroup.remove(this.currentModel);
      this.currentModel = null;
    }

    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(planeDef.modelUrl, resolve, undefined, reject);
      });

      const model = gltf.scene;
      model.rotation.set(-Math.PI / 2, 0, 0);
      if (planeDef.scale) {
        model.scale.setScalar(planeDef.scale);
      }
      model.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());

      this.modelDimensions = {
        wingspan: Math.max(8, size.x),
        height: Math.max(3, size.y),
        length: Math.max(10, size.z)
      };

      const refLength = 15.74;
      this.scaleRatio = this.modelDimensions.length / refLength;

      this.baseDistance = 22.0 * this.scaleRatio;
      this.baseHeight = 6.5 * this.scaleRatio;
      this.baseLookAhead = 18.0 * this.scaleRatio;
      this.baseTargetOffset = 3.5 * this.scaleRatio;
      this.minimumHeight = 3.2 * this.scaleRatio;
      this.currentDistance = this.baseDistance;

      this.smoothedCameraPosition.set(0, this.baseHeight, this.baseDistance);
      this.smoothedTarget.set(0, this.baseTargetOffset, -this.baseLookAhead);

      const diffuseTexture = this.textureLoader.load(planeDef.texture);
      diffuseTexture.flipY = false;
      diffuseTexture.colorSpace = THREE.SRGBColorSpace;
      diffuseTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

      model.traverse(child => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          mat.map = diffuseTexture;
          mat.envMap = this.studioEnvMap || this.reflectionTexture;
          mat.envMapIntensity = 0.95;
          mat.metalness = planeDef.metalness ?? 0.30;
          mat.roughness = planeDef.roughness ?? 0.38;
          if (this.specularTexture) {
            mat.roughnessMap = this.specularTexture;
          }
          mat.needsUpdate = true;
        }
      });

      this.currentModel = model;
      this.aircraftGroup.add(model);

      // Position Landing Gear proportionally under fuselage
      const gearScale = clamp(this.scaleRatio * 0.95, 0.7, 3.2);
      const bellyY = box.min.y + this.modelDimensions.height * 0.14;
      this.noseGear.position.set(0, bellyY, -this.modelDimensions.length * 0.32);
      this.noseGear.scale.setScalar(gearScale * 0.85);
      this.leftGear.position.set(-this.modelDimensions.wingspan * 0.14, bellyY, this.modelDimensions.length * 0.06);
      this.leftGear.scale.setScalar(gearScale);
      this.rightGear.position.set(this.modelDimensions.wingspan * 0.14, bellyY, this.modelDimensions.length * 0.06);
      this.rightGear.scale.setScalar(gearScale);

      // Configure Afterburner (F-16) vs Multi-Engine Turbofan Plumes (A380 / Phenom)
      if (planeDef.id === 'f16') {
        this.afterburnerGroup.position.set(0, 0.32, 10.3);
        this.multiPlumes.forEach(p => { p.visible = false; });
      } else if (planeDef.id === 'a380') {
        this.afterburnerGroup.scale.set(0, 0, 0);
        const span = this.modelDimensions.wingspan;
        const positions = [
          [-span * 0.31, bellyY + 0.3, 1.5],
          [-span * 0.18, bellyY + 0.1, -1.0],
          [span * 0.18, bellyY + 0.1, -1.0],
          [span * 0.31, bellyY + 0.3, 1.5]
        ];
        this.multiPlumes.forEach((p, idx) => {
          p.position.set(...positions[idx]);
          p.visible = true;
        });
      } else {
        // Phenom twin rear fuselage turbofans
        this.afterburnerGroup.scale.set(0, 0, 0);
        const positions = [
          [-1.35, 0.65, this.modelDimensions.length * 0.25],
          [1.35, 0.65, this.modelDimensions.length * 0.25]
        ];
        this.multiPlumes.forEach((p, idx) => {
          if (idx < 2) {
            p.position.set(...positions[idx]);
            p.visible = true;
          } else {
            p.visible = false;
          }
        });
      }

      // Position wingtip vortices & transonic vapor cone
      this.leftVortex.position.set(-this.modelDimensions.wingspan * 0.49, 0, 0);
      this.rightVortex.position.set(this.modelDimensions.wingspan * 0.49, 0, 0);
      this.vaporCone.position.set(0, 0.2, 0.5);
    } catch (err) {
      console.warn('Failed to load 3D aircraft model:', err);
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.aircraftGroup.visible = mode !== 'cockpit';
    if (mode === 'free') {
      this.freeOrbit.yaw = 0;
      this.freeOrbit.pitch = 15;
      this.freeOrbit.distance = 28 * this.scaleRatio;
    }
  }

  update(flightState, cameraMode = 'follow', dt = 0.016) {
    if (this.contextLost) return;
    dt = clamp(dt, 0.005, 0.05);
    this.cameraMode = cameraMode;

    if (cameraMode === 'cockpit') {
      this.aircraftGroup.visible = false;
      this.renderer.domElement.style.display = 'none';
      return;
    }

    this.aircraftGroup.visible = true;
    this.renderer.domElement.style.display = 'block';

    const att = flightState.euler || { roll: 0, pitch: 0, yaw: 0 };
    const speedKt = flightState.ias || 0;
    const gLoad = flightState.g || 1.0;
    const throttle = flightState.engine ?? 0.6;
    const gearPos = flightState.gearPos ?? 1;
    const stall = !!flightState.stall;
    const onGround = !!flightState.onGround;
    const transonic = !!flightState.transonic;
    const reverseThrust = !!flightState.reverseThrust;

    // Aircraft orientation
    this.aircraftGroup.rotation.order = 'YXZ';
    this.aircraftGroup.rotation.x = att.pitch * DEG;
    this.aircraftGroup.rotation.z = -att.roll * DEG;
    this.aircraftGroup.rotation.y = -(flightState.slip || 0) * 0.55 * DEG;
    this.aircraftGroup.position.set(0, 0, 0);
    this.aircraftGroup.updateMatrixWorld(true);

    // Subtle dynamic FOV widening with airspeed
    const targetFov = cameraMode === 'chase'
      ? 70 + smoothstep(140, 560, speedKt) * 10
      : cameraMode === 'wing'
        ? 62
        : 64 + smoothstep(160, 620, speedKt) * 7;

    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Camera choreography
    if (cameraMode === 'follow') {
      const speedFactor = smoothstep(140, 480, speedKt);
      const bankFactor = smoothstep(15, 60, Math.abs(att.roll));
      const targetDistance = this.baseDistance
        + (5.0 * this.scaleRatio) * speedFactor
        + (8.0 * this.scaleRatio) * bankFactor;

      this.currentDistance += (targetDistance - this.currentDistance) * (1 - Math.exp(-2.8 * dt));

      _vForward.copy(AIRCRAFT_FORWARD_AXIS).applyQuaternion(this.aircraftGroup.quaternion);
      _vHorizFwd.set(_vForward.x, 0, _vForward.z);
      if (_vHorizFwd.lengthSq() < 1e-5) _vHorizFwd.copy(AIRCRAFT_FORWARD_AXIS);
      else _vHorizFwd.normalize();

      _vDesiredCam.copy(this.aircraftGroup.position)
        .addScaledVector(_vHorizFwd, -this.currentDistance)
        .add(_vUpOffset.set(0, this.baseHeight, 0));
      _vDesiredCam.y = Math.max(_vDesiredCam.y, this.minimumHeight);

      const pitchLookOffset = Math.tan(clamp(att.pitch * 0.25, -12, 12) * DEG) * this.baseLookAhead;
      _vDesiredTarget.copy(this.aircraftGroup.position)
        .addScaledVector(_vHorizFwd, this.baseLookAhead)
        .add(_vTmp.set(0, this.baseTargetOffset + pitchLookOffset, 0));

      const dampPos = 1 - Math.exp(-5.5 * dt);
      const dampTgt = 1 - Math.exp(-6.5 * dt);
      this.smoothedCameraPosition.lerp(_vDesiredCam, dampPos);
      this.smoothedTarget.lerp(_vDesiredTarget, dampTgt);

      this.camera.position.copy(this.smoothedCameraPosition);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.smoothedTarget);
    } else if (cameraMode === 'chase') {
      const chaseRoll = -att.roll * 0.45 * DEG;
      this.camera.up.set(Math.sin(chaseRoll), Math.cos(chaseRoll), 0);
      const chaseDist = this.baseDistance * 0.74;
      const camY = this.baseHeight * 0.72 - att.pitch * 0.12;
      this.camera.position.set(0, camY, chaseDist);
      this.camera.lookAt(0, this.baseTargetOffset * 0.5, -this.baseLookAhead * 0.7);
    } else if (cameraMode === 'wing') {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(
        -this.modelDimensions.wingspan * 0.44,
        this.modelDimensions.height * 0.45,
        this.modelDimensions.length * 0.16
      );
      this.camera.lookAt(0, this.modelDimensions.height * 0.2, -this.modelDimensions.length * 0.42);
    } else if (cameraMode === 'free') {
      this.camera.up.set(0, 1, 0);
      const radYaw = this.freeOrbit.yaw * DEG;
      const radPitch = this.freeOrbit.pitch * DEG;
      const d = this.freeOrbit.distance;
      this.camera.position.set(
        Math.sin(radYaw) * Math.cos(radPitch) * d,
        Math.sin(radPitch) * d + this.modelDimensions.height * 0.3,
        Math.cos(radYaw) * Math.cos(radPitch) * d
      );
      this.camera.lookAt(0, this.modelDimensions.height * 0.2, 0);
    }

    // Subtle physical vibration (runway tarmac roll, stall buffet, or transonic shudder)
    if (!this.isExploding) {
      let vib = 0;
      if (onGround && speedKt > 12) vib = clamp(speedKt / 160, 0, 1) * 0.08 * this.scaleRatio;
      else if (stall) vib = 0.24 * this.scaleRatio;
      else if (transonic) vib = 0.16 * this.scaleRatio;
      if (vib > 0.005) {
        this.camera.position.x += (Math.random() - 0.5) * vib;
        this.camera.position.y += (Math.random() - 0.5) * vib;
      }
    }

    // Update animated Landing Gear extension/retraction
    this.updateLandingGear(gearPos);

    // Update Engine Exhaust & Supersonic Afterburner
    this.updateAfterburner(throttle, dt, reverseThrust);

    // Update Nav, Strobe & Anti-Collision Lights
    this.updateNavLights();

    // Update Wingtip Vortices & Transonic Vapor Cone
    this.updateAeroEffects(speedKt, gLoad, flightState.aoa || 0, transonic, onGround, dt);

    // Update Touchdown Tire Smoke
    this.updateTouchdownSmoke(dt);

    if (this.isExploding) {
      this.updateExplosion(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateLandingGear(gearPos) {
    if (!this.gearGroup) return;
    if (this.isExploding || gearPos <= 0.02) {
      this.gearGroup.visible = false;
      return;
    }
    this.gearGroup.visible = true;
    const retractAngle = (1 - gearPos) * (Math.PI * 0.52);
    this.noseGear.rotation.x = -retractAngle;
    this.leftGear.rotation.z = retractAngle;
    this.rightGear.rotation.z = -retractAngle;
    this.landingBeam.visible = gearPos > 0.85;
  }

  updateAeroEffects(speedKt, gLoad, aoaDeg, transonic, onGround, dt) {
    // Wingtip condensation vortices during high-G turns or high AoA humid flight
    const vortexFactor = (!this.isExploding && !onGround && speedKt > 110)
      ? clamp((Math.abs(gLoad) - 1.65) * 0.35 + Math.max(0, aoaDeg - 9.5) * 0.05, 0, 0.55)
      : 0;
    this.vortexMat.opacity += (vortexFactor - this.vortexMat.opacity) * Math.min(1, dt * 6);
    this.vortexGroup.visible = this.vortexMat.opacity > 0.02;

    // Transonic Mach vapor cone (F-16 crossing Mach 1)
    if (this.currentAircraftId === 'f16' && transonic && !this.isExploding && !onGround) {
      this.vaporCone.visible = true;
      this.vaporMat.opacity = 0.28 + Math.sin(performance.now() * 0.03) * 0.06;
    } else {
      this.vaporCone.visible = false;
    }
  }

  updateTouchdownSmoke(dt) {
    for (let i = this.tireSmokePuffs.length - 1; i >= 0; i--) {
      const p = this.tireSmokePuffs[i];
      p.age += dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = 1 + p.age * 3.8;
      p.mesh.scale.set(s, s, s);
      p.mesh.material.opacity = Math.max(0, 0.65 - p.age * 0.55);
      if (p.age > 1.25) {
        this.tireSmokeGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.tireSmokePuffs.splice(i, 1);
      }
    }
  }

  updateAfterburner(throttle, dt, reverseThrust = false) {
    const isF16 = this.currentAircraftId === 'f16';
    const thr = clamp(throttle, 0, 1);
    const now = performance.now() * 0.001;
    const flutter = 1.0 + Math.sin(now * 68) * 0.07 + Math.cos(now * 105) * 0.04;

    // Multi-engine jet heat plumes for A380 & Phenom
    if (!isF16) {
      this.afterburnerGroup.visible = false;
      this.afterburnerLight.intensity = 0;
      const showPlume = !this.isExploding && thr > 0.30;
      this.multiPlumes.forEach(p => {
        if (!p.visible && !showPlume) return;
        const scaleLen = (0.35 + thr * 1.15) * flutter * (this.currentAircraftId === 'a380' ? 1.8 : 0.9);
        const scaleRad = (0.5 + thr * 0.35) * (this.currentAircraftId === 'a380' ? 1.5 : 0.65);
        p.scale.set(scaleRad, scaleRad, reverseThrust ? scaleLen * 0.35 : scaleLen);
        p.material.opacity = showPlume ? (0.14 + thr * 0.34) : 0;
        p.material.color.setHex(reverseThrust ? 0x94a3b8 : 0xfb923c);
      });
      return;
    }

    // F-16 Supersonic Afterburner
    if (this.isExploding || thr < 0.12) {
      this.afterburnerGroup.visible = false;
      this.afterburnerLight.intensity = 0;
      return;
    }

    this.afterburnerGroup.visible = true;
    if (thr <= 0.68) {
      const factor = (thr - 0.12) / 0.56;
      const sZ = (0.28 + factor * 0.65) * flutter;
      const sXY = 0.35 + factor * 0.42;
      this.afterburnerGroup.scale.set(sXY, sXY, sZ);
      this.innerFlameMat.color.setHex(0xf97316);
      this.innerFlameMat.opacity = 0.45 + factor * 0.3;
      this.outerFlameMat.opacity = 0.30 + factor * 0.35;
      this.diamondMat.opacity = 0.14 * factor;
      this.afterburnerLight.intensity = factor * 2.6;
      this.afterburnerLight.color.setHex(0xf97316);
    } else {
      const abFactor = (thr - 0.68) / 0.32;
      const isMaxAB = thr > 0.85;
      const sZ = (1.25 + abFactor * 2.35) * flutter;
      const sXY = (0.85 + abFactor * 0.45) * (1.0 + Math.sin(now * 45) * 0.04);
      this.afterburnerGroup.scale.set(sXY, sXY, sZ);

      this.innerFlameMat.color.setHex(isMaxAB ? 0x38bdf8 : 0x60a5fa);
      this.innerFlameMat.opacity = 0.90 + Math.random() * 0.09;
      this.outerFlameMat.color.setHex(isMaxAB ? 0xf97316 : 0xfb923c);
      this.outerFlameMat.opacity = 0.78 + Math.random() * 0.15;
      this.diamondMat.opacity = 0.95;

      this.machDiamonds.forEach((d, i) => {
        const pulse = 1.0 + Math.sin(now * 52 + i * 1.6) * 0.16;
        d.mesh.scale.set(pulse, pulse, pulse);
      });

      this.afterburnerLight.intensity = 4.2 + abFactor * 10.0;
      this.afterburnerLight.color.setHex(isMaxAB ? 0x38bdf8 : 0xf97316);
    }

    if (this.sparkPoints) {
      const posAttr = this.sparkPoints.geometry.attributes.position;
      const arr = posAttr.array;
      const maxZ = 12.0 * this.afterburnerGroup.scale.z;
      for (let i = 0; i < this.sparkVelocities.length; i++) {
        arr[i * 3 + 2] += this.sparkVelocities[i].speed * dt * (0.8 + thr * 1.2);
        if (arr[i * 3 + 2] > maxZ) {
          arr[i * 3 + 0] = (Math.random() - 0.5) * 0.35;
          arr[i * 3 + 1] = (Math.random() - 0.5) * 0.35;
          arr[i * 3 + 2] = 0.2 + Math.random() * 0.8;
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  updateNavLights() {
    if (!this.navLightsGroup) return;
    if (this.isExploding) {
      this.navLightsGroup.visible = false;
      return;
    }
    this.navLightsGroup.visible = true;

    const span = this.modelDimensions.wingspan * 0.48;
    const len = this.modelDimensions.length * 0.48;
    const h = this.modelDimensions.height * 0.36;

    this.redNav.group.position.set(-span, 0, -len * 0.04);
    this.greenNav.group.position.set(span, 0, -len * 0.04);
    this.leftStrobe.group.position.set(-span, 0, len * 0.04);
    this.rightStrobe.group.position.set(span, 0, len * 0.04);
    this.tailStrobe.group.position.set(0, h + 0.5, len * 0.82);
    this.topBeacon.group.position.set(0, h * 0.9, -len * 0.06);

    const t = performance.now() % 1300;
    // Authentic double-flash aviation wingtip & tail strobes
    const strobeOn = (t < 65) || (t > 140 && t < 205);
    const strobeInt = strobeOn ? 7.5 : 0;
    this.leftStrobe.light.intensity = strobeInt;
    this.leftStrobe.mesh.visible = strobeOn;
    this.rightStrobe.light.intensity = strobeInt;
    this.rightStrobe.mesh.visible = strobeOn;
    this.tailStrobe.light.intensity = strobeInt;
    this.tailStrobe.mesh.visible = strobeOn;

    // Alternating red anti-collision beacon
    const beaconOn = t > 620 && t < 780;
    this.topBeacon.light.intensity = beaconOn ? 5.5 : 0;
    this.topBeacon.mesh.visible = beaconOn;
  }

  triggerExplosion(speedKt = 200) {
    if (this.isExploding) return;
    this.isExploding = true;
    this.explosionTime = 0;
    this.shakeAmp = 4.2;

    if (this.currentModel) this.currentModel.visible = false;
    if (this.afterburnerGroup) this.afterburnerGroup.visible = false;
    if (this.navLightsGroup) this.navLightsGroup.visible = false;
    if (this.gearGroup) this.gearGroup.visible = false;
    if (this.vortexGroup) this.vortexGroup.visible = false;
    this.multiPlumes.forEach(p => { p.visible = false; });

    this.clearExplosion();

    const fireGeo = new THREE.SphereGeometry(2.0, 12, 10);
    const fireColors = [0xffffff, 0xffea00, 0xff7700, 0xff3300, 0xdc2626, 0x991b1b];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: fireColors[i % fireColors.length],
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(fireGeo, mat);
      mesh.position.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4);
      this.explosionGroup.add(mesh);
      this.fireballObjects.push({
        mesh,
        speed: 8 + Math.random() * 6,
        dir: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 8, (Math.random() - 0.5) * 8)
      });
    }

    const forwardSpd = (speedKt || 150) * 0.15;
    for (let i = 0; i < 42; i++) {
      let geo;
      if (i < 6) geo = new THREE.BoxGeometry(4.0 + Math.random() * 5, 0.4, 1.5 + Math.random() * 2);
      else if (i < 12) geo = new THREE.CylinderGeometry(0.8, 1.2, 3.5, 8);
      else geo = new THREE.TetrahedronGeometry(1.2 + Math.random() * 1.5);

      const mat = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0x1e293b : i % 3 === 1 ? 0x334155 : 0xe2e8f0,
        roughness: 0.55,
        metalness: 0.72,
        emissive: i % 4 === 0 ? 0xff4400 : 0x000000,
        emissiveIntensity: 0.85
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8);

      const angle = Math.random() * Math.PI * 2;
      const blastRad = 15 + Math.random() * 35;
      this.explosionGroup.add(mesh);
      this.debrisObjects.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * blastRad, 12 + Math.random() * 28, -forwardSpd + Math.sin(angle) * blastRad),
        rotVel: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12)
      });
    }

    const smokeGeo = new THREE.DodecahedronGeometry(3.0, 1);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1c1917, transparent: true, opacity: 0.75, depthWrite: false });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.position.set((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6);
      this.explosionGroup.add(mesh);
      this.smokeObjects.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, 6 + Math.random() * 8, (Math.random() - 0.5) * 4),
        growth: 2.5 + Math.random() * 2.0
      });
    }
  }

  updateExplosion(dt) {
    if (!this.isExploding) return;
    this.explosionTime += dt;

    this.fireballObjects.forEach(fb => {
      const s = 1.0 + fb.speed * Math.min(1.0, this.explosionTime * 2.5);
      fb.mesh.scale.set(s, s, s);
      fb.mesh.position.addScaledVector(fb.dir, dt);
      if (fb.mesh.material) fb.mesh.material.opacity = Math.max(0, 0.95 - this.explosionTime * 0.7);
    });

    const gravity = 25.0;
    this.debrisObjects.forEach(d => {
      d.vel.y -= gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < -3.0) {
        d.mesh.position.y = -3.0;
        d.vel.y *= -0.25;
        d.vel.x *= 0.85;
        d.vel.z *= 0.85;
      }
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;
    });

    this.smokeObjects.forEach(sm => {
      sm.mesh.position.addScaledVector(sm.vel, dt);
      const curScale = sm.mesh.scale.x + sm.growth * dt;
      sm.mesh.scale.set(curScale, curScale, curScale);
      if (sm.mesh.material) sm.mesh.material.opacity = Math.max(0, 0.75 - this.explosionTime * 0.28);
    });

    if (this.shakeAmp > 0.05) {
      this.shakeAmp = Math.max(0, this.shakeAmp - dt * 3.5);
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmp;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp;
    }
  }

  clearExplosion() {
    while (this.explosionGroup.children.length > 0) {
      const obj = this.explosionGroup.children[0];
      this.explosionGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.debrisObjects = [];
    this.fireballObjects = [];
    this.smokeObjects = [];
  }

  resetExplosion() {
    this.isExploding = false;
    this.explosionTime = 0;
    this.shakeAmp = 0;
    this.clearExplosion();
    if (this.currentModel) this.currentModel.visible = true;
    if (this.afterburnerGroup) this.afterburnerGroup.visible = true;
    if (this.navLightsGroup) this.navLightsGroup.visible = true;
    if (this.gearGroup) this.gearGroup.visible = true;
    if (this.currentAircraftId !== 'f16') {
      const count = this.currentAircraftId === 'a380' ? 4 : 2;
      this.multiPlumes.forEach((p, idx) => { p.visible = idx < count; });
    }
  }

  destroy() {
    if (this.renderer?.domElement?.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose();
  }
}
