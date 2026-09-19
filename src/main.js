import './styles.css';
import { FlightModel } from './flight.js';
import { FlightAudio } from './audio.js';
import { FlightInstruments } from './instruments.js';
import { tryInitGoogle3D, initCesiumFallback } from './map.js';
import { Aircraft3D } from './aircraft3d.js';

export const WORLD_LOCATIONS = [
  {
    id: 'cjb_runway',
    name: 'COIMBATORE AIRPORT (RUNWAY 05)',
    city: 'Coimbatore, India',
    desc: 'Take off directly from Runway 05 tarmac heading 050° across Coimbatore toward Nilgiris',
    lat: 11.0223,
    lng: 77.0360,
    alt: 404,
    groundElev: 404,
    heading: 50,
    onRunway: true,
    initialSpeed: 10,
    route: [
      { name: 'RUNWAY 05', lat: 11.0223, lng: 77.0360, alt: 404, txt: 'LINE UP & FULL THROTTLE RUNWAY 05' },
      { name: 'CODISSIA', lat: 11.0345, lng: 77.0490, alt: 750, txt: 'CLIMBOUT VIA CODISSIA (750m)' },
      { name: 'PSG TECH', lat: 11.0255, lng: 77.0039, alt: 1100, txt: 'PASS OVER PSG TECH CAMPUS' },
      { name: 'MARUDHAMALAI', lat: 11.0458, lng: 76.8519, alt: 1400, txt: 'FOOTHILLS OF WESTERN GHATS' }
    ]
  },
  {
    id: 'cjb_airborne',
    name: 'COIMBATORE CITY CRUISE (1250M)',
    city: 'Coimbatore, India',
    desc: 'High-altitude scenic cruise over Coimbatore smart city and Nilgiri foothills',
    lat: 11.025546,
    lng: 77.003978,
    alt: 1250,
    groundElev: 410,
    heading: 90,
    onRunway: false,
    initialSpeed: 165,
    route: [
      { name: 'PSG TECH', lat: 11.025546, lng: 77.003978, alt: 1250, txt: 'DEPART PSG TECH (1250m)' },
      { name: 'CODISSIA', lat: 11.03049, lng: 77.02819, alt: 1300, txt: 'CRUISE CODISSIA SECTOR (1300m)' },
      { name: 'COIMBATORE AIRPORT', lat: 11.02636, lng: 77.04100, alt: 1250, txt: 'AIRPORT SECTOR CORRIDOR (1250m)' },
      { name: 'SINGANALLUR', lat: 11.00242, lng: 77.02909, alt: 1350, txt: 'PASS SINGANALLUR LAKE' }
    ]
  },
  {
    id: 'nyc',
    name: 'NEW YORK CITY (MANHATTAN 3D)',
    city: 'New York, USA',
    desc: 'Fly through photorealistic 3D skyscrapers, Empire State Building, Central Park & One WTC',
    lat: 40.7128,
    lng: -74.0060,
    alt: 450,
    groundElev: 10,
    heading: 30,
    onRunway: false,
    initialSpeed: 175,
    route: [
      { name: 'ONE WTC', lat: 40.7127, lng: -74.0134, alt: 450, txt: 'PASS FREEDOM TOWER (450m)' },
      { name: 'EMPIRE STATE', lat: 40.7484, lng: -73.9857, alt: 520, txt: 'FLY BY EMPIRE STATE BUILDING' },
      { name: 'CENTRAL PARK', lat: 40.78509, lng: -73.96828, alt: 500, txt: 'CRUISE OVER CENTRAL PARK' },
      { name: 'BROOKLYN BRIDGE', lat: 40.7061, lng: -73.9969, alt: 350, txt: 'EAST RIVER & BRIDGES' }
    ]
  },
  {
    id: 'sfo',
    name: 'SAN FRANCISCO (GOLDEN GATE)',
    city: 'California, USA',
    desc: 'Fly under or over Golden Gate Bridge, Alcatraz Island, and downtown San Francisco 3D hills',
    lat: 37.8199,
    lng: -122.4783,
    alt: 350,
    groundElev: 5,
    heading: 115,
    onRunway: false,
    initialSpeed: 170,
    route: [
      { name: 'GOLDEN GATE', lat: 37.8199, lng: -122.4783, alt: 350, txt: 'GOLDEN GATE BRIDGE APPROACH' },
      { name: 'ALCATRAZ', lat: 37.8269, lng: -122.4229, alt: 300, txt: 'PASS ALCATRAZ ISLAND' },
      { name: 'TRANSAMERICA', lat: 37.7952, lng: -122.4028, alt: 420, txt: 'DOWNTOWN 3D PYRAMID' },
      { name: 'BAY BRIDGE', lat: 37.7983, lng: -122.3778, alt: 320, txt: 'OAKLAND BAY BRIDGE' }
    ]
  },
  {
    id: 'tokyo',
    name: 'TOKYO (SHINJUKU & SHIBUYA)',
    city: 'Tokyo, Japan',
    desc: 'Ultra-dense photorealistic 3D high-rises, Tokyo Tower, and Mount Fuji horizon',
    lat: 35.6895,
    lng: 139.6917,
    alt: 480,
    groundElev: 35,
    heading: 135,
    onRunway: false,
    initialSpeed: 175,
    route: [
      { name: 'SHINJUKU 3D', lat: 35.6895, lng: 139.6917, alt: 480, txt: 'METROPOLITAN TOWERS' },
      { name: 'SHIBUYA CROSSING', lat: 35.6595, lng: 139.7005, alt: 420, txt: 'SHIBUYA 3D CANYON' },
      { name: 'TOKYO TOWER', lat: 35.6586, lng: 139.7454, alt: 450, txt: 'TOKYO TOWER FLYOVER' },
      { name: 'RAINBOW BRIDGE', lat: 35.6366, lng: 139.7631, alt: 350, txt: 'TOKYO BAY & ODAIBA' }
    ]
  },
  {
    id: 'paris',
    name: 'PARIS (EIFFEL TOWER & SEINE)',
    city: 'Paris, France',
    desc: 'Stunning 3D photogrammetry of Eiffel Tower, Louvre Museum, and Arc de Triomphe',
    lat: 48.8584,
    lng: 2.2945,
    alt: 380,
    groundElev: 35,
    heading: 45,
    onRunway: false,
    initialSpeed: 165,
    route: [
      { name: 'EIFFEL TOWER', lat: 48.8584, lng: 2.2945, alt: 380, txt: 'EIFFEL TOWER PASS (380m)' },
      { name: 'CHAMPS-ELYSEES', lat: 48.8698, lng: 2.3075, alt: 350, txt: 'AVENUE DES CHAMPS-ELYSEES' },
      { name: 'LOUVRE', lat: 48.8606, lng: 2.3376, alt: 320, txt: 'LOUVRE PYRAMID & SEINE' },
      { name: 'NOTRE-DAME', lat: 48.8530, lng: 2.3499, alt: 320, txt: 'ILE DE LA CITE' }
    ]
  },
  {
    id: 'dubai',
    name: 'DUBAI (BURJ KHALIFA & MARINA)',
    city: 'Dubai, UAE',
    desc: 'Soar past the world tallest 3D skyscraper Burj Khalifa and futuristic skyline',
    lat: 25.1972,
    lng: 55.2744,
    alt: 650,
    groundElev: 10,
    heading: 30,
    onRunway: false,
    initialSpeed: 180,
    route: [
      { name: 'BURJ KHALIFA', lat: 25.1972, lng: 55.2744, alt: 650, txt: 'BURJ KHALIFA (828m SPIRE)' },
      { name: 'DOWNTOWN DUBAI', lat: 25.2048, lng: 55.2708, alt: 550, txt: 'SHEIKH ZAYED ROAD 3D' },
      { name: 'DUBAI FRAME', lat: 25.2345, lng: 55.3003, alt: 450, txt: 'GOLDEN DUBAI FRAME' },
      { name: 'PALM JUMEIRAH', lat: 25.1124, lng: 55.1390, alt: 450, txt: 'PALM ISLAND FLYOVER' }
    ]
  },
  {
    id: 'london',
    name: 'LONDON (THAMES & BIG BEN)',
    city: 'London, UK',
    desc: 'Historic Westminster, Big Ben, London Eye, Tower Bridge, and Shard in 3D',
    lat: 51.5033,
    lng: -0.1195,
    alt: 380,
    groundElev: 15,
    heading: 75,
    onRunway: false,
    initialSpeed: 165,
    route: [
      { name: 'LONDON EYE', lat: 51.5033, lng: -0.1195, alt: 380, txt: 'LONDON EYE & BIG BEN' },
      { name: 'THE SHARD', lat: 51.5045, lng: -0.0865, alt: 420, txt: 'THE SHARD GLASS TOWER' },
      { name: 'TOWER BRIDGE', lat: 51.5055, lng: -0.0754, alt: 320, txt: 'TOWER BRIDGE APPROACH' },
      { name: 'CANARY WHARF', lat: 51.5050, lng: -0.0200, alt: 400, txt: 'DOCKLANDS FINANCIAL CANYON' }
    ]
  }
];

