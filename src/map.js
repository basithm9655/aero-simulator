import * as Cesium from 'cesium';



// Wait for Google Maps 3D Library
async function waitForGoogleMaps(timeoutMs = 7000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (window.google?.maps?.importLibrary) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return !!(window.google?.maps?.importLibrary);
}

// Initialize Google Maps 3D Photorealistic Engine
export async function tryInitGoogle3D(start) {
  if (typeof window === 'undefined') return null;
  const gmapEl = document.getElementById('google3d');
  if (!gmapEl) return null;

  const isReady = await waitForGoogleMaps(7000);
  if (!isReady) {
    console.warn('Google Maps API not ready within timeout, falling back to Cesium');
    return null;
  }

  try {
    const { Marker3DElement } = await window.google.maps.importLibrary('maps3d');
    if (window.customElements && window.customElements.whenDefined) {
      await window.customElements.whenDefined('gmp-map-3d');
    }

    gmapEl.mode = 'HYBRID';
    gmapEl.center = { lat: start.lat, lng: start.lng, altitude: start.alt };
    gmapEl.range = 45;
    gmapEl.tilt = 76;
    gmapEl.heading = Number.isFinite(start.heading) ? start.heading : 50;
    gmapEl.roll = 0;
    gmapEl.fov = 60;

    let activeMarker = null;

    const controller = {
      type: 'google3d',
      engineName: 'GOOGLE 3D MAPS (PHOTOREALISTIC)',
      map: gmapEl,
      update: (lat, lng, alt, heading, pitch, roll, speedKt, cameraMode = 'follow') => {
        if (cameraMode === 'cockpit') {
          gmapEl.center = { lat, lng, altitude: alt + 1.2 };
          gmapEl.heading = heading;
          gmapEl.tilt = Math.max(30, Math.min(150, 88 - pitch));
          gmapEl.roll = -roll;
          gmapEl.range = 8;
        } else if (cameraMode === 'follow') {
          // GeoFS-style Stabilized Follow Camera:
          // Horizon remains level (roll = 0!), camera leads ahead and follows heading smoothly
          const yr = heading * Math.PI / 180;
          const look = 0.00018;
          gmapEl.center = {
            lat: lat + Math.cos(yr) * look,
            lng: lng + Math.sin(yr) * look,
            altitude: alt + 2.0
          };
          gmapEl.heading = heading;
          gmapEl.tilt = Math.max(64, Math.min(84, 75 - pitch * 0.25));
          gmapEl.roll = 0; // ZERO ROLL - Keep the horizon level during banking!
          gmapEl.range = Math.max(36, Math.min(68, 42 + (speedKt || 120) * 0.035 + Math.abs(roll) * 0.08));
          gmapEl.fov = 65;
        } else if (cameraMode === 'chase') {
          const yr = heading * Math.PI / 180;
          gmapEl.center = { lat: lat + Math.cos(yr) * 0.00012, lng: lng + Math.sin(yr) * 0.00012, altitude: alt + 1.5 };
          gmapEl.heading = heading;
          gmapEl.tilt = Math.max(58, Math.min(88, 76 - pitch * 0.45));
          gmapEl.roll = -roll * 0.4;
          gmapEl.range = 34;
        } else if (cameraMode === 'wing') {
          const yr = (heading + 10) * Math.PI / 180;
          gmapEl.center = { lat, lng, altitude: alt + 1.5 };
          gmapEl.heading = heading + 10;
          gmapEl.tilt = 72;
          gmapEl.roll = -roll * 0.25;
          gmapEl.range = 36;
        } else if (cameraMode === 'free') {
          gmapEl.center = { lat, lng, altitude: alt + 1.5 };
          gmapEl.heading = heading;
          gmapEl.tilt = 74;
          gmapEl.roll = 0;
          gmapEl.range = 42;
        }
      },
      setModel: () => {},
      setCheckpoint: (p) => {
        if (activeMarker) {
          activeMarker.remove?.();
          activeMarker = null;
        }
        activeMarker = new Marker3DElement({
          position: { lat: p.lat, lng: p.lng, altitude: p.alt || 500 },
          altitudeMode: 'ABSOLUTE',
          extruded: true,
          label: p.name,
          drawsWhenOccluded: true
        });
        gmapEl.append(activeMarker);
      },
      destroy: () => {
        if (activeMarker) activeMarker.remove();
      }
    };
    return controller;
  } catch (e) {
    console.warn('Google 3D Maps init failed, falling back to Cesium:', e);
    return null;
  }
}

// --- GEOFS 3.9 CESIUM 3D SATELLITE GLOBE ENGINE ---
export async function initCesiumFallback(container, start, cesiumToken = '') {
  Cesium.Ion.defaultAccessToken = String(cesiumToken || '').trim() || undefined;
  const viewer = new Cesium.Viewer(container, {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, vrButton: false,
    selectionIndicator: false, infoBox: false, creditContainer: document.createElement('div'),
    baseLayer: false, msaaSamples: 4
  });
  viewer.targetFrameRate = 60;
  const ssc = viewer.scene.screenSpaceCameraController;
  ssc.enableRotate = false; ssc.enableTranslate = false; ssc.enableZoom = false; ssc.enableTilt = false; ssc.enableLook = false;
  viewer.scene.globe.show = true;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.fog.enabled = true;
  viewer.scene.fog.density = 0.0001;
  viewer.scene.backgroundColor = Cesium.Color.BLACK;

  // Add GeoFS High-Resolution Global Satellite Imagery (ArcGIS World Imagery)
  try {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      credit: 'Esri, Maxar, Earthstar Geographics',
      maximumLevel: 19
    }));
  } catch (e) {
    console.warn('Satellite imagery failed:', e);
  }

  // Attempt Cesium 3D World Terrain & OSM 3D Buildings
  try {
    const terrain = await Cesium.createWorldTerrainAsync({
      requestVertexNormals: true,
      requestWaterMask: true
    });
    viewer.terrainProvider = terrain;
  } catch (e) {
    // Terrain fallback
  }

  try {
    const osmBuildings = await Cesium.createOsmBuildingsAsync();
    viewer.scene.primitives.add(osmBuildings);
  } catch (e) {
    // Buildings fallback
  }

  let activeMarkerEntity = null;

  const controller = {
    type: 'cesium',
    engineName: 'GEOFS 3.9 (CESIUM SATELLITE 3D)',
    viewer,
    update: (lat, lng, alt, heading, pitch, roll, speedKt, cameraMode = 'chase') => {
      if (cameraMode === 'cockpit') {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt + 1.2),
          orientation: {
            heading: Cesium.Math.toRadians(heading),
            pitch: Cesium.Math.toRadians(pitch),
            roll: Cesium.Math.toRadians(-roll)
          }
        });
      } else {
        const target = Cesium.Cartesian3.fromDegrees(lng, lat, alt + 2.0);
        const range = Math.max(32, 40 + Math.min(25, (speedKt || 120) * 0.04));
        viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(heading),
          Cesium.Math.toRadians(-14 - pitch * 0.3),
          range
        ));
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      }
    },
    setModel: () => {},
    setCheckpoint: (p) => {
      if (activeMarkerEntity) {
        viewer.entities.remove(activeMarkerEntity);
        activeMarkerEntity = null;
      }
      activeMarkerEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt || 550),
        point: {
          pixelSize: 14,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: p.name,
          font: '12px monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    },
    destroy: () => {
      viewer.destroy();
    }
  };
  return controller;
}
