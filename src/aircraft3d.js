import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const DEG = Math.PI / 180;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (min, max, value) => {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
};

// ============================================================================
// STEP 1 — AIRCRAFT AXIS CONSTANTS (MATHEMATICALLY VERIFIED FROM MODEL VERTICES)
// ============================================================================
// When the raw GeoFS glTF model is oriented with model.rotation.set(-PI/2, 0, 0):
// - NOSE points towards -Z (Three.js standard forward)
// - TAIL points towards +Z
// - TOP / CANOPY / VERTICAL FIN points towards +Y (Three.js world up)
// - BELLY / WHEELS points towards -Y
// - RIGHT WING points towards +X
// - LEFT WING points towards -X
export const AIRCRAFT_FORWARD_AXIS = new THREE.Vector3(0, 0, -1);
export const AIRCRAFT_UP_AXIS = new THREE.Vector3(0, 1, 0);
export const AIRCRAFT_RIGHT_AXIS = new THREE.Vector3(1, 0, 0);

export class Aircraft3D {
  constructor(container) {
    this.container = container;
    this.currentModel = null;
    this.currentAircraftId = '';
    this.currentAircraftDef = null;
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    // Scene
    this.scene = new THREE.Scene();

    // Camera (65 deg FOV as specified)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.5, 5000);
    this.camera.up.set(0, 1, 0);

    // Camera Modes: FOLLOW (default), COCKPIT, CHASE, WING, FREE
    this.cameraMode = 'follow';

    // Model physical bounding dimensions (measured via Box3)
    this.modelDimensions = { wingspan: 10.56, length: 15.74, height: 4.78 };
    this.scaleRatio = 1.0;
    this.baseDistance = 22.0;
    this.baseHeight = 6.5;
    this.baseLookAhead = 18.0;
    this.baseTargetOffset = 3.5;
    this.minimumHeight = 3.5;
    this.currentDistance = 22.0;

    // Smoothed camera transform vectors
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

    // Debug helpers toggle
    this.debug = false;
    this.debugArrow = null;
    this.debugTargetHelper = null;

    // WebGL Renderer with alpha transparency for seamless Google 3D Maps background
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    const el = this.renderer.domElement;
    el.id = 'aircraft3dCanvas';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '5';
    this.container.appendChild(el);

    // Studio & Sunlight matching Coimbatore solar angle
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 2.8);
    this.sunLight.position.set(30, 60, -40);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0x8bc34a, 0x2196f3, 0.9);
    this.scene.add(this.hemiLight);

    // Authentic GeoFS environmental reflection sky map
    this.reflectionTexture = this.textureLoader.load('/textures/reflection.jpg');
    this.reflectionTexture.mapping = THREE.EquirectangularReflectionMapping;

    // Authentic GeoFS specular shine map
    this.specularTexture = this.textureLoader.load('/textures/specular.jpg');

    // Root group for aircraft 3D transforms (attitude: pitch, roll, yaw)
    this.aircraftGroup = new THREE.Group();
    this.aircraftGroup.rotation.order = 'YXZ';
    this.scene.add(this.aircraftGroup);

    // Jet exhaust / afterburner flame lights
    this.exhaustLights = [];
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0x38bdf8, 0, 18);
      this.exhaustLights.push(pl);
      this.scene.add(pl);
    }

    // Supersonic Afterburner Jet Flame System (USAF F-16 & Fighters)
    this.initAfterburnerSystem();

    // Aircraft Navigation & Strobe Lights
    this.initNavLights();

    // Crash Explosion & Break-apart 3D system
    this.explosionGroup = new THREE.Group();
    this.scene.add(this.explosionGroup);
    this.isExploding = false;
    this.explosionTime = 0;
    this.debrisObjects = [];
    this.fireballObjects = [];
    this.smokeObjects = [];
    this.shakeAmp = 0;

    // Pointer events for FREE orbit camera
    this.initFreeOrbitEvents();

    window.addEventListener('resize', () => this.onResize());
  }

  initAfterburnerSystem() {
    this.afterburnerGroup = new THREE.Group();
    this.aircraftGroup.add(this.afterburnerGroup);

    // 1. Inner Supersonic Core Flame (Electric Cyan / Shock Wave Blue)
    const innerGeo = new THREE.ConeGeometry(0.50, 6.8, 16, 1, true);
    innerGeo.rotateX(Math.PI / 2);
    innerGeo.translate(0, 0, 6.8 / 2);
    this.innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.innerFlameMesh = new THREE.Mesh(innerGeo, this.innerFlameMat);
    this.afterburnerGroup.add(this.innerFlameMesh);

    // 2. Outer Fire Flame Envelope (Fiery Roaring Orange / Amber)
    const outerGeo = new THREE.ConeGeometry(0.80, 10.5, 16, 1, true);
    outerGeo.rotateX(Math.PI / 2);
    outerGeo.translate(0, 0, 10.5 / 2);
    this.outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.outerFlameMesh = new THREE.Mesh(outerGeo, this.outerFlameMat);
    this.afterburnerGroup.add(this.outerFlameMesh);

    // 3. Supersonic Mach Shock Diamonds (Mach Discs)
    this.machDiamonds = [];
    const diamondGeo = new THREE.OctahedronGeometry(0.35, 0);
    diamondGeo.scale(1.0, 0.9, 2.2);
    this.diamondMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const diamondZOffsets = [1.2, 2.6, 4.0, 5.4, 6.8];
    diamondZOffsets.forEach(z => {
      const mesh = new THREE.Mesh(diamondGeo, this.diamondMat);
      mesh.position.set(0, 0, z);
      this.afterburnerGroup.add(mesh);
      this.machDiamonds.push({ mesh, baseZ: z });
    });

    // 4. Glowing Engine Nozzle Rim Ring
    const ringGeo = new THREE.TorusGeometry(0.62, 0.08, 8, 24);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending
    });
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMat);
    this.ringMesh.position.set(0, 0, 0.05);
    this.afterburnerGroup.add(this.ringMesh);

    // 5. Dynamic Afterburner Point Light
    this.afterburnerLight = new THREE.PointLight(0x38bdf8, 0, 28);
    this.afterburnerLight.position.set(0, 0, 1.8);
    this.afterburnerGroup.add(this.afterburnerLight);

    // 6. Supersonic High-Speed Trailing Sparks / Plasma Embers
    const sparkCount = 28;
    const sparkPositions = new Float32Array(sparkCount * 3);
    this.sparkVelocities = [];
    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      sparkPositions[i * 3 + 2] = Math.random() * 12.0;
      this.sparkVelocities.push({
        speed: 18.0 + Math.random() * 20.0,
        radial: (Math.random() - 0.5) * 0.8
      });
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    this.sparkMat = new THREE.PointsMaterial({
      color: 0xffedd5,
      size: 0.38,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.sparkPoints = new THREE.Points(sparkGeo, this.sparkMat);
    this.afterburnerGroup.add(this.sparkPoints);

    // Set initial position for baseline F-16
    this.afterburnerGroup.position.set(0, 0.32, 10.3);
    this.afterburnerGroup.scale.set(0, 0, 0);
  }

  initNavLights() {
    this.navLightsGroup = new THREE.Group();
    this.aircraftGroup.add(this.navLightsGroup);

    // Left Wingtip Red Light
    const redLight = new THREE.PointLight(0xef4444, 1.5, 14);
    const redGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const redMesh = new THREE.Mesh(redGeo, redMat);
    redLight.add(redMesh);
    this.redNav = redLight;
    this.navLightsGroup.add(redLight);

    // Right Wingtip Green Light
    const greenLight = new THREE.PointLight(0x22c55e, 1.5, 14);
    const greenGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const greenMesh = new THREE.Mesh(greenGeo, greenMat);
    greenLight.add(greenMesh);
    this.greenNav = greenLight;
    this.navLightsGroup.add(greenLight);

    // Tail / Fin White Strobe Light (Flashes every 1.2s)
    const strobeLight = new THREE.PointLight(0xffffff, 0, 24);
    const strobeGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strobeMesh = new THREE.Mesh(strobeGeo, strobeMat);
    strobeLight.add(strobeMesh);
    this.tailStrobe = strobeLight;
    this.navLightsGroup.add(strobeLight);
  }

  initFreeOrbitEvents() {
    window.addEventListener('pointerdown', e => {
      if (this.cameraMode !== 'free') return;
      if (e.target.closest && (e.target.closest('.hud-panel') || e.target.closest('.hud-actions') || e.target.closest('.screen-throttle') || e.target.closest('button'))) return;
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
      this.freeOrbit.distance = clamp(this.freeOrbit.distance + Math.sign(e.deltaY) * 3, 8, 120);
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

    // Remove existing model
    if (this.currentModel) {
      this.aircraftGroup.remove(this.currentModel);
      this.currentModel = null;
    }

    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(planeDef.modelUrl, resolve, undefined, reject);
      });

      const model = gltf.scene;

      // ======================================================================
      // STEP 1 — BAKE VERIFIED MODEL ORIENTATION
      // ======================================================================
      // Align raw GeoFS model coordinates:
      // GeoFS Nose (+Y) -> -Z (Nose forward)
      // GeoFS Up (+Z)   -> +Y (Canopy up)
      // GeoFS Right (+X)-> +X (Right wing)
      model.rotation.set(-Math.PI / 2, 0, 0);
      if (planeDef.scale) {
        model.scale.setScalar(planeDef.scale);
      }
      model.updateMatrixWorld(true);

      // ======================================================================
      // STEP 9 — INSPECT ACTUAL BOUNDING BOX OF GLB (MODEL DIMENSIONS)
      // ======================================================================
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());

      this.modelDimensions = {
        wingspan: Math.max(8, size.x),
        height: Math.max(3, size.y),
        length: Math.max(10, size.z)
      };

      // Reference length: 15.74m (F-16 Falcon baseline)
      const refLength = 15.74;
      this.scaleRatio = this.modelDimensions.length / refLength;

      // Calculate camera boom parameters strictly proportional to aircraft length & wingspan
      this.baseDistance = 22.0 * this.scaleRatio;
      this.baseHeight = 6.5 * this.scaleRatio;
      this.baseLookAhead = 18.0 * this.scaleRatio;
      this.baseTargetOffset = 3.5 * this.scaleRatio;
      this.minimumHeight = 3.2 * this.scaleRatio;
      this.currentDistance = this.baseDistance;

      // Reset smoothed vectors immediately on aircraft switch
      this.smoothedCameraPosition.set(0, this.baseHeight, this.baseDistance);
      this.smoothedTarget.set(0, this.baseTargetOffset, -this.baseLookAhead);

      // Apply specific authentic diffuse texture from user's files
      const diffuseTexture = this.textureLoader.load(planeDef.texture);
      diffuseTexture.flipY = false;
      diffuseTexture.colorSpace = THREE.SRGBColorSpace;

      model.traverse(child => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          mat.map = diffuseTexture;
          mat.envMap = this.reflectionTexture;
          mat.envMapIntensity = 0.90;
          mat.metalness = planeDef.metalness || 0.25;
          mat.roughness = planeDef.roughness || 0.45;
          if (this.specularTexture) {
            mat.roughnessMap = this.specularTexture;
          }
          mat.needsUpdate = true;
        }
      });

      this.currentModel = model;
      this.aircraftGroup.add(model);

      // Position afterburner flame nozzle specifically for each airframe
      if (this.afterburnerGroup) {
        if (planeDef.id === 'f16') {
          this.afterburnerGroup.position.set(0, 0.32, 10.3);
        } else if (planeDef.id === 'phenom') {
          this.afterburnerGroup.position.set(0, 0.85, 5.2);
        } else if (planeDef.id === 'a380') {
          this.afterburnerGroup.position.set(0, -1.0, 3.2);
        }
        this.afterburnerGroup.scale.set(0, 0, 0);
      }

      console.info(
        `Aircraft3D loaded: ${planeDef.name} [Length: ${this.modelDimensions.length.toFixed(1)}m, Wingspan: ${this.modelDimensions.wingspan.toFixed(1)}m, BaseDist: ${this.baseDistance.toFixed(1)}m]`
      );
    } catch (err) {
      console.warn('Failed to load 3D aircraft model:', err);
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (mode === 'cockpit') {
      this.aircraftGroup.visible = false;
    } else {
      this.aircraftGroup.visible = true;
    }
    if (mode === 'free') {
      this.freeOrbit.yaw = 0;
      this.freeOrbit.pitch = 15;
      this.freeOrbit.distance = 28 * this.scaleRatio;
    }
  }

  toggleDebug() {
    this.debug = !this.debug;
    if (this.debugArrow) this.debugArrow.visible = this.debug;
    if (this.debugTargetHelper) this.debugTargetHelper.visible = this.debug;
  }

  update(att, speedKt = 160, gLoad = 1.0, throttle = 0.6, cameraMode = 'follow', dt = 0.016) {
    dt = clamp(dt, 0.005, 0.05);
    this.cameraMode = cameraMode;

    // --- COCKPIT VIEW ---
    if (cameraMode === 'cockpit') {
      this.aircraftGroup.visible = false;
      this.renderer.domElement.style.display = 'none';
      return;
    }

    this.aircraftGroup.visible = true;
    this.renderer.domElement.style.display = 'block';

    // ========================================================================
    // AIRCRAFT ATTITUDE APPLICATION
    // ========================================================================
    // Pitch: nose moves up (+Y) when pitch > 0 (rotation around +X)
    // Roll: right wing dips down (-Y) when roll > 0 (rotation around +Z by -roll)
    // Yaw: heading slip (rotation around +Y)
    this.aircraftGroup.rotation.order = 'YXZ';
    this.aircraftGroup.rotation.x = att.pitch * DEG;
    this.aircraftGroup.rotation.z = -att.roll * DEG;
    this.aircraftGroup.rotation.y = (att.yawSlip || 0) * DEG;
    this.aircraftGroup.position.set(0, 0, 0);
    this.aircraftGroup.updateMatrixWorld(true);

    // ========================================================================
    // CAMERA MODES
    // ========================================================================
    if (cameraMode === 'follow') {
      // ======================================================================
      // STEP 2 & 8 — TRUE STABILIZED FOLLOW CAMERA
      // ======================================================================
      if (this.camera.fov !== 65) {
        this.camera.fov = 65;
        this.camera.updateProjectionMatrix();
      }

      // Step 7: Dynamic distance based on speed and bank (independent of orientation)
      const speedFactor = smoothstep(140, 480, speedKt || 150);
      const bankFactor = smoothstep(15, 60, Math.abs(att.roll));
      const targetDistance = this.baseDistance
        + (5.0 * this.scaleRatio) * speedFactor
        + (8.0 * this.scaleRatio) * bankFactor;

      // Smooth distance interpolation (no sudden pops)
      this.currentDistance += (targetDistance - this.currentDistance) * (1 - Math.exp(-2.5 * dt));

      // Step 2.1 & 2.2: Get aircraft position & forward direction in world space
      const aircraftPosition = this.aircraftGroup.position; // (0, 0, 0)
      const forward = AIRCRAFT_FORWARD_AXIS.clone().applyQuaternion(this.aircraftGroup.quaternion);

      // Step 2.3 & 2.4: Remove vertical component and normalize horizontal forward vector
      const horizontalForward = new THREE.Vector3(forward.x, 0, forward.z);
      if (horizontalForward.lengthSq() < 1e-5) {
        horizontalForward.copy(AIRCRAFT_FORWARD_AXIS);
      } else {
        horizontalForward.normalize();
      }

      // Step 2.6 & 2.7: Place camera BEHIND aircraft using horizontal heading + WORLD-UP height
      // cameraPosition = aircraftPosition - horizontalForward * distance + Vector3(0, height, 0)
      const desiredCameraPosition = aircraftPosition.clone()
        .sub(horizontalForward.clone().multiplyScalar(this.currentDistance))
        .add(new THREE.Vector3(0, this.baseHeight, 0));

      // Step 6: Prevent camera from going under aircraft / minimum altitude
      desiredCameraPosition.y = Math.max(desiredCameraPosition.y, aircraftPosition.y + this.minimumHeight);

      // Step 3 & 10: Calculate look target ahead of aircraft + vertical offset for screen centering
      // Synchronize pitch look angle with Google Maps 3D tilt (75 - pitch * 0.25) for seamless alignment
      const pitchLookOffset = Math.tan(clamp(att.pitch * 0.25, -12, 12) * DEG) * this.baseLookAhead;
      const desiredTarget = aircraftPosition.clone()
        .add(horizontalForward.clone().multiplyScalar(this.baseLookAhead))
        .add(new THREE.Vector3(0, this.baseTargetOffset + pitchLookOffset, 0));

      // Step 8: Smoothly interpolate camera position and look target
      this.smoothedCameraPosition.lerp(desiredCameraPosition, 1 - Math.exp(-5.0 * dt));
      this.smoothedTarget.lerp(desiredTarget, 1 - Math.exp(-6.0 * dt));

      // Step 8: Apply position and lookAt with level horizon (up = 0, 1, 0)
      this.camera.position.copy(this.smoothedCameraPosition);
      this.camera.up.set(0, 1, 0); // World Y is camera up axis: HORIZON REMAINS STABLE!
      this.camera.lookAt(this.smoothedTarget);

    } else if (cameraMode === 'chase') {
      // ===== TIGHT CHASE CAMERA =====
      if (this.camera.fov !== 72) {
        this.camera.fov = 72;
        this.camera.updateProjectionMatrix();
      }
      const chaseRoll = -att.roll * 0.45 * DEG;
      this.camera.up.set(Math.sin(chaseRoll), Math.cos(chaseRoll), 0);

      const chaseDist = this.baseDistance * 0.75;
      const camY = this.baseHeight * 0.75 - att.pitch * 0.12;
      const camZ = chaseDist;
      this.camera.position.set(0, camY, camZ);
      this.camera.lookAt(0, this.baseTargetOffset * 0.5, -this.baseLookAhead * 0.7);

    } else if (cameraMode === 'wing') {
      // ===== WING-MOUNTED CINEMATIC CAMERA =====
      if (this.camera.fov !== 62) {
        this.camera.fov = 62;
        this.camera.updateProjectionMatrix();
      }
      this.camera.up.set(0, 1, 0);

      // Camera on left wing looking forward-right toward nose
      const wingX = -this.modelDimensions.wingspan * 0.42;
      const wingY = this.modelDimensions.height * 0.45;
      const wingZ = this.modelDimensions.length * 0.15;
      this.camera.position.set(wingX, wingY, wingZ);
      this.camera.lookAt(0, this.modelDimensions.height * 0.2, -this.modelDimensions.length * 0.4);

    } else if (cameraMode === 'free') {
      // ===== 360 FREE ORBIT CAMERA =====
      if (this.camera.fov !== 65) {
        this.camera.fov = 65;
        this.camera.updateProjectionMatrix();
      }
      this.camera.up.set(0, 1, 0);

      const radYaw = this.freeOrbit.yaw * DEG;
      const radPitch = this.freeOrbit.pitch * DEG;
      const d = this.freeOrbit.distance;

      this.camera.position.x = Math.sin(radYaw) * Math.cos(radPitch) * d;
      this.camera.position.y = Math.sin(radPitch) * d + this.modelDimensions.height * 0.3;
      this.camera.position.z = Math.cos(radYaw) * Math.cos(radPitch) * d;
      this.camera.lookAt(0, this.modelDimensions.height * 0.2, 0);
    }

    // Dynamic engine exhaust lights responding to throttle
    const thr = clamp(throttle || 0, 0, 1);
    const lightInt = (!this.isExploding && thr > 0.25) ? (thr - 0.2) * 5 : 0;
    const isAfterburner = thr > 0.88;
    this.exhaustLights.forEach(l => {
      l.intensity = lightInt;
      l.color.setHex(isAfterburner ? 0x38bdf8 : 0xf97316);
    });

    // Supersonic Afterburner Jet Flame & Aircraft Navigation Lights
    this.updateAfterburner(thr, dt);
    this.updateNavLights(dt);

    if (this.isExploding) {
      this.updateExplosion(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  triggerExplosion(speedKt = 200) {
    if (this.isExploding) return;
    this.isExploding = true;
    this.explosionTime = 0;
    this.shakeAmp = 4.0;

    // Disassemble / hide intact aircraft model, afterburner, and nav lights
    if (this.currentModel) {
      this.currentModel.visible = false;
    }
    if (this.afterburnerGroup) {
      this.afterburnerGroup.visible = false;
    }
    if (this.navLightsGroup) {
      this.navLightsGroup.visible = false;
    }

    // Clean up any old debris
    this.clearExplosion();

    // 1. Core Fireballs (Expanding glowing fire spheres)
    const fireGeo = new THREE.SphereGeometry(2.0, 12, 10);
    const fireColors = [0xffffff, 0xffea00, 0xff7700, 0xff3300, 0xdc2626, 0x991b1b];
    for (let i = 0; i < 8; i++) {
      const col = fireColors[i % fireColors.length];
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(fireGeo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 4
      );
      this.explosionGroup.add(mesh);
      this.fireballObjects.push({
        mesh,
        maxScale: 6.0 + Math.random() * 8.0,
        speed: 8.0 + Math.random() * 6.0,
        dir: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 8, (Math.random() - 0.5) * 8)
      });
    }

    // 2. Breaking Aircraft Debris Chunks (Wings, Fuselage, Tail shards)
    const forwardSpd = (speedKt || 150) * 0.15;
    for (let i = 0; i < 42; i++) {
      // Create varied shapes: large wing slab, fuselage cylinder, small jagged shards
      let geo;
      if (i < 6) {
        geo = new THREE.BoxGeometry(4.0 + Math.random() * 5, 0.4, 1.5 + Math.random() * 2); // Wing slab
      } else if (i < 12) {
        geo = new THREE.CylinderGeometry(0.8, 1.2, 3.5, 8); // Fuselage chunk
      } else {
        geo = new THREE.TetrahedronGeometry(1.2 + Math.random() * 1.5); // Shrapnel
      }

      const mat = new THREE.MeshStandardMaterial({
        color: (i % 3 === 0) ? 0x1e293b : (i % 3 === 1 ? 0x334155 : 0xe2e8f0),
        roughness: 0.6,
        metalness: 0.7,
        emissive: (i % 4 === 0) ? 0xff4400 : 0x000000,
        emissiveIntensity: 0.8
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 8
      );

      // Violent radial blast velocity + forward momentum + upward blast
      const angle = Math.random() * Math.PI * 2;
      const blastRad = 15 + Math.random() * 35;
      const vx = Math.cos(angle) * blastRad;
      const vz = -forwardSpd + Math.sin(angle) * blastRad;
      const vy = 12 + Math.random() * 28;

      this.explosionGroup.add(mesh);
      this.debrisObjects.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        )
      });
    }

    // 3. Volumetric Smoke Plumes
    const smokeGeo = new THREE.DodecahedronGeometry(3.0, 1);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1c1917,
        transparent: true,
        opacity: 0.75
      });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 4,
        (Math.random() - 0.5) * 6
      );
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

    // Animate Fireballs
    this.fireballObjects.forEach(fb => {
      const s = 1.0 + fb.speed * Math.min(1.0, this.explosionTime * 2.5);
      fb.mesh.scale.set(s, s, s);
      fb.mesh.position.addScaledVector(fb.dir, dt);
      if (fb.mesh.material) {
        fb.mesh.material.opacity = Math.max(0, 0.95 - this.explosionTime * 0.7);
      }
    });

    // Animate Debris Pieces with gravity and tumbling
    const gravity = 25.0; // m/s^2
    this.debrisObjects.forEach(d => {
      d.vel.y -= gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      // Floor bounce / roll on ground
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

    // Animate Smoke Plumes expanding and rising
    this.smokeObjects.forEach(sm => {
      sm.mesh.position.addScaledVector(sm.vel, dt);
      const curScale = sm.mesh.scale.x + sm.growth * dt;
      sm.mesh.scale.set(curScale, curScale, curScale);
      if (sm.mesh.material) {
        sm.mesh.material.opacity = Math.max(0, 0.75 - this.explosionTime * 0.28);
      }
    });

    // Screen Shake damping
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
    if (this.currentModel) {
      this.currentModel.visible = true;
    }
    if (this.afterburnerGroup) {
      this.afterburnerGroup.visible = true;
    }
    if (this.navLightsGroup) {
      this.navLightsGroup.visible = true;
    }
  }

  updateAfterburner(throttle, dt) {
    if (!this.afterburnerGroup) return;
    if (this.isExploding || throttle < 0.12) {
      this.afterburnerGroup.visible = false;
      if (this.afterburnerLight) this.afterburnerLight.intensity = 0;
      return;
    }

    this.afterburnerGroup.visible = true;
    const isF16 = this.currentAircraftId === 'f16';
    const thr = clamp(throttle, 0, 1);
    const now = performance.now() * 0.001;

    // High-frequency supersonic turbulent flame flutter
    const flutter = 1.0 + (Math.sin(now * 70) * 0.08 + Math.cos(now * 110) * 0.05);

    if (thr <= 0.60) {
      // Sub-military cruise glow (Warm orange exhaust core)
      const factor = (thr - 0.12) / 0.48;
      const sZ = (0.28 + factor * 0.55) * flutter;
      const sXY = (0.35 + factor * 0.40) * (isF16 ? 1.0 : 0.7);
      this.afterburnerGroup.scale.set(sXY, sXY, sZ);
      this.innerFlameMat.color.setHex(0xf97316);
      this.innerFlameMat.opacity = 0.45 + factor * 0.3;
      this.outerFlameMat.opacity = 0.30 + factor * 0.35;
      this.diamondMat.opacity = 0.12 * factor;
      this.afterburnerLight.intensity = factor * 2.5;
      this.afterburnerLight.color.setHex(0xf97316);
    } else {
      // SUPERSONIC AFTERBURNER ACTIVE (USAF Thunderbirds Full Blast)
      const abFactor = (thr - 0.60) / 0.40; // 0.0 to 1.0
      const isMaxAB = thr > 0.86;
      const sZ = (1.2 + abFactor * 2.2) * flutter * (isF16 ? 1.25 : 0.85);
      const sXY = (0.85 + abFactor * 0.45) * (1.0 + Math.sin(now * 45) * 0.04) * (isF16 ? 1.0 : 0.75);
      this.afterburnerGroup.scale.set(sXY, sXY, sZ);

      // Transition from electric shock cyan to roaring white-blue core with outer fiery orange plume
      this.innerFlameMat.color.setHex(isMaxAB ? 0x38bdf8 : 0x60a5fa);
      this.innerFlameMat.opacity = 0.90 + Math.random() * 0.09;
      this.outerFlameMat.color.setHex(isMaxAB ? 0xf97316 : 0xfb923c);
      this.outerFlameMat.opacity = 0.78 + Math.random() * 0.15;
      this.diamondMat.opacity = 0.95;

      // Pulse Supersonic Mach Shock Diamonds
      this.machDiamonds.forEach((d, i) => {
        const pulse = 1.0 + Math.sin(now * 52 + i * 1.6) * 0.16;
        d.mesh.scale.set(pulse, pulse, pulse);
      });

      // Dramatic flame light casting illumination onto airframe & surroundings
      this.afterburnerLight.intensity = 4.0 + abFactor * 10.0;
      this.afterburnerLight.color.setHex(isMaxAB ? 0x38bdf8 : 0xf97316);
    }

    // Animate trailing plasma embers / sparks
    if (this.sparkPoints) {
      const posAttr = this.sparkPoints.geometry.attributes.position;
      const arr = posAttr.array;
      const maxZ = 12.0 * this.afterburnerGroup.scale.z;
      for (let i = 0; i < this.sparkVelocities.length; i++) {
        const vel = this.sparkVelocities[i];
        arr[i * 3 + 2] += vel.speed * dt * (0.8 + thr * 1.2);
        if (arr[i * 3 + 2] > maxZ) {
          arr[i * 3 + 0] = (Math.random() - 0.5) * 0.35;
          arr[i * 3 + 1] = (Math.random() - 0.5) * 0.35;
          arr[i * 3 + 2] = 0.2 + Math.random() * 0.8;
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  updateNavLights(dt) {
    if (!this.navLightsGroup) return;
    if (this.isExploding) {
      this.navLightsGroup.visible = false;
      return;
    }
    this.navLightsGroup.visible = true;

    const span = this.modelDimensions.wingspan * 0.48;
    const len = this.modelDimensions.length * 0.48;
    const h = this.modelDimensions.height * 0.35;

    this.redNav.position.set(-span, 0, -len * 0.05);
    this.greenNav.position.set(span, 0, -len * 0.05);
    this.tailStrobe.position.set(0, h + 0.6, len * 0.82);

    // Strobe flash interval (bright 60ms pulse every 1.2s)
    const t = performance.now() % 1200;
    this.tailStrobe.intensity = (t < 75) ? 6.5 : 0;
  }

  destroy() {
    if (this.renderer?.domElement?.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose();
  }
}