let currentLocationIdx = 0;
let START = WORLD_LOCATIONS[0];
let ROUTE = WORLD_LOCATIONS[0].route;

// Authentic GeoFS 3.9 Aircraft Fleet featuring user's authentic textures & 3D models
const AIRCRAFT_FLEET = [
  {
    id: 'a380',
    name: 'AIRBUS A380-800 (EMIRATES)',
    label: '✈ A380 EMIRATES',
    modelUrl: '/a380.glb',
    texture: '/textures/texture-low_0.jpg',
    specular: '/textures/specular.jpg',
    reflection: '/textures/reflection.jpg',
    thumb: '/textures/texture-low_0.jpg',
    scale: 0.95,
    cameraDist: 58,
    cameraElevation: 11,
    mass: 560000,
    cruiseKnots: 490,
    maxKnots: 560,
    stallKnots: 135,
    dragFactor: 0.85,
    type: 'Quad-Engine Superjumbo Commercial Jet (Emirates Livery)',
    engines: 4
  },
  {
    id: 'f16',
    name: 'GENERAL DYNAMICS F-16 FALCON',
    label: '✈ F-16 THUNDERBIRD',
    modelUrl: '/f16.glb',
    texture: '/textures/texture-low.jpg',
    specular: '/textures/specular.jpg',
    reflection: '/textures/reflection.jpg',
    thumb: '/textures/texture-low.jpg',
    scale: 1.5,
    cameraDist: 22,
    cameraElevation: 4.5,
    mass: 12000,
    cruiseKnots: 540,
    maxKnots: 1320,
    stallKnots: 110,
    dragFactor: 0.50,
    type: 'Single-Engine Supersonic Multirole Fighter (USAF Thunderbirds)',
    engines: 1
  },
  {
    id: 'phenom',
    name: 'EMBRAER PHENOM 100',
    label: '✈ PHENOM 100',
    modelUrl: '/phenom.glb',
    texture: '/textures/texture-low (1).jpg',
    specular: '/textures/specular.jpg',
    reflection: '/textures/reflection.jpg',
    thumb: '/textures/texture-low (1).jpg',
    scale: 1.4,
    cameraDist: 24,
    cameraElevation: 5.0,
    mass: 4750,
    cruiseKnots: 390,
    maxKnots: 470,
    stallKnots: 82,
    dragFactor: 0.42,
    type: 'Very Light Twin-Engine Executive Business Jet (Executive Edition)',
    engines: 2
  }
];
let currentAircraftIdx = 0;
let aircraft3D = null;

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
};
const RAD = Math.PI / 180;

