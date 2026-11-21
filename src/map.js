import * as Cesium from 'cesium';

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
    gmapEl.fov = 65;

    let activeMarker = null;

    return {
      type: 'google3d',
      engineName: 'Google 3D Photorealistic',
      map: gmapEl,
      update: (lat, lng, alt, heading, pitch, roll, speedKt, cameraMode = 'follow') => {
        const safeAlt = Math.max(4, alt);
        if (cameraMode === 'cockpit') {
          gmapEl.center = { lat, lng, altitude: safeAlt + 1.8 };
          gmapEl.heading = heading;
          gmapEl.tilt = Math.max(25, Math.min(155, 89 - pitch));
          gmapEl.roll = -roll;
          gmapEl.range = 6;
          gmapEl.fov = 70;
        } else if (cameraMode === 'follow') {
          const yr = heading * Math.PI / 180;
          const look = 0.00018;
          gmapEl.center = {
            lat: lat + Math.cos(yr) * look,
            lng: lng + Math.sin(yr) * look,
            altitude: safeAlt + 2.2
          };
          gmapEl.heading = heading;
          gmapEl.tilt = Math.max(62, Math.min(85, 75 - pitch * 0.25));
          gmapEl.roll = 0;
          gmapEl.range = Math.max(36, Math.min(72, 42 + (speedKt || 120) * 0.035 + Math.abs(roll) * 0.08));
          gmapEl.fov = 65;
        } else if (cameraMode === 'chase') {
          const yr = heading * Math.PI / 180;
          gmapEl.center = {
            lat: lat + Math.cos(yr) * 0.00012,
            lng: lng + Math.sin(yr) * 0.00012,
            altitude: safeAlt + 1.6
          };
          gmapEl.heading = heading;
          gmapEl.tilt = Math.max(56, Math.min(88, 76 - pitch * 0.45));
          gmapEl.roll = -roll * 0.4;
          gmapEl.range = 34;
          gmapEl.fov = 70;
        } else if (cameraMode === 'wing') {
          gmapEl.center = { lat, lng, altitude: safeAlt + 1.5 };
          gmapEl.heading = (heading + 12) % 360;
          gmapEl.tilt = 73;
          gmapEl.roll = -roll * 0.25;
          gmapEl.range = 36;
          gmapEl.fov = 62;
        } else if (cameraMode === 'free') {
          gmapEl.center = { lat, lng, altitude: safeAlt + 1.5 };
          gmapEl.heading = heading;
          gmapEl.tilt = 74;
          gmapEl.roll = 0;
          gmapEl.range = 42;
          gmapEl.fov = 65;
        }
      },
      setTimeOfDay: () => {},
      setCheckpoint: p => {
        if (!p) return;
        if (activeMarker) {
          activeMarker.remove?.();
          activeMarker = null;
        }
        try {
          activeMarker = new Marker3DElement({
            position: { lat: p.lat, lng: p.lng, altitude: p.alt || 500 },
            altitudeMode: 'ABSOLUTE',
            extruded: true,
            label: p.name,
            drawsWhenOccluded: true
          });
          gmapEl.append(activeMarker);
        } catch (_) {}
      },
      destroy: () => {
        if (activeMarker) activeMarker.remove?.();
      }
    };
  } catch (e) {
    console.warn('Google 3D Maps init failed, falling back to Cesium:', e);
    return null;
  }
}

// Cesium Satellite 3D Globe Engine (Fallback & Optional Mode)
export async function initCesiumFallback(container, start, cesiumToken = '') {
  Cesium.Ion.defaultAccessToken = String(cesiumToken || '').trim() || undefined;
  const viewer = new Cesium.Viewer(container, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    selectionIndicator: false,
    infoBox: false,
    creditContainer: document.createElement('div'),
    baseLayer: false,
    msaaSamples: 4
  });

  viewer.targetFrameRate = 60;
  const ssc = viewer.scene.screenSpaceCameraController;
  ssc.enableRotate = false;
  ssc.enableTranslate = false;
  ssc.enableZoom = false;
  ssc.enableTilt = false;
  ssc.enableLook = false;

  viewer.scene.globe.show = true;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.fog.enabled = true;
  viewer.scene.fog.density = 0.00009;
  viewer.scene.backgroundColor = Cesium.Color.BLACK;

  try {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      credit: 'Esri, Maxar, Earthstar Geographics',
      maximumLevel: 19
    }));
  } catch (e) {
    console.warn('Satellite imagery note:', e);
  }

  try {
    const terrain = await Cesium.createWorldTerrainAsync({
      requestVertexNormals: true,
      requestWaterMask: true
    });
    viewer.terrainProvider = terrain;
  } catch (_) {}

  try {
    const osmBuildings = await Cesium.createOsmBuildingsAsync();
    viewer.scene.primitives.add(osmBuildings);
  } catch (_) {}

  let activeMarkerEntity = null;

  return {
    type: 'cesium',
    engineName: 'Satellite 3D Globe',
    viewer,
    update: (lat, lng, alt, heading, pitch, roll, speedKt, cameraMode = 'follow') => {
      const safeAlt = Math.max(4, alt);
      if (cameraMode === 'cockpit') {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(lng, lat, safeAlt + 1.8),
          orientation: {
            heading: Cesium.Math.toRadians(heading),
            pitch: Cesium.Math.toRadians(pitch),
            roll: Cesium.Math.toRadians(-roll)
          }
        });
      } else {
        const target = Cesium.Cartesian3.fromDegrees(lng, lat, safeAlt + 2.2);
        const range = Math.max(32, 40 + Math.min(28, (speedKt || 120) * 0.04));
        viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(heading),
          Cesium.Math.toRadians(-14 - pitch * 0.3),
          range
        ));
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      }
    },
    setTimeOfDay: mode => {
      const hourUtc = mode === 'night' ? 20 : mode === 'sunset' ? 12.5 : 6.5;
      const d = new Date(Date.UTC(2026, 5, 21, Math.floor(hourUtc), Math.round((hourUtc % 1) * 60), 0));
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(d);
    },
    setCheckpoint: p => {
      if (!p) return;
      if (activeMarkerEntity) {
        viewer.entities.remove(activeMarkerEntity);
        activeMarkerEntity = null;
      }
      activeMarkerEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.alt || 550),
        point: {
          pixelSize: 12,
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
}