let worldEngine = null;
let running = false;
let lastTime = 0;
let routeIndex = 1;
const CAMERA_MODES = ['follow', 'cockpit', 'chase', 'wing', 'free'];
let cameraMode = 'follow'; // Default mode: Stabilized GeoFS Follow Camera
let autopilot = false;
let flapState = 0; // 0 = 0 deg, 1 = 15 deg, 2 = 30 deg

const keys = {};
const mouseFlight = { enabled: false, pitch: 0, roll: 0 };
const screenYoke = { active: false, pitch: 0, roll: 0 };
let crashResetTimer = null;
const fdm = new FlightModel();
const audio = new FlightAudio();
let instruments = null;

function metersPerDeg(lat) {
  const r = lat * RAD;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * r) + 1.175 * Math.cos(4 * r),
    lng: 111412.84 * Math.cos(r) - 93.5 * Math.cos(3 * r)
  };
}

function dist(a, b) {
  const m = metersPerDeg((a.lat + b.lat) / 2);
  return Math.hypot((b.lng - a.lng) * m.lng, (b.lat - a.lat) * m.lat);
}

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

function flightLat() {
  return START.lat + fdm.s.pos.x / metersPerDeg(START.lat).lat;
}
function flightLng() {
  return START.lng + fdm.s.pos.y / metersPerDeg(START.lat).lng;
}

function computeAutopilot(curLat, curLng, curAlt, curHdg) {
  const target = ROUTE[routeIndex];
  const m = metersPerDeg(curLat);
  const dNorth = (target.lat - curLat) * m.lat;
  const dEast = (target.lng - curLng) * m.lng;
  const targetBearing = (Math.atan2(dEast, dNorth) * (180 / Math.PI) + 360) % 360;
  
  let headingDiff = (targetBearing - curHdg + 540) % 360 - 180;
  const desiredRoll = clamp(headingDiff * 1.6, -38, 38);
  const targetAlt = target.alt || 1250;
  const desiredPitch = clamp((targetAlt - curAlt) * 0.08, -10, 12);

  return {
    pitch: desiredPitch / 24,
    roll: desiredRoll / 48,
    yaw: clamp(headingDiff / 45, -0.6, 0.6),
    throttle: 0.65
  };
}

function input() {
  if (autopilot) {
    return computeAutopilot(flightLat(), flightLng(), fdm.s.alt, fdm.attitude.yaw);
  }

  // 1. Direct screen click-and-drag flight yoke
  if (screenYoke.active) {
    const pitchKey = (keys.w || keys.arrowup ? -0.8 : 0) + (keys.s || keys.arrowdown ? 0.8 : 0);
    const rollKey = (keys.a || keys.arrowleft ? -0.8 : 0) + (keys.d || keys.arrowright ? 0.8 : 0);
    return {
      pitch: clamp(screenYoke.pitch + pitchKey, -1, 1),
      roll: clamp(screenYoke.roll + rollKey, -1, 1),
      yaw: (keys.q ? -1 : 0) + (keys.e ? 1 : 0),
      throttle: fdm.controls.throttle
    };
  }

  // 2. Smooth mouse flight yoke
  if (mouseFlight.enabled && (Math.abs(mouseFlight.pitch) > 0.02 || Math.abs(mouseFlight.roll) > 0.02)) {
    const pitchKey = (keys.w || keys.arrowup ? -0.8 : 0) + (keys.s || keys.arrowdown ? 0.8 : 0);
    const rollKey = (keys.a || keys.arrowleft ? -0.8 : 0) + (keys.d || keys.arrowright ? 0.8 : 0);
    return {
      pitch: clamp(mouseFlight.pitch + pitchKey, -1, 1),
      roll: clamp(mouseFlight.roll + rollKey, -1, 1),
      yaw: (keys.q ? -1 : 0) + (keys.e ? 1 : 0),
      throttle: fdm.controls.throttle
    };
  }

  // 3. Standard keyboard flight controls (WASD or Arrow Keys)
  const pitchKey = (keys.s || keys.arrowdown ? 1 : 0) + (keys.w || keys.arrowup ? -1 : 0);
  const rollKey = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
  return {
    pitch: pitchKey,
    roll: rollKey,
    yaw: (keys.q ? -1 : 0) + (keys.e ? 1 : 0),
    throttle: fdm.controls.throttle
  };
}

function updateMission() {
  const p = ROUTE[routeIndex];
  const d = dist({ lat: flightLat(), lng: flightLng() }, p);
  $('missionTitle').textContent = 'MISSION // ' + p.txt;
  $('missionSub').textContent = d < 350
    ? 'CHECKPOINT ACQUIRED — PROCEED TO NEXT SECTOR'
    : `NAV ${(d / 1000).toFixed(1)} km · ${p.name}`;

  if (d < 350) {
    routeIndex = (routeIndex + 1) % ROUTE.length;
    worldEngine?.setCheckpoint(ROUTE[routeIndex]);
    toast('WAYPOINT REACHED: ' + p.name);
    audio.playClick();
  }
}

function hud(a) {
  const att = a.euler;
  $('alt').textContent = String(Math.round(fdm.s.alt * 3.28084)).padStart(4, '0');
  $('ias').textContent = String(Math.round(a.ias)).padStart(3, '0');
  $('hdg').textContent = String(Math.round((att.yaw + 360) % 360)).padStart(3, '0');
  $('vs').textContent = (a.vs >= 0 ? '+' : '') + String(a.vs);
  $('pitch').textContent = (att.pitch >= 0 ? '+' : '') + att.pitch.toFixed(1);
  $('roll').textContent = (att.roll >= 0 ? '+' : '') + att.roll.toFixed(1);
  $('gload').textContent = a.g.toFixed(2);
  $('thr').textContent = String(Math.round(fdm.controls.throttle * 100)).padStart(2, '0');

  // Update on-screen throttle slider
  if ($('thrFill')) $('thrFill').style.height = (fdm.controls.throttle * 100) + '%';
  if ($('thrVal')) $('thrVal').textContent = Math.round(fdm.controls.throttle * 100) + '%';

  // Stall alert HUD
  $('stallWarn').classList.toggle('hidden', !a.stall);

  // Artificial Horizon in Cockpit View
  const hz = $('horizon');
  if (hz) {
    hz.classList.toggle('hidden', cameraMode !== 'cockpit');
    if (cameraMode === 'cockpit') {
      hz.style.transform = `translate(-50%, calc(-50% + ${att.pitch * 3.2}px)) rotate(${-att.roll}deg)`;
    }
  }

  // Draw Primary Flight Instruments (Speedometer, Attitude, Altimeter)
  if (instruments) {
    instruments.draw({
      ias: a.ias,
      altFt: fdm.s.alt * 3.28084,
      pitch: att.pitch,
      roll: att.roll,
      hdg: att.yaw,
      vs: a.vs,
      thr: fdm.controls.throttle,
      g: a.g
    });
  }
}

function updateWorld() {
  if (!worldEngine) return;
  const att = fdm.attitude;
  const lat = flightLat();
  const lng = flightLng();
  const alt = Math.max(12, fdm.s.alt);
  worldEngine.update(lat, lng, alt, att.yaw, att.pitch, att.roll, fdm.ias, cameraMode);
}



// Dual 3D Engine Controllers: Google 3D (Photorealistic) & GeoFS 3.9 (Cesium Satellite 3D)
let googleController = null;
let cesiumController = null;
let currentEngineType = 'google3d';

async function toggleEngine() {
  const curPos = { lat: flightLat(), lng: flightLng(), alt: fdm.s.alt };
  if (currentEngineType === 'google3d') {
    $('google3d').classList.add('hidden');
    $('cesiumContainer').classList.remove('hidden');
    if (!cesiumController) {
      toast('LOADING GEOFS 3.9 CESIUM 3D...');
      cesiumController = await initCesiumFallback($('cesiumContainer'), curPos);
    }
    worldEngine = cesiumController;
    currentEngineType = 'cesium';
    if ($('engineBtn')) $('engineBtn').textContent = '3D: GEOFS';
    toast('3D ENGINE: GEOFS 3.9 (CESIUM SATELLITE 3D)');
  } else {
    $('cesiumContainer').classList.add('hidden');
    $('google3d').classList.remove('hidden');
    if (!googleController) {
      toast('LOADING GOOGLE 3D...');
      googleController = await tryInitGoogle3D(curPos);
    }
    worldEngine = googleController;
    currentEngineType = 'google3d';
    if ($('engineBtn')) $('engineBtn').textContent = '3D: GOOGLE';
    toast('3D ENGINE: GOOGLE 3D (PHOTOREALISTIC)');
  }
  worldEngine?.setCheckpoint(ROUTE[routeIndex]);
  audio.playClick();
}

// Fleet Hangar and Aircraft Controller
function renderHangar() {
  const grid = $('fleetGrid');
  if (!grid) return;
  grid.innerHTML = AIRCRAFT_FLEET.map((p, idx) => `
    <div class="fleet-card ${idx === currentAircraftIdx ? 'active' : ''}" data-idx="${idx}">
      <img src="${p.thumb || p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <div class="fleet-type">${p.type}</div>
      <div class="fleet-specs">
        <div>MASS: <span>${(p.mass / 1000).toFixed(1)} t</span></div>
        <div>CRUISE: <span>${p.cruiseKnots} KT</span></div>
        <div>MAX: <span>${p.maxKnots} KT</span></div>
        <div>STALL: <span>${p.stallKnots} KT</span></div>
      </div>
      <button class="fleet-select-btn">${idx === currentAircraftIdx ? 'ACTIVE' : 'SELECT & FLY'}</button>
    </div>
  `).join('');

  grid.querySelectorAll('.fleet-card').forEach(card => {
    card.onclick = () => {
      const idx = Number(card.dataset.idx);
      selectAircraft(idx);
      closeHangar();
    };
  });
}

async function selectAircraft(idx) {
  currentAircraftIdx = idx;
  const plane = AIRCRAFT_FLEET[currentAircraftIdx];
  if ($('planeBtn')) $('planeBtn').textContent = plane.label;

  // Set aerodynamic flight specs
  fdm.setSpecs(plane);

  // Load 3D aircraft model in Three.js with authentic GeoFS textures
  if (aircraft3D) {
    await aircraft3D.loadAircraft(plane);
  }

  renderHangar();
  toast('AIRCRAFT: ' + plane.name);
  audio.playClick();
}

function openHangar() {
  renderHangar();
  $('hangarModal')?.classList.remove('hidden');
  audio.playClick();
}

function closeHangar() {
  $('hangarModal')?.classList.add('hidden');
  audio.playClick();
}

function toggleAircraft() {
  openHangar();
}

// Location Switcher System (Coimbatore Runway, New York, San Francisco, Tokyo, Paris, Dubai, London)
function renderLocations() {
  const grid = $('locationGrid');
  if (!grid) return;
  grid.innerHTML = '';

  WORLD_LOCATIONS.forEach((loc, idx) => {
    const card = document.createElement('div');
    card.className = 'location-item' + (idx === currentLocationIdx ? ' active' : '');
    card.innerHTML = `
      <div>
        <span class="location-badge">${loc.onRunway ? '🛫 RUNWAY 05 TAKEOFF' : '✈ AIRBORNE 3D'}</span>
        <h3>${loc.name}</h3>
        <small style="display:block; color: var(--cyan); margin-bottom: 6px; font-weight: bold;">${loc.city}</small>
        <p>${loc.desc}</p>
      </div>
      <button class="location-select-btn">${idx === currentLocationIdx ? '✓ CURRENT LOCATION' : 'FLY HERE'}</button>
    `;
    card.onclick = () => selectLocation(idx);
    grid.appendChild(card);
  });
}

function selectLocation(idx) {
  currentLocationIdx = idx;
  START = WORLD_LOCATIONS[idx];
  ROUTE = START.route;
  routeIndex = 1;

  if (aircraft3D) aircraft3D.resetExplosion();
  const flashEl = $('crashFlash');
  if (flashEl) flashEl.classList.remove('active');
  const appEl = $('app');
  if (appEl) appEl.classList.remove('screen-shake');

  const initThr = START.onRunway ? 0.85 : 0.60;
  fdm.reset(START.alt, START.heading, START.onRunway, START.groundElev, START.initialSpeed, initThr);
  if ($('thrFill')) $('thrFill').style.height = (initThr * 100) + '%';
  if ($('thrVal')) $('thrVal').textContent = Math.round(initThr * 100) + '%';
  mouseFlight.pitch = 0;
  mouseFlight.roll = 0;
  screenYoke.pitch = 0;
  screenYoke.roll = 0;
  const crossDot = document.querySelector('.crosshair i');
  if (crossDot) crossDot.style.transform = 'translate(-50%, -50%)';

  if (worldEngine?.map) {
    worldEngine.map.center = { lat: START.lat, lng: START.lng, altitude: START.alt };
    worldEngine.map.heading = START.heading;
  }
  worldEngine?.setCheckpoint(ROUTE[1]);

  // Update Top-Right Location Button text
  const shortName = START.name.split('(')[0].trim();
  if ($('locationBtn')) {
    $('locationBtn').textContent = `📍 ${shortName} ▾`;
  }

  // Update Mission HUD
  if ($('missionTitle')) $('missionTitle').textContent = `MISSION // ${ROUTE[0]?.name || 'DEPART'}`;
  if ($('missionSub')) $('missionSub').textContent = ROUTE[0]?.txt || 'INITIAL WAYPOINT';

  renderLocations();
  closeLocationModal();

  toast(START.onRunway ? `🛫 LINED UP // ${START.name}` : `📍 ARRIVED // ${START.name}`);
  audio.playClick();
}

function openLocationModal() {
  renderLocations();
  $('locationModal')?.classList.remove('hidden');
  audio.playClick();
}

function closeLocationModal() {
  $('locationModal')?.classList.add('hidden');
  audio.playClick();
}

function cycleCamera(targetMode = null) {
  if (targetMode && CAMERA_MODES.includes(targetMode)) {
    cameraMode = targetMode;
  } else {
    const curIdx = CAMERA_MODES.indexOf(cameraMode);
    cameraMode = CAMERA_MODES[(curIdx + 1) % CAMERA_MODES.length];
  }
  if ($('viewBtn')) $('viewBtn').textContent = 'VIEW: ' + cameraMode.toUpperCase();
  if (aircraft3D) {
    aircraft3D.setCameraMode(cameraMode);
    aircraft3D.update(fdm.attitude, fdm.ias, fdm.last.g, fdm.controls.engine, cameraMode, 0.016);
  }
  toast('CAMERA // ' + cameraMode.toUpperCase());
  audio.playClick();
}

function toggleSound() {
  const isMuted = audio.toggleMute();
  $('soundBtn').textContent = isMuted ? 'SOUND: OFF' : 'SOUND: ON';
  $('soundBtn').classList.toggle('active', !isMuted);
  toast(isMuted ? 'AUDIO MUTED' : 'AUDIO ACTIVE');
}

function toggleAirbrake() {
  fdm.controls.airbrake = fdm.controls.airbrake ? 0 : 1;
  const label = fdm.controls.airbrake ? 'BRAKE: ON' : 'BRAKE: OFF';
  $('brakeBtn').textContent = label;
  $('brakeBtn').classList.toggle('active', !!fdm.controls.airbrake);
  toast(fdm.controls.airbrake ? 'AIRBRAKES DEPLOYED' : 'AIRBRAKES STOWED');
  audio.playClick();
}

function cycleFlaps() {
  flapState = (flapState + 1) % 3;
  const label = flapState === 2 ? '30°' : flapState === 1 ? '15°' : '0°';
  $('flapBtn').textContent = 'FLAPS: ' + label;
  $('flapBtn').classList.toggle('active', flapState > 0);
  toast('FLAPS: ' + label);
  audio.playClick();
}

function toggleMouseFlight() {
  mouseFlight.enabled = !mouseFlight.enabled;
  mouseFlight.pitch = 0;
  mouseFlight.roll = 0;
  const crossDot = document.querySelector('.crosshair i');
  if (crossDot) crossDot.style.transform = 'translate(-50%, -50%)';
  $('mouseBtn').classList.toggle('active', mouseFlight.enabled);
  $('mouseBtn').textContent = mouseFlight.enabled ? 'MOUSE: ON' : 'MOUSE: OFF';
  toast(mouseFlight.enabled ? 'MOUSE STEER ON (MOVE CURSOR)' : 'MOUSE STEER OFF (CLICK/DRAG)');
}

function setThrottle(val) {
  fdm.controls.throttle = clamp(val, 0, 1);
  if ($('thrFill')) $('thrFill').style.height = (fdm.controls.throttle * 100) + '%';
  if ($('thrVal')) $('thrVal').textContent = Math.round(fdm.controls.throttle * 100) + '%';
  toast('THROTTLE: ' + Math.round(fdm.controls.throttle * 100) + '%');
  audio.playClick();
}

function resetFlight() {
  if (aircraft3D) aircraft3D.resetExplosion();
  const flashEl = $('crashFlash');
  if (flashEl) flashEl.classList.remove('active');
  const appEl = $('app');
  if (appEl) appEl.classList.remove('screen-shake');

  const initThr = START.onRunway ? 0.85 : 0.60;
  fdm.reset(START.alt, START.heading, START.onRunway, START.groundElev, START.initialSpeed, initThr);
  if ($('thrFill')) $('thrFill').style.height = (initThr * 100) + '%';
  if ($('thrVal')) $('thrVal').textContent = Math.round(initThr * 100) + '%';
  mouseFlight.pitch = 0;
  mouseFlight.roll = 0;
  screenYoke.pitch = 0;
  screenYoke.roll = 0;
  const crossDot = document.querySelector('.crosshair i');
  if (crossDot) crossDot.style.transform = 'translate(-50%, -50%)';

  routeIndex = 1;
  worldEngine?.setCheckpoint(ROUTE[1]);
  toast(START.onRunway ? 'FLIGHT RESET // RUNWAY 05' : 'FLIGHT RESET // AIRBORNE');
  audio.playClick();
}

// Direct Screen Click & Drag Flight Yoke
function initScreenClickControls() {
  const yokeEl = $('clickYoke');
  const nubEl = $('clickNub');
  let startX = 0, startY = 0;

  window.addEventListener('pointerdown', e => {
    if (!$('boot') || !$('boot').classList.contains('hidden')) return;
    if (e.target.closest && (
      e.target.closest('.hud-panel') ||
      e.target.closest('.hud-actions') ||
      e.target.closest('.screen-throttle') ||
      e.target.closest('button')
    )) return;

    screenYoke.active = true;
    startX = e.clientX;
    startY = e.clientY;
    if (yokeEl) {
      yokeEl.style.left = startX + 'px';
      yokeEl.style.top = startY + 'px';
      yokeEl.classList.remove('hidden');
    }
    if (nubEl) {
      nubEl.style.transform = 'translate(-50%, -50%)';
    }
  });

  window.addEventListener('pointermove', e => {
    if (!screenYoke.active) return;
    const maxDist = 55;
    const dx = clamp((e.clientX - startX) / maxDist, -1, 1);
    const dy = clamp((e.clientY - startY) / maxDist, -1, 1);

    screenYoke.roll = dx;
    screenYoke.pitch = -dy; // pull down = pitch up

    if (nubEl) {
      nubEl.style.transform = `translate(calc(-50% + ${dx * 28}px), calc(-50% + ${dy * 28}px))`;
    }
  });

  const endDrag = () => {
    if (!screenYoke.active) return;
    screenYoke.active = false;
    screenYoke.pitch = 0;
    screenYoke.roll = 0;
    if (yokeEl) yokeEl.classList.add('hidden');
  };

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // On-screen throttle track click/drag
  const track = $('thrTrack');
  if (track) {
    let trackDragging = false;
    const updateThr = ev => {
      const rect = track.getBoundingClientRect();
      const ratio = 1 - (ev.clientY - rect.top) / rect.height;
      setThrottle(ratio);
    };
    track.addEventListener('pointerdown', ev => {
      trackDragging = true;
      track.setPointerCapture(ev.pointerId);
      updateThr(ev);
    });
    track.addEventListener('pointermove', ev => {
      if (trackDragging) updateThr(ev);
    });
    const stopTrack = () => { trackDragging = false; };
    track.addEventListener('pointerup', stopTrack);
    track.addEventListener('pointercancel', stopTrack);
  }

  // Throttle preset buttons
  if ($('thrMax')) $('thrMax').onclick = () => setThrottle(1.0);
  if ($('thrCruise')) $('thrCruise').onclick = () => setThrottle(0.60);
  if ($('thrIdle')) $('thrIdle').onclick = () => setThrottle(0.15);

  // Flight action buttons
  if ($('engineBtn')) $('engineBtn').onclick = toggleEngine;
  if ($('planeBtn')) $('planeBtn').onclick = toggleAircraft;
  if ($('hangarBtn')) $('hangarBtn').onclick = openHangar;
  if ($('closeHangarBtn')) $('closeHangarBtn').onclick = closeHangar;
  if ($('locationBtn')) $('locationBtn').onclick = openLocationModal;
  if ($('closeLocationBtn')) $('closeLocationBtn').onclick = closeLocationModal;
  if ($('welcomeLocationBtn')) $('welcomeLocationBtn').onclick = openLocationModal;
  if ($('brakeBtn')) $('brakeBtn').onclick = toggleAirbrake;
  if ($('flapBtn')) $('flapBtn').onclick = cycleFlaps;
  if ($('viewBtn')) $('viewBtn').onclick = () => cycleCamera();
  if ($('mouseBtn')) $('mouseBtn').onclick = toggleMouseFlight;
  if ($('soundBtn')) $('soundBtn').onclick = toggleSound;
  if ($('resetBtn')) $('resetBtn').onclick = resetFlight;
}

// Mouse Virtual Yoke (only active when explicitly enabled via MOUSE STEER button)
window.addEventListener('pointermove', e => {
  if (!$('boot') || !$('boot').classList.contains('hidden')) return;
  if (screenYoke.active) return;
  if (e.target.closest && (
    e.target.closest('.hud-panel') ||
    e.target.closest('.hud-actions') ||
    e.target.closest('.screen-throttle') ||
    e.target.closest('button')
  )) return;
  if (!mouseFlight.enabled) return;

  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;
  let rx = (e.clientX - midX) / (midX * 0.75);
  let ry = (e.clientY - midY) / (midY * 0.75);

  // 12% deadzone around center so resting near center does not deflect elevator or ailerons
  const deadzone = 0.12;
  rx = Math.abs(rx) < deadzone ? 0 : (Math.sign(rx) * (Math.abs(rx) - deadzone) / (1 - deadzone));
  ry = Math.abs(ry) < deadzone ? 0 : (Math.sign(ry) * (Math.abs(ry) - deadzone) / (1 - deadzone));

  mouseFlight.roll = clamp(rx, -1, 1);
  mouseFlight.pitch = clamp(-ry, -1, 1);

  const crossDot = document.querySelector('.crosshair i');
  if (crossDot) {
    crossDot.style.transform = `translate(calc(-50% + ${mouseFlight.roll * 24}px), calc(-50% + ${-mouseFlight.pitch * 24}px))`;
  }
});

// Throttle with Mouse Wheel
window.addEventListener('wheel', e => {
  if (!$('boot') || !$('boot').classList.contains('hidden')) return;
  const delta = -Math.sign(e.deltaY) * 0.05;
  setThrottle(fdm.controls.throttle + delta);
}, { passive: true });

// Keyboard Controls
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['Shift', 'Control', ' '].includes(e.key)) e.preventDefault();

  // Number keys 0 to 9 for direct throttle % (GeoFS style)
  if (e.keyCode >= 48 && e.keyCode <= 57) {
    const thrPct = (e.keyCode - 48) / 9;
    setThrottle(thrPct);
  }

  // Throttle adjustment with Shift / Ctrl or PageUp / PageDown
  if (e.key === 'Shift' || e.key === 'PageUp') setThrottle(fdm.controls.throttle + 0.05);
  if (e.key === 'Control' || e.key === 'PageDown') setThrottle(fdm.controls.throttle - 0.05);

  // Airbrakes / Spoilers
  if (k === 'b' || e.code === 'Space') {
    toggleAirbrake();
  }

  if (k === 'm') toggleEngine();
  if (k === 'p' || k === 'h') openHangar();
  if (e.key === 'Escape') closeHangar();
  if (k === 'f') cycleFlaps();
  if (k === 'v' || k === 'c') cycleCamera();
  if (k === 's') toggleSound();
  if (k === 'x') toggleMouseFlight();
  if (k === 'r') resetFlight();
});

window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

// Main Animation Loop
function loop(t) {
  const dt = Math.min(0.04, Math.max(0.005, (t - lastTime) / 1000));
  lastTime = t;

  if (running) {
    const c = input();
    fdm.controls.aileron = clamp(c.roll, -1, 1);
    fdm.controls.elevator = clamp(c.pitch, -1, 1);
    fdm.controls.rudder = clamp(c.yaw, -1, 1);
    const curLat = flightLat();
    const curLng = flightLng();
    const a = fdm.step(dt, curLat, curLng);

    // Audio & Toast feedback for Liftoff & Touchdown
    if (a.liftoff) {
      toast('✈ ROTATE & LIFTOFF // CLIMBING OUT');
      audio.playClick();
    }
    if (a.touchdown) {
      toast(START.onRunway ? '🛬 TOUCHDOWN // RUNWAY ROLLOUT' : '🛬 TOUCHDOWN // SAFE GROUND ROLLOUT');
      audio.playTouchdown();
    }

    // Authentic Break & Explode Animation on Crash (Terrain, 3D building, tower, mountain)
    if (a.crashed && !crashResetTimer) {
      const reason = a.crashReason || 'TERRAIN IMPACT';
      toast(`💥 CRASH // ${reason} · AIRCRAFT DESTROYED`);
      audio.playExplosion();
      if (aircraft3D) aircraft3D.triggerExplosion(a.ias);
      
      const flashEl = $('crashFlash');
      if (flashEl) {
        flashEl.classList.add('active');
        setTimeout(() => flashEl.classList.remove('active'), 250);
      }
      const appEl = $('app');
      if (appEl) {
        appEl.classList.add('screen-shake');
        setTimeout(() => appEl.classList.remove('screen-shake'), 650);
      }

      crashResetTimer = setTimeout(() => {
        resetFlight();
        crashResetTimer = null;
      }, 2800);
    }
    updateMission();
    updateWorld();
    if (aircraft3D) {
      aircraft3D.update(a.euler, a.ias, a.g, fdm.controls.engine, cameraMode, dt);
    }
    hud(a);
    audio.update({
      throttle: fdm.controls.engine,
      speedKt: a.ias,
      stall: a.stall,
      airbrake: !!fdm.controls.airbrake
    });
  }
  requestAnimationFrame(loop);
}

// Start Flight
async function startFlight(isTour = false, onRunway = true) {
  $('boot').classList.add('hidden');
  $('hud').classList.remove('hidden');

  if (onRunway) {
    selectLocation(0); // Coimbatore Runway 05
  } else {
    selectLocation(1); // Coimbatore Airborne 1250m
  }

  autopilot = isTour;
  audio.init();

  if (!instruments && $('pfd')) {
    instruments = new FlightInstruments($('pfd'));
  }

  // Initialize Three.js 3D Aircraft renderer with authentic GeoFS textures, specular, and reflections
  if (!aircraft3D) {
    aircraft3D = new Aircraft3D(document.getElementById('app'));
  }
  window.aircraft3D = aircraft3D;
  await selectAircraft(currentAircraftIdx);

  // Try Google Maps 3D first, fallback to GeoFS Cesium 3D
  if (!worldEngine) {
    googleController = await tryInitGoogle3D(START);
    if (googleController) {
      worldEngine = googleController;
      currentEngineType = 'google3d';
      if ($('engineBtn')) $('engineBtn').textContent = '3D: GOOGLE';
    } else {
      console.info('Using GeoFS Cesium globe engine...');
      $('cesiumContainer').classList.remove('hidden');
      $('google3d').classList.add('hidden');
      cesiumController = await initCesiumFallback($('cesiumContainer'), START);
      worldEngine = cesiumController;
      currentEngineType = 'cesium';
      if ($('engineBtn')) $('engineBtn').textContent = '3D: GEOFS';
    }
  }

  worldEngine?.setCheckpoint(ROUTE[1]);
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
  toast(START.onRunway ? '🛫 LINED UP // RUNWAY 05 COIMBATORE' : 'AIRBORNE // 1250m HIGH ALTITUDE CRUISE');
}

// Event Listeners
if ($('startRunwayBtn')) $('startRunwayBtn').onclick = () => startFlight(false, true);
if ($('startAirborneBtn')) $('startAirborneBtn').onclick = () => startFlight(false, false);
if ($('startBtn')) $('startBtn').onclick = () => startFlight(false, true);
if ($('tourBtn')) $('tourBtn').onclick = () => startFlight(true, false);

initScreenClickControls();

// Pre-initialize Google 3D Maps in the background so 3D photogrammetry tiles stream in advance
tryInitGoogle3D(START).then(ctrl => {
  if (ctrl && !googleController) {
    googleController = ctrl;
    worldEngine = ctrl;
    currentEngineType = 'google3d';
    console.info('Google 3D Maps engine preloaded and warm in background.');
  }
}).catch(e => {
  console.warn('Google 3D background pre-init note:', e);
});
