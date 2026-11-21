import './styles.css';
import { FlightModel, WEATHER_PRESETS } from './flight.js';
import { FlightAudio } from './audio.js';
import { FlightInstruments, CockpitHUD } from './instruments.js';
import { tryInitGoogle3D, initCesiumFallback } from './map.js';
import { Aircraft3D } from './aircraft3d.js';
import { RUNWAYS, getRunwayForLocation, computeApproachStart, evaluateILS, metersPerDeg } from './runways.js';

export const WORLD_LOCATIONS = [
  {
    id: 'cjb_runway',
    name: 'Coimbatore International',
    city: 'Coimbatore, India',
    runwayId: 'VOCB-05',
    desc: 'Take off or practice ILS landings on Runway 05 (VOCB) with Western Ghats & Nilgiri foothills ahead.',
    lat: 11.0223,
    lng: 77.0360,
    alt: 404,
    cruiseAlt: 1250,
    groundElev: 404,
    heading: 50,
    onRunway: true,
    route: [
      { name: 'VOCB RWY 05', lat: 11.0223, lng: 77.0360, alt: 404, txt: 'Coimbatore Runway 05 Departure' },
      { name: 'CODISSIA', lat: 11.0345, lng: 77.0490, alt: 820, txt: 'Climbout via CODISSIA Sector' },
      { name: 'PSG TECH', lat: 11.0255, lng: 77.0039, alt: 1150, txt: 'Overfly PSG Tech Campus' },
      { name: 'MARUDHAMALAI', lat: 11.0458, lng: 76.8519, alt: 1450, txt: 'Western Ghats Foothills' }
    ]
  },
  {
    id: 'nyc',
    name: 'New York & JFK Intl',
    city: 'New York, USA',
    runwayId: 'KJFK-31L',
    desc: 'Soar past One World Trade Center, Empire State Building & Central Park, or land at JFK Runway 31L.',
    lat: 40.7128,
    lng: -74.0060,
    alt: 480,
    cruiseAlt: 480,
    groundElev: 5,
    heading: 30,
    onRunway: false,
    route: [
      { name: 'ONE WTC', lat: 40.7127, lng: -74.0134, alt: 480, txt: 'Lower Manhattan Corridor' },
      { name: 'EMPIRE STATE', lat: 40.7484, lng: -73.9857, alt: 540, txt: 'Midtown Skyline Pass' },
      { name: 'CENTRAL PARK', lat: 40.7851, lng: -73.9683, alt: 520, txt: 'Central Park Northbound' },
      { name: 'JFK RWY 31L', lat: 40.6253, lng: -73.7704, alt: 350, txt: 'Return to JFK Runway 31L' }
    ]
  },
  {
    id: 'sfo',
    name: 'San Francisco & SFO',
    city: 'California, USA',
    runwayId: 'KSFO-28R',
    desc: 'Fly over Golden Gate Bridge, Alcatraz, and downtown towers, or shoot the famous Bay ILS into SFO 28R.',
    lat: 37.8199,
    lng: -122.4783,
    alt: 360,
    cruiseAlt: 360,
    groundElev: 4,
    heading: 115,
    onRunway: false,
    route: [
      { name: 'GOLDEN GATE', lat: 37.8199, lng: -122.4783, alt: 360, txt: 'Golden Gate Bridge Crossing' },
      { name: 'ALCATRAZ', lat: 37.8269, lng: -122.4229, alt: 320, txt: 'Alcatraz Island Flyby' },
      { name: 'TRANSAMERICA', lat: 37.7952, lng: -122.4028, alt: 420, txt: 'Downtown Financial District' },
      { name: 'SFO RWY 28R', lat: 37.6135, lng: -122.3571, alt: 300, txt: 'Approach SFO Runway 28R' }
    ]
  },
  {
    id: 'tokyo',
    name: 'Tokyo & Haneda Intl',
    city: 'Tokyo, Japan',
    runwayId: 'RJTT-34L',
    desc: 'Navigate Shinjuku towers, Shibuya & Tokyo Tower, or perform a Tokyo Bay ILS landing onto Haneda 34L.',
    lat: 35.6895,
    lng: 139.6917,
    alt: 480,
    cruiseAlt: 480,
    groundElev: 6,
    heading: 135,
    onRunway: false,
    route: [
      { name: 'SHINJUKU', lat: 35.6895, lng: 139.6917, alt: 480, txt: 'Shinjuku Skyscraper Canyon' },
      { name: 'SHIBUYA', lat: 35.6595, lng: 139.7005, alt: 430, txt: 'Shibuya Crossing Sector' },
      { name: 'TOKYO TOWER', lat: 35.6586, lng: 139.7454, alt: 460, txt: 'Tokyo Tower Flyover' },
      { name: 'HANEDA 34L', lat: 35.5349, lng: 139.7798, alt: 300, txt: 'Approach Haneda Runway 34L' }
    ]
  },
  {
    id: 'paris',
    name: 'Paris & Orly Airport',
    city: 'Paris, France',
    runwayId: 'LFPO-24',
    desc: 'Cruise over the Eiffel Tower, Champs-Élysées & the Louvre, or execute an ILS landing on Orly Runway 24.',
    lat: 48.8584,
    lng: 2.2945,
    alt: 410,
    cruiseAlt: 410,
    groundElev: 89,
    heading: 45,
    onRunway: false,
    route: [
      { name: 'EIFFEL TOWER', lat: 48.8584, lng: 2.2945, alt: 410, txt: 'Eiffel Tower & Champ de Mars' },
      { name: 'CHAMPS-ELYSEES', lat: 48.8698, lng: 2.3075, alt: 380, txt: 'Arc de Triomphe Corridor' },
      { name: 'LOUVRE', lat: 48.8606, lng: 2.3376, alt: 360, txt: 'Louvre Museum & Seine' },
      { name: 'ORLY RWY 24', lat: 48.7327, lng: 2.3881, alt: 350, txt: 'Approach Paris Orly 24' }
    ]
  },
  {
    id: 'dubai',
    name: 'Dubai & DXB Intl',
    city: 'Dubai, UAE',
    runwayId: 'OMDB-30R',
    desc: 'Circle the 828m Burj Khalifa and Palm Jumeirah, or fly a textbook desert approach into Dubai 30R.',
    lat: 25.1972,
    lng: 55.2744,
    alt: 680,
    cruiseAlt: 680,
    groundElev: 19,
    heading: 30,
    onRunway: false,
    route: [
      { name: 'BURJ KHALIFA', lat: 25.1972, lng: 55.2744, alt: 680, txt: 'Burj Khalifa Spire Pass' },
      { name: 'DUBAI FRAME', lat: 25.2345, lng: 55.3003, alt: 480, txt: 'Sheikh Zayed Corridor' },
      { name: 'PALM JUMEIRAH', lat: 25.1124, lng: 55.1390, alt: 450, txt: 'Palm Island Coastal Leg' },
      { name: 'DXB RWY 30R', lat: 25.2435, lng: 55.3834, alt: 340, txt: 'Approach Dubai Runway 30R' }
    ]
  },
  {
    id: 'london',
    name: 'London & Heathrow',
    city: 'London, UK',
    runwayId: 'EGLL-27L',
    desc: 'Follow the River Thames past Big Ben, The Shard & Tower Bridge, or fly the iconic Heathrow 27L ILS.',
    lat: 51.5033,
    lng: -0.1195,
    alt: 390,
    cruiseAlt: 390,
    groundElev: 25,
    heading: 75,
    onRunway: false,
    route: [
      { name: 'LONDON EYE', lat: 51.5033, lng: -0.1195, alt: 390, txt: 'Westminster & River Thames' },
      { name: 'THE SHARD', lat: 51.5045, lng: -0.0865, alt: 420, txt: 'The Shard Glass Spire' },
      { name: 'CANARY WHARF', lat: 51.5050, lng: -0.0200, alt: 400, txt: 'Docklands Skyline' },
      { name: 'LHR RWY 27L', lat: 51.4649, lng: -0.4340, alt: 320, txt: 'Approach Heathrow 27L' }
    ]
  }
];

// Authentic Fleet with Real-World Aerodynamic Envelopes
const AIRCRAFT_FLEET = [
  {
    id: 'a380',
    name: 'Airbus A380-800 (Emirates)',
    label: 'A380 Emirates',
    modelUrl: '/a380.glb',
    texture: '/textures/texture-low_0.jpg',
    thumb: '/textures/texture-low_0.jpg',
    scale: 0.95,
    mass: 420000,
    wingArea: 845,
    wingspan: 79.75,
    thrustToWeight: 0.31,
    hasAfterburner: false,
    hasReversers: true,
    cruiseKnots: 485,
    maxKnots: 545,
    vmoKnots: 355,
    mmo: 0.89,
    vfeKnots: 225,
    stallKnots: 124,
    v1Knots: 136,
    vrKnots: 145,
    vrefKnots: 134,
    rollMaxRate: 30,
    pitchMaxRate: 20,
    spoolRate: 1.5,
    type: 'Quad-Engine Superjumbo · 4× Trent 900 · Reverse Thrust'
  },
  {
    id: 'f16',
    name: 'General Dynamics F-16C Falcon',
    label: 'F-16C Falcon',
    modelUrl: '/f16.glb',
    texture: '/textures/texture-low.jpg',
    thumb: '/textures/texture-low.jpg',
    scale: 1.5,
    mass: 12000,
    wingArea: 27.87,
    wingspan: 9.96,
    thrustToWeight: 0.72,
    hasAfterburner: true,
    hasReversers: false,
    cruiseKnots: 520,
    maxKnots: 1180,
    vmoKnots: 780,
    mmo: 2.0,
    vfeKnots: 265,
    stallKnots: 112,
    v1Knots: 122,
    vrKnots: 134,
    vrefKnots: 128,
    rollMaxRate: 130,
    pitchMaxRate: 42,
    spoolRate: 3.2,
    type: 'Supersonic Multirole Fighter · Afterburner · Mach 2.0'
  },
  {
    id: 'phenom',
    name: 'Embraer Phenom 100',
    label: 'Phenom 100',
    modelUrl: '/phenom.glb',
    texture: '/textures/texture-low (1).jpg',
    thumb: '/textures/texture-low (1).jpg',
    scale: 1.4,
    mass: 4750,
    wingArea: 18.8,
    wingspan: 12.3,
    thrustToWeight: 0.36,
    hasAfterburner: false,
    hasReversers: true,
    cruiseKnots: 380,
    maxKnots: 430,
    vmoKnots: 285,
    mmo: 0.72,
    vfeKnots: 185,
    stallKnots: 80,
    v1Knots: 88,
    vrKnots: 95,
    vrefKnots: 92,
    rollMaxRate: 68,
    pitchMaxRate: 28,
    spoolRate: 2.3,
    type: 'Very Light Twin Executive Jet · Agile Handling'
  }
];

const CAMERA_MODES = ['follow', 'cockpit', 'chase', 'wing', 'free'];
const WEATHER_KEYS = ['clear', 'sunset', 'night', 'crosswind', 'storm'];
const AP_MODES = ['off', 'nav', 'ils'];

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a;
};

let currentLocationIdx = 0;
let currentAircraftIdx = 0;
let currentWeatherIdx = 0;
let currentStartMode = 'runway'; // 'runway' | 'approach' | 'cruise'
let START = { ...WORLD_LOCATIONS[0] };
let ROUTE = WORLD_LOCATIONS[0].route;
let activeRunway = getRunwayForLocation(WORLD_LOCATIONS[0].id);

let worldEngine = null;
let googleController = null;
let cesiumController = null;
let currentEngineType = 'google3d';
let aircraft3D = null;
let instruments = null;
let cockpitHud = null;

let running = false;
let lastTime = 0;
let routeIndex = 1;
let cameraMode = 'follow';
let apMode = 'off';
let dockCollapsed = false;
let crashResetTimer = null;
let landingCardTimer = null;

const keys = {};
const mouseFlight = { enabled: false, pitch: 0, roll: 0 };
const screenYoke = { active: false, pitch: 0, roll: 0 };

const fdm = new FlightModel();
const audio = new FlightAudio();

function distMeters(a, b) {
  const m = metersPerDeg((a.lat + b.lat) / 2);
  return Math.hypot((b.lng - a.lng) * m.lng, (b.lat - a.lat) * m.lat);
}

function bearingDeg(a, b) {
  const m = metersPerDeg((a.lat + b.lat) / 2);
  const dN = (b.lat - a.lat) * m.lat;
  const dE = (b.lng - a.lng) * m.lng;
  return (Math.atan2(dE, dN) * (180 / Math.PI) + 360) % 360;
}

function toast(msg, duration = 2000) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, duration);
}

function flightLat() {
  return START.lat + fdm.s.pos.x / metersPerDeg(START.lat).lat;
}
function flightLng() {
  return START.lng + fdm.s.pos.y / metersPerDeg(START.lat).lng;
}

// ==================== AUTOPILOT (NAV ROUTE + FULL ILS AUTOLAND!) ====================
function computeAutopilot(curLat, curLng, curAlt, att, ils) {
  if (apMode === 'ils' && ils && ils.active) {
    // Full CAT-III ILS Autoland: aligns localizer, tracks 3° glideslope, lowers gear & flaps,
    // flares at 40 ft AGL, retards throttle, and deploys spoilers + reversers + brakes on rollout!
    const sp = fdm.specs;
    const aglFt = fdm.last.aglFt;

    if (fdm.onGround) {
      fdm.controls.throttle = 0;
      fdm.controls.airbrake = 1;
      fdm.controls.wheelBrake = 1;
      if (sp.hasReversers && fdm.last.ias > 45) {
        fdm.controls.reverseThrust = true;
      } else {
        fdm.controls.reverseThrust = false;
      }
      const rwyHdgErr = ((ils.runway.heading - att.yaw + 540) % 360) - 180;
      return {
        pitch: 0,
        roll: 0,
        yaw: clamp(rwyHdgErr / 18, -0.7, 0.7),
        throttle: 0
      };
    }

    // Auto-configure flaps & landing gear on approach
    if (ils.dmeKm < 14 && fdm.controls.gearTarget === 0) {
      setGear(true, true);
    }
    if (ils.dmeKm < 12 && fdm.controls.flapsTarget < 3) {
      setFlaps(3, true);
    }

    // Localizer intercept heading
    const interceptAngle = clamp(-ils.locDev * 26, -32, 32);
    const desiredHdg = (ils.runway.heading + interceptAngle + 360) % 360;
    const hdgErr = ((desiredHdg - att.yaw + 540) % 360) - 180;
    const desiredRoll = aglFt < 35 ? 0 : clamp(hdgErr * 1.4, -25, 25);

    // Glideslope & Flare pitch
    let desiredPitch;
    let targetSpeedKt = sp.vrefKnots + 4;
    if (aglFt < 45) {
      // Smooth touchdown flare!
      desiredPitch = 5.2;
      targetSpeedKt = sp.vrefKnots - 18;
    } else {
      const targetAltM = ils.runway.elev + ils.idealAlt;
      const altErrM = targetAltM - curAlt;
      const desiredVsMs = clamp(-Math.tan(3.0 * Math.PI / 180) * fdm.s.speed + altErrM * 0.14, -7.5, 4.0);
      const vsErr = desiredVsMs - fdm.vz;
      desiredPitch = clamp(1.2 + vsErr * 1.35, -7, 10);
    }

    const spdErr = targetSpeedKt - fdm.last.ias;
    const thrCmd = aglFt < 26 ? 0.0 : clamp(0.40 + spdErr * 0.022, 0.05, 0.85);
    fdm.controls.throttle = thrCmd;

    return {
      pitch: clamp((desiredPitch - att.pitch) / 14, -0.7, 0.7),
      roll: clamp((desiredRoll - att.roll) / 28, -0.7, 0.7),
      yaw: clamp(hdgErr / 45, -0.4, 0.4),
      throttle: thrCmd
    };
  }

  // Standard NAV Waypoint Autopilot
  const target = ROUTE[routeIndex] || ROUTE[0];
  const targetBearing = bearingDeg({ lat: curLat, lng: curLng }, target);
  const headingDiff = ((targetBearing - att.yaw + 540) % 360) - 180;
  const desiredRoll = clamp(headingDiff * 1.5, -34, 34);
  const targetAlt = target.alt || 1000;
  const desiredPitch = clamp((targetAlt - curAlt) * 0.045 + 1.8, -8, 12);

  if (!fdm.onGround && fdm.controls.gearTarget === 1 && fdm.last.aglFt > 120) {
    setGear(false, true);
  }
  if (!fdm.onGround && fdm.controls.flapsTarget > 0 && fdm.last.aglFt > 250) {
    setFlaps(0, true);
  }

  // If still on runway during AP tour, accelerate and rotate smoothly
  if (fdm.onGround) {
    fdm.controls.throttle = 0.92;
    const rotate = fdm.last.ias >= fdm.specs.vrKnots * 0.95 ? 0.75 : 0;
    return { pitch: rotate, roll: 0, yaw: clamp(headingDiff / 25, -0.5, 0.5), throttle: 0.92 };
  }

  const cruiseSpd = Math.min(260, fdm.specs.cruiseKnots * 0.72);
  const thrCmd = clamp(0.62 + (cruiseSpd - fdm.last.ias) * 0.012, 0.25, 0.92);
  fdm.controls.throttle = thrCmd;

  return {
    pitch: clamp((desiredPitch - att.pitch) / 16, -0.7, 0.7),
    roll: clamp((desiredRoll - att.roll) / 30, -0.7, 0.7),
    yaw: clamp(headingDiff / 45, -0.4, 0.4),
    throttle: thrCmd
  };
}

function readControls(curLat, curLng, ils) {
  if (apMode !== 'off') {
    return computeAutopilot(curLat, curLng, fdm.s.alt, fdm.attitude, ils);
  }

  const pitchKey = (keys.s || keys.arrowdown ? 1 : 0) + (keys.w || keys.arrowup ? -1 : 0);
  const rollKey = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
  const yawKey = (keys.q ? -1 : 0) + (keys.e ? 1 : 0);

  if (screenYoke.active) {
    return {
      pitch: clamp(screenYoke.pitch + pitchKey * 0.8, -1, 1),
      roll: clamp(screenYoke.roll + rollKey * 0.8, -1, 1),
      yaw: yawKey,
      throttle: fdm.controls.throttle
    };
  }

  if (mouseFlight.enabled && (Math.abs(mouseFlight.pitch) > 0.01 || Math.abs(mouseFlight.roll) > 0.01)) {
    return {
      pitch: clamp(mouseFlight.pitch + pitchKey * 0.8, -1, 1),
      roll: clamp(mouseFlight.roll + rollKey * 0.8, -1, 1),
      yaw: yawKey,
      throttle: fdm.controls.throttle
    };
  }

  return {
    pitch: pitchKey,
    roll: rollKey,
    yaw: yawKey,
    throttle: fdm.controls.throttle
  };
}

// ==================== SYSTEM ACTIONS ====================
function syncControlButtons() {
  const gearDown = fdm.controls.gearTarget === 1;
  if ($('gearBtn')) {
    $('gearBtn').textContent = gearDown ? 'Gear: Down' : 'Gear: Up';
    $('gearBtn').classList.toggle('active', gearDown);
  }

  const flapDeg = fdm.controls.flapsTarget * 10;
  if ($('flapBtn')) {
    $('flapBtn').textContent = `Flaps: ${flapDeg}°`;
    $('flapBtn').classList.toggle('active', fdm.controls.flapsTarget > 0);
  }

  if ($('brakeBtn')) {
    $('brakeBtn').textContent = fdm.controls.airbrake ? 'Spoilers: On' : 'Spoilers: Off';
    $('brakeBtn').classList.toggle('warn-active', !!fdm.controls.airbrake);
  }

  const brakeActive = fdm.controls.parkingBrake || fdm.controls.wheelBrake > 0.1;
  if ($('parkBrakeBtn')) {
    $('parkBrakeBtn').textContent = fdm.controls.parkingBrake
      ? 'Park Brake: On'
      : (fdm.controls.wheelBrake > 0.1 ? 'Braking...' : 'Brake: Off');
    $('parkBrakeBtn').classList.toggle('warn-active', brakeActive);
  }

  if ($('revBtn')) {
    $('revBtn').classList.toggle('active', !!fdm.controls.reverseThrust);
  }

  if ($('apBtn')) {
    const label = apMode === 'ils' ? 'AP: ILS Land' : apMode === 'nav' ? 'AP: Nav' : 'AP: Off';
    $('apBtn').textContent = label;
    $('apBtn').classList.toggle('ap-active', apMode !== 'off');
  }
}

function setGear(down, silent = false) {
  if (fdm.onGround && !down) {
    if (!silent) toast('Cannot retract landing gear while on ground');
    return;
  }
  const target = down ? 1 : 0;
  if (fdm.controls.gearTarget === target) return;
  fdm.controls.gearTarget = target;
  audio.playGearTransit(down);
  syncControlButtons();
  if (!silent) toast(down ? 'Landing Gear Extending (3 Green)' : 'Landing Gear Retracting');
}

function toggleGear() {
  setGear(fdm.controls.gearTarget === 0);
}

function setFlaps(notch, silent = false) {
  const n = clamp(notch, 0, 3);
  if (fdm.controls.flapsTarget === n) return;
  fdm.controls.flapsTarget = n;
  audio.playFlapsMotor();
  syncControlButtons();
  if (!silent) toast(`Flaps ${n * 10}°${n === 3 ? ' (Full Landing)' : n === 1 ? ' (Takeoff)' : ''}`);
}

function cycleFlaps() {
  setFlaps((fdm.controls.flapsTarget + 1) % 4);
}

function toggleAirbrake() {
  fdm.controls.airbrake = fdm.controls.airbrake ? 0 : 1;
  audio.playClick(true);
  syncControlButtons();
  toast(fdm.controls.airbrake ? 'Speedbrakes / Spoilers Deployed' : 'Speedbrakes Retracted');
}

function toggleParkingBrake() {
  fdm.controls.parkingBrake = !fdm.controls.parkingBrake;
  audio.playClick(true);
  syncControlButtons();
  toast(fdm.controls.parkingBrake ? 'Parking Brake Set' : 'Parking Brake Released');
}

function toggleReverseThrust() {
  if (!fdm.onGround) {
    toast('Reverse thrust available on ground rollout only');
    return;
  }
  if (!fdm.specs.hasReversers) {
    toast(`${AIRCRAFT_FLEET[currentAircraftIdx].label} has no thrust reversers (use Spoilers + Space)`);
    return;
  }
  fdm.controls.reverseThrust = !fdm.controls.reverseThrust;
  if (fdm.controls.reverseThrust) {
    fdm.controls.throttle = Math.max(0.75, fdm.controls.throttle);
  } else {
    fdm.controls.throttle = 0.0;
  }
  audio.playClick(true);
  syncControlButtons();
  toast(fdm.controls.reverseThrust ? 'Reverse Thrust Engaged' : 'Reverse Thrust Stowed');
}

function adjustTrim(delta) {
  fdm.controls.pitchTrim = clamp(fdm.controls.pitchTrim + delta, -1, 1);
  audio.playClick();
  toast(`Pitch Trim ${(fdm.controls.pitchTrim * 8).toFixed(1)}°`);
}

function cycleAutopilot(forceMode = null) {
  if (forceMode && AP_MODES.includes(forceMode)) {
    apMode = forceMode;
  } else {
    const idx = AP_MODES.indexOf(apMode);
    apMode = AP_MODES[(idx + 1) % AP_MODES.length];
  }
  audio.playAutopilotChime(apMode !== 'off');
  syncControlButtons();
  if (apMode === 'ils') toast('Autopilot: CAT-III ILS Auto-Land Active');
  else if (apMode === 'nav') toast('Autopilot: Waypoint Nav Active');
  else toast('Autopilot Disengaged — Manual Control');
}

function cycleWeather(targetKey = null) {
  if (targetKey && WEATHER_KEYS.includes(targetKey)) {
    currentWeatherIdx = WEATHER_KEYS.indexOf(targetKey);
  } else {
    currentWeatherIdx = (currentWeatherIdx + 1) % WEATHER_KEYS.length;
  }
  const key = WEATHER_KEYS[currentWeatherIdx];
  const preset = WEATHER_PRESETS[key];
  fdm.setWeather(key);
  if ($('weatherBtn')) $('weatherBtn').textContent = preset.label;

  const atmoEl = $('atmosphereLayer');
  if (atmoEl) {
    atmoEl.className = `atmo-${preset.timeOfDay}`;
  }
  if (aircraft3D) aircraft3D.setTimeOfDay(preset.timeOfDay);
  if (worldEngine?.setTimeOfDay) worldEngine.setTimeOfDay(preset.timeOfDay);

  audio.playClick();
  toast(`Weather: ${preset.label} · Wind ${preset.windDirDeg}° at ${preset.windKt} kt`);
}

function setThrottle(val, quiet = false) {
  fdm.controls.throttle = clamp(val, 0, 1);
  if (fdm.controls.throttle > 0.08 && fdm.controls.parkingBrake) {
    fdm.controls.parkingBrake = false;
    syncControlButtons();
  }
  if (fdm.controls.throttle > 0.35 && fdm.controls.reverseThrust) {
    fdm.controls.reverseThrust = false;
    syncControlButtons();
  }
  if ($('thrFill')) $('thrFill').style.height = `${fdm.controls.throttle * 100}%`;
  if ($('thrVal')) $('thrVal').textContent = `${Math.round(fdm.controls.throttle * 100)}%`;
  if (!quiet) {
    const pct = Math.round(fdm.controls.throttle * 100);
    const tag = (fdm.specs.hasAfterburner && pct >= 86) ? ' (AFTERBURNER)' : '';
    toast(`Throttle ${pct}%${tag}`, 1100);
  }
}

function cycleCamera(targetMode = null) {
  if (targetMode && CAMERA_MODES.includes(targetMode)) {
    cameraMode = targetMode;
  } else {
    const curIdx = CAMERA_MODES.indexOf(cameraMode);
    cameraMode = CAMERA_MODES[(curIdx + 1) % CAMERA_MODES.length];
  }
  const labels = { follow: 'Follow', cockpit: 'Cockpit', chase: 'Chase', wing: 'Wing', free: 'Free Orbit' };
  if ($('viewBtn')) $('viewBtn').textContent = `Cam: ${labels[cameraMode]}`;
  if ($('cockpitHud')) $('cockpitHud').classList.toggle('hidden', cameraMode !== 'cockpit');
  if ($('crosshair')) $('crosshair').classList.toggle('hidden', cameraMode === 'cockpit');

  if (aircraft3D) {
    aircraft3D.setCameraMode(cameraMode);
  }
  toast(`Camera: ${labels[cameraMode]}`);
  audio.playClick();
}

function toggleDock() {
  dockCollapsed = !dockCollapsed;
  $('bottomDock')?.classList.toggle('collapsed', dockCollapsed);
  $('telemPanel')?.classList.toggle('dock-hidden', dockCollapsed);
  $('throttleQuadrant')?.classList.toggle('dock-hidden', dockCollapsed);
  if ($('toggleDockBtn')) {
    $('toggleDockBtn').textContent = dockCollapsed ? 'Show Avionics' : 'Hide Avionics';
  }
}

function toggleSound() {
  const isMuted = audio.toggleMute();
  if ($('soundBtn')) {
    $('soundBtn').textContent = isMuted ? 'Sound: Off' : 'Sound: On';
    $('soundBtn').classList.toggle('active', !isMuted);
  }
  toast(isMuted ? 'Audio Muted' : 'Audio Active');
}

function toggleMouseFlight() {
  mouseFlight.enabled = !mouseFlight.enabled;
  mouseFlight.pitch = 0;
  mouseFlight.roll = 0;
  const crossDot = document.querySelector('.crosshair i');
  if (crossDot) crossDot.style.transform = 'translate(-50%, -50%)';
  if ($('mouseBtn')) {
    $('mouseBtn').classList.toggle('active', mouseFlight.enabled);
    $('mouseBtn').textContent = mouseFlight.enabled ? 'Mouse: On' : 'Mouse: Off';
  }
  toast(mouseFlight.enabled ? 'Continuous Mouse Yoke On' : 'Mouse Yoke Off (Click & Drag to Steer)');
}

async function toggleEngine() {
  const curPos = { lat: flightLat(), lng: flightLng(), alt: fdm.s.alt, heading: fdm.attitude.yaw };
  if (currentEngineType === 'google3d') {
    $('google3d').classList.add('hidden');
    $('cesiumContainer').classList.remove('hidden');
    if (!cesiumController) {
      toast('Loading Satellite 3D Globe...');
      cesiumController = await initCesiumFallback($('cesiumContainer'), curPos);
    }
    worldEngine = cesiumController;
    currentEngineType = 'cesium';
    if ($('engineBtn')) $('engineBtn').textContent = 'Map: Satellite';
    toast('3D Map: Satellite Globe');
  } else {
    $('cesiumContainer').classList.add('hidden');
    $('google3d').classList.remove('hidden');
    if (!googleController) {
      toast('Loading Google 3D Photogrammetry...');
      googleController = await tryInitGoogle3D(curPos);
    }
    if (googleController) {
      worldEngine = googleController;
      currentEngineType = 'google3d';
      if ($('engineBtn')) $('engineBtn').textContent = 'Map: Google 3D';
      toast('3D Map: Google 3D Photorealistic');
    }
  }
  worldEngine?.setCheckpoint(ROUTE[routeIndex]);
  worldEngine?.setTimeOfDay?.(WEATHER_PRESETS[WEATHER_KEYS[currentWeatherIdx]].timeOfDay);
  audio.playClick();
}

// ==================== LOCATIONS, APPROACH & RESET ====================
function configureScenario(locIdx, mode = 'runway') {
  currentLocationIdx = locIdx;
  currentStartMode = mode;
  const loc = WORLD_LOCATIONS[locIdx] || WORLD_LOCATIONS[0];
  activeRunway = RUNWAYS.find(r => r.id === loc.runwayId) || getRunwayForLocation(loc.id);
  ROUTE = loc.route;
  routeIndex = mode === 'approach' ? (ROUTE.length - 1) : 1;

  if (aircraft3D) aircraft3D.resetExplosion();
  $('crashFlash')?.classList.remove('active');
  $('app')?.classList.remove('screen-shake');
  $('landingCard')?.classList.add('hidden');
  clearTimeout(crashResetTimer);
  crashResetTimer = null;

  if (mode === 'runway') {
    START = {
      ...loc,
      lat: activeRunway.lat,
      lng: activeRunway.lng,
      alt: activeRunway.elev,
      groundElev: activeRunway.elev,
      heading: activeRunway.heading,
      onRunway: true
    };
    fdm.reset(START.alt, START.heading, true, START.groundElev, 0, 0.0, { isApproach: false });
  } else if (mode === 'approach') {
    const app = computeApproachStart(activeRunway, 4600);
    START = {
      ...loc,
      lat: app.lat,
      lng: app.lng,
      alt: app.alt,
      groundElev: app.groundElev,
      heading: app.heading,
      onRunway: false
    };
    fdm.reset(START.alt, START.heading, false, START.groundElev, fdm.specs.vrefKnots + 14, 0.38, { isApproach: true });
  } else {
    START = {
      ...loc,
      alt: loc.cruiseAlt || loc.alt,
      groundElev: activeRunway.elev,
      onRunway: false
    };
    fdm.reset(START.alt, START.heading, false, START.groundElev, Math.min(230, fdm.specs.cruiseKnots * 0.65), 0.68, { isApproach: false });
  }

  mouseFlight.pitch = 0;
  mouseFlight.roll = 0;
  screenYoke.pitch = 0;
  screenYoke.roll = 0;
  const crossDot = document.querySelector('.crosshair i');
  if (crossDot) crossDot.style.transform = 'translate(-50%, -50%)';

  if ($('thrFill')) $('thrFill').style.height = `${fdm.controls.throttle * 100}%`;
  if ($('thrVal')) $('thrVal').textContent = `${Math.round(fdm.controls.throttle * 100)}%`;

  if (worldEngine?.map) {
    worldEngine.map.center = { lat: START.lat, lng: START.lng, altitude: START.alt };
    worldEngine.map.heading = START.heading;
  }
  worldEngine?.setCheckpoint(mode === 'approach'
    ? { name: `${activeRunway.icao} RWY ${activeRunway.rwy}`, lat: activeRunway.lat, lng: activeRunway.lng, alt: activeRunway.elev + 20 }
    : ROUTE[routeIndex]
  );

  if ($('locationBtn')) {
    const modeTag = mode === 'runway' ? `RWY ${activeRunway.rwy}` : mode === 'approach' ? `ILS ${activeRunway.rwy}` : 'Cruise';
    $('locationBtn').textContent = `${loc.name.split('&')[0].trim()} · ${modeTag}`;
  }

  syncControlButtons();
  renderLocations();

  if (mode === 'runway') {
    toast(`${activeRunway.icao} Runway ${activeRunway.rwy} — Advance Throttle (Shift / 9) to Take Off`, 3200);
  } else if (mode === 'approach') {
    toast(`ILS Final Approach ${activeRunway.icao} RWY ${activeRunway.rwy} · Gear Down · Flaps 20°`, 3200);
  } else {
    toast(`${loc.name} · Airborne Cruise`, 2400);
  }
}

function resetFlight() {
  configureScenario(currentLocationIdx, currentStartMode);
  audio.playClick();
}

function jumpToILSApproach() {
  configureScenario(currentLocationIdx, 'approach');
  audio.playClick(true);
}

// ==================== HANGAR & LOCATIONS UI ====================
function renderHangar() {
  const grid = $('fleetGrid');
  if (!grid) return;
  grid.innerHTML = AIRCRAFT_FLEET.map((p, idx) => `
    <div class="fleet-card ${idx === currentAircraftIdx ? 'active' : ''}" data-idx="${idx}">
      <img src="${p.thumb}" alt="${p.name}" referrerpolicy="no-referrer">
      <h3>${p.name}</h3>
      <div class="fleet-type">${p.type}</div>
      <div class="fleet-specs mono">
        <div>MASS <span>${(p.mass / 1000).toFixed(1)} t</span></div>
        <div>V_ROT <span>${p.vrKnots} kt</span></div>
        <div>CRUISE <span>${p.cruiseKnots} kt</span></div>
        <div>V_REF <span>${p.vrefKnots} kt</span></div>
      </div>
      <button class="fleet-select-btn">${idx === currentAircraftIdx ? 'Active Aircraft' : 'Select Aircraft'}</button>
    </div>
  `).join('');

  grid.querySelectorAll('.fleet-card').forEach(card => {
    card.onclick = () => {
      selectAircraft(Number(card.dataset.idx));
      closeAllModals();
    };
  });
}

async function selectAircraft(idx) {
  currentAircraftIdx = idx;
  const plane = AIRCRAFT_FLEET[currentAircraftIdx];
  if ($('planeBtn')) $('planeBtn').textContent = plane.label;
  fdm.setSpecs(plane);
  audio.setAircraftProfile(plane.id);
  if (aircraft3D) {
    await aircraft3D.loadAircraft(plane);
  }
  renderHangar();
  toast(`Aircraft: ${plane.name}`);
  audio.playClick();
}

function renderLocations() {
  const grid = $('locationGrid');
  if (!grid) return;
  grid.innerHTML = '';

  WORLD_LOCATIONS.forEach((loc, idx) => {
    const rwy = RUNWAYS.find(r => r.id === loc.runwayId) || RUNWAYS[0];
    const card = document.createElement('div');
    card.className = 'location-item' + (idx === currentLocationIdx ? ' active' : '');
    card.innerHTML = `
      <div>
        <div class="location-meta mono">${loc.city} · ${rwy.icao} RWY ${rwy.rwy} · ILS ${rwy.ilsFreq}</div>
        <h3>${loc.name}</h3>
        <p>${loc.desc}</p>
      </div>
      <div class="loc-action-row">
        <button class="loc-btn primary" data-mode="runway">Runway Takeoff</button>
        <button class="loc-btn approach" data-mode="approach">ILS Approach</button>
        <button class="loc-btn" data-mode="cruise">City Cruise</button>
      </div>
    `;
    card.querySelectorAll('.loc-btn').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        closeAllModals();
        if (!running) {
          startFlight(false, mode, idx);
        } else {
          configureScenario(idx, mode);
          audio.playClick();
        }
      };
    });
    grid.appendChild(card);
  });
}

function openModal(id) {
  if (id === 'hangarModal') renderHangar();
  if (id === 'locationModal') renderLocations();
  $(id)?.classList.remove('hidden');
  audio.playClick();
}

function closeAllModals() {
  ['hangarModal', 'locationModal', 'controlsModal'].forEach(id => $(id)?.classList.add('hidden'));
}

// ==================== MISSION, HUD & TELEMETRY UPDATE ====================
function handleFlightEvents(a) {
  const ev = a.events || {};

  if (ev.v80) {
    audio.speakCallout('Eighty knots');
    toast('80 Knots — Crosscheck Airspeed');
  }
  if (ev.v1) {
    audio.speakCallout('V one');
    toast(`V1 (${fdm.specs.v1Knots} kt) — Decision Speed`);
  }
  if (ev.vr) {
    audio.speakCallout('Rotate');
    toast(`Rotate (${fdm.specs.vrKnots} kt) — Pull Back (S / ↓)`);
  }
  if (ev.liftoff) {
    toast('Liftoff — Climbing Out');
    audio.playClick(true);
  }
  if (ev.positiveRate) {
    audio.speakCallout('Positive rate, gear up');
    toast('Positive Rate — Press G to Retract Gear');
  }
  if (ev.sonicBoom) {
    audio.playSonicBoom();
    toast('Mach 1.0 — Supersonic Sonic Boom!');
  }
  if (ev.gpwsAlt) {
    audio.speakCallout(String(ev.gpwsAlt));
  }
  if (ev.retard) {
    audio.speakCallout('Retard', true);
    toast('Retard Throttle to Idle & Flare Gently');
  }
  if (ev.gpwsAlert) {
    audio.playMasterWarning();
    audio.speakCallout(ev.gpwsAlert.toLowerCase(), true);
  }
  if (ev.bounce) {
    audio.playTouchdown(ev.bounce.fpm, ev.bounce.iasKt);
    if (aircraft3D) aircraft3D.triggerTouchdownSmoke(1.1);
    toast(`Hard Bounce (${ev.bounce.fpm} fpm) — Hold Gentle Flare!`);
  }
  if (ev.touchdown) {
    const td = ev.touchdown;
    audio.playTouchdown(td.fpm, td.iasKt);
    if (aircraft3D) aircraft3D.triggerTouchdownSmoke(Math.abs(td.fpm) / 220);

    // Show rich post-landing grading banner
    if ($('landingGrade')) $('landingGrade').textContent = `${td.grade} (${'★'.repeat(td.stars)})`;
    if ($('landingRunwayTag')) {
      $('landingRunwayTag').textContent = td.onRunway ? `${activeRunway.icao} RWY ${activeRunway.rwy}` : 'OFF-RUNWAY TOUCHDOWN';
    }
    if ($('landingMetrics')) {
      $('landingMetrics').textContent = `${td.fpm} fpm · ${td.iasKt} kt · ${td.g.toFixed(2)}G · Pitch ${td.pitch >= 0 ? '+' : ''}${td.pitch}°`;
    }
    $('landingCard')?.classList.remove('hidden');
    clearTimeout(landingCardTimer);
    landingCardTimer = setTimeout(() => $('landingCard')?.classList.add('hidden'), 9500);
  }
}

function updateHUD(a, ils, curLat, curLng) {
  const att = a.euler;
  const altFt = Math.round(fdm.s.alt * 3.28084);
  const aglFt = Math.round(a.aglFt);

  $('alt').textContent = `${String(altFt).padStart(4, '0')} ft`;
  $('agl').textContent = `${aglFt} ft`;
  $('ias').textContent = `${String(Math.round(a.ias)).padStart(3, '0')} kt · M${a.mach.toFixed(2)}`;
  $('hdg').textContent = `${String(Math.round((att.yaw + 360) % 360)).padStart(3, '0')}°`;
  $('vs').textContent = `${a.vs >= 0 ? '+' : ''}${a.vs} fpm`;
  $('att').textContent = `${att.pitch >= 0 ? '+' : ''}${att.pitch.toFixed(1)}° / ${att.roll >= 0 ? '+' : ''}${att.roll.toFixed(1)}°`;
  $('aoag').textContent = `${a.aoa.toFixed(1)}° · ${a.g.toFixed(2)}G`;
  $('wind').textContent = `${String(a.windDir).padStart(3, '0')}° / ${a.windKt} kt`;
  $('trimFuel').textContent = `${(fdm.controls.pitchTrim * 8).toFixed(1)}° · ${a.fuelPct}%`;

  // Throttle & N1 readout
  if ($('thrFill')) $('thrFill').style.height = `${fdm.controls.throttle * 100}%`;
  if ($('thrVal')) $('thrVal').textContent = `${Math.round(fdm.controls.throttle * 100)}%`;
  if ($('n1Val')) $('n1Val').textContent = a.reverseThrust ? 'REV' : `N1 ${Math.round(fdm.controls.engine * 100)}%`;

  // Systems strip
  const sysGear = $('sysGear');
  if (sysGear) {
    if (a.gearPos > 0.96) {
      sysGear.textContent = 'GEAR DN';
      sysGear.className = 'sys-ok';
    } else if (a.gearPos < 0.04) {
      sysGear.textContent = 'GEAR UP';
      sysGear.className = 'sys-muted';
    } else {
      sysGear.textContent = 'GEAR TRN';
      sysGear.className = 'sys-warn';
    }
  }
  const sysFlaps = $('sysFlaps');
  if (sysFlaps) {
    const flpDeg = Math.round(a.flapsPos * 30);
    sysFlaps.textContent = `FLP ${flpDeg}°`;
    sysFlaps.className = a.flapOverspeed ? 'sys-danger' : flpDeg > 0 ? 'sys-info' : 'sys-muted';
  }
  const sysAp = $('sysAp');
  if (sysAp) {
    sysAp.textContent = apMode === 'ils' ? 'ILS AUTO' : apMode === 'nav' ? 'AP NAV' : 'MANUAL';
    sysAp.className = apMode !== 'off' ? 'sys-info' : 'sys-muted';
  }

  // Master Warning / Caution Annunciator
  const warnEl = $('warnBanner');
  if (warnEl) {
    let msg = '';
    let isCaution = false;
    if (a.gpwsAlert) msg = a.gpwsAlert;
    else if (a.stall) msg = 'STALL — NOSE DOWN / ADD POWER';
    else if (a.overspeed) msg = 'OVERSPEED — REDUCE THROTTLE';
    else if (a.flapOverspeed) { msg = 'FLAP OVERSPEED — RETRACT FLAPS'; isCaution = true; }
    else if (a.reverseThrust) { msg = 'REVERSE THRUST ACTIVE'; isCaution = true; }
    else if (fdm.controls.parkingBrake && a.onGround) { msg = 'PARKING BRAKE SET'; isCaution = true; }

    warnEl.textContent = msg;
    warnEl.classList.toggle('hidden', !msg);
    warnEl.classList.toggle('caution', isCaution);
  }

  // Subtle G-Force blackout / redout physiological vignette
  const gVig = $('gVignette');
  if (gVig) {
    if (a.g > 4.2) {
      const intensity = clamp((a.g - 4.2) / 4.2, 0, 0.72);
      gVig.style.background = 'radial-gradient(circle, transparent 35%, rgba(0, 0, 0, 0.95) 100%)';
      gVig.style.opacity = String(intensity);
    } else if (a.g < -1.0) {
      const intensity = clamp((-1.0 - a.g) / 1.8, 0, 0.55);
      gVig.style.background = 'radial-gradient(circle, transparent 40%, rgba(185, 28, 28, 0.85) 100%)';
      gVig.style.opacity = String(intensity);
    } else {
      gVig.style.opacity = '0';
    }
  }

  // Mission / ILS Top Strip
  const p = ROUTE[routeIndex] || ROUTE[0];
  const wpDist = distMeters({ lat: curLat, lng: curLng }, p);
  const wpBrg = bearingDeg({ lat: curLat, lng: curLng }, p);

  if (ils && ils.active && (currentStartMode === 'approach' || apMode === 'ils' || (aglFt < 2600 && ils.dmeKm < 14))) {
    const gsLabel = ils.papiWhite === 2 ? 'ON GLIDESLOPE' : ils.papiWhite > 2 ? 'HIGH ON PATH' : 'LOW ON PATH';
    $('missionTitle').textContent = `ILS ${ils.runway.icao} RWY ${ils.runway.rwy} · ${ils.dmeNm.toFixed(1)} NM`;
    $('missionSub').textContent = `${gsLabel} · Course ${String(ils.runway.heading).padStart(3, '0')}° · Elev ${Math.round(ils.runway.elev * 3.28084)} ft`;
  } else {
    $('missionTitle').textContent = p.txt;
    $('missionSub').textContent = wpDist < 380
      ? `Passing ${p.name} — Next Waypoint Active`
      : `Next ${p.name} · ${(wpDist / 1000).toFixed(1)} km · BRG ${String(Math.round(wpBrg)).padStart(3, '0')}°`;
  }

  if (wpDist < 380 && currentStartMode !== 'approach') {
    routeIndex = (routeIndex + 1) % ROUTE.length;
    worldEngine?.setCheckpoint(ROUTE[routeIndex]);
    toast(`Waypoint Reached: ${p.name}`);
    audio.playWaypointChime();
  }

  // Electronic 4-Gauge PFD / HSI / ILS / PAPI
  if (instruments) {
    instruments.draw({
      ias: a.ias,
      mach: a.mach,
      altFt,
      aglFt,
      pitch: att.pitch,
      roll: att.roll,
      hdg: att.yaw,
      vs: a.vs,
      gamma: a.gamma,
      slip: a.slip,
      stallKt: fdm.specs.stallKnots,
      vmoKt: fdm.specs.vmoKnots,
      ils,
      wpBearing: wpBrg,
      windDir: a.windDir,
      windKt: a.windKt
    });
  }

  // First-Person Collimated Windshield HUD (Cockpit Mode)
  if (cockpitHud && cameraMode === 'cockpit') {
    cockpitHud.draw(a, altFt, ils);
  }
}

// ==================== INPUT & EVENT BINDINGS ====================
function initControls() {
  const yokeEl = $('clickYoke');
  const nubEl = $('clickNub');
  let startX = 0;
  let startY = 0;

  window.addEventListener('pointerdown', e => {
    if (!$('boot')?.classList.contains('hidden')) return;
    if (cameraMode === 'free') return;
    if (e.target.closest && (
      e.target.closest('.hud-panel') ||
      e.target.closest('.hud-dock') ||
      e.target.closest('.hud-top-right') ||
      e.target.closest('.screen-throttle') ||
      e.target.closest('.overlay') ||
      e.target.closest('button')
    )) return;

    screenYoke.active = true;
    startX = e.clientX;
    startY = e.clientY;
    if (yokeEl) {
      yokeEl.style.left = `${startX}px`;
      yokeEl.style.top = `${startY}px`;
      yokeEl.classList.remove('hidden');
    }
    if (nubEl) nubEl.style.transform = 'translate(-50%, -50%)';
  });

  window.addEventListener('pointermove', e => {
    if (!screenYoke.active) return;
    const maxDist = 56;
    const dx = clamp((e.clientX - startX) / maxDist, -1, 1);
    const dy = clamp((e.clientY - startY) / maxDist, -1, 1);
    screenYoke.roll = dx;
    screenYoke.pitch = dy; // Drag down = pull back = pitch up!
    if (nubEl) {
      nubEl.style.transform = `translate(calc(-50% + ${dx * 28}px), calc(-50% + ${dy * 28}px))`;
    }
  });

  const endDrag = () => {
    if (!screenYoke.active) return;
    screenYoke.active = false;
    screenYoke.pitch = 0;
    screenYoke.roll = 0;
    yokeEl?.classList.add('hidden');
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Continuous Mouse Yoke (when enabled via X)
  window.addEventListener('pointermove', e => {
    if (!$('boot')?.classList.contains('hidden') || screenYoke.active || !mouseFlight.enabled) return;
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    let rx = (e.clientX - midX) / (midX * 0.72);
    let ry = (e.clientY - midY) / (midY * 0.72);
    const dead = 0.1;
    rx = Math.abs(rx) < dead ? 0 : Math.sign(rx) * (Math.abs(rx) - dead) / (1 - dead);
    ry = Math.abs(ry) < dead ? 0 : Math.sign(ry) * (Math.abs(ry) - dead) / (1 - dead);
    mouseFlight.roll = clamp(rx, -1, 1);
    mouseFlight.pitch = clamp(ry, -1, 1);
    const crossDot = document.querySelector('.crosshair i');
    if (crossDot) {
      crossDot.style.transform = `translate(calc(-50% + ${mouseFlight.roll * 20}px), calc(-50% + ${mouseFlight.pitch * 20}px))`;
    }
  });

  // Throttle Drag Track
  const track = $('thrTrack');
  if (track) {
    let dragging = false;
    const updateThr = ev => {
      const rect = track.getBoundingClientRect();
      const ratio = 1 - (ev.clientY - rect.top) / rect.height;
      setThrottle(ratio, true);
    };
    track.addEventListener('pointerdown', ev => {
      dragging = true;
      track.setPointerCapture(ev.pointerId);
      updateThr(ev);
    });
    track.addEventListener('pointermove', ev => { if (dragging) updateThr(ev); });
    const stop = () => { dragging = false; };
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
  }

  // Mouse wheel throttle (except in Free Orbit mode where wheel zooms)
  window.addEventListener('wheel', e => {
    if (!$('boot')?.classList.contains('hidden') || cameraMode === 'free') return;
    setThrottle(fdm.controls.throttle - Math.sign(e.deltaY) * 0.05);
  }, { passive: true });

  // Keyboard bindings — zero conflicts!
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }

    if (!$('boot')?.classList.contains('hidden')) return;
    if (['Shift', 'Control', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }

    // Spacebar = progressive hydraulic wheel brakes while held on ground
    if (e.code === 'Space') {
      fdm.controls.wheelBrake = 1;
      syncControlButtons();
      return;
    }

    if (e.repeat) {
      if (e.key === 'Shift' || e.key === 'PageUp') setThrottle(fdm.controls.throttle + 0.03, true);
      if (e.key === 'Control' || e.key === 'PageDown') setThrottle(fdm.controls.throttle - 0.03, true);
      return;
    }

    // Direct 0..9 throttle presets
    if (e.key >= '0' && e.key <= '9') {
      setThrottle(Number(e.key) / 9);
      audio.playClick();
      return;
    }

    if (e.key === 'Shift' || e.key === 'PageUp') setThrottle(fdm.controls.throttle + 0.06);
    else if (e.key === 'Control' || e.key === 'PageDown') setThrottle(fdm.controls.throttle - 0.06);
    else if (k === 'g') toggleGear();
    else if (k === 'f') cycleFlaps();
    else if (k === 'b') toggleAirbrake();
    else if (k === 'p') toggleParkingBrake();
    else if (k === 'z') toggleReverseThrust();
    else if (e.key === '[') adjustTrim(-0.12);
    else if (e.key === ']') adjustTrim(0.12);
    else if (k === 'u') cycleAutopilot();
    else if (k === 'c' || k === 'v') cycleCamera();
    else if (k === 't') cycleWeather();
    else if (k === 'l') jumpToILSApproach();
    else if (k === 'x') toggleMouseFlight();
    else if (k === 'n') toggleSound();
    else if (k === 'm') toggleEngine();
    else if (k === 'h') toggleDock();
    else if (k === 'r') resetFlight();
    else if (e.key === '?') openModal('controlsModal');
  });

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === 'Space') {
      fdm.controls.wheelBrake = 0;
      syncControlButtons();
    }
  });

  // Button wiring
  if ($('thrMax')) $('thrMax').onclick = () => { setThrottle(1.0); audio.playClick(); };
  if ($('thrCruise')) $('thrCruise').onclick = () => { setThrottle(0.65); audio.playClick(); };
  if ($('thrIdle')) $('thrIdle').onclick = () => { setThrottle(0.0); audio.playClick(); };
  if ($('revBtn')) $('revBtn').onclick = toggleReverseThrust;

  if ($('gearBtn')) $('gearBtn').onclick = toggleGear;
  if ($('flapBtn')) $('flapBtn').onclick = cycleFlaps;
  if ($('brakeBtn')) $('brakeBtn').onclick = toggleAirbrake;
  if ($('parkBrakeBtn')) $('parkBrakeBtn').onclick = toggleParkingBrake;
  if ($('trimDownBtn')) $('trimDownBtn').onclick = () => adjustTrim(-0.12);
  if ($('trimUpBtn')) $('trimUpBtn').onclick = () => adjustTrim(0.12);
  if ($('apBtn')) $('apBtn').onclick = () => cycleAutopilot();
  if ($('viewBtn')) $('viewBtn').onclick = () => cycleCamera();
  if ($('planeBtn')) $('planeBtn').onclick = () => openModal('hangarModal');
  if ($('approachBtn')) $('approachBtn').onclick = jumpToILSApproach;
  if ($('engineBtn')) $('engineBtn').onclick = toggleEngine;
  if ($('mouseBtn')) $('mouseBtn').onclick = toggleMouseFlight;
  if ($('soundBtn')) $('soundBtn').onclick = toggleSound;
  if ($('resetBtn')) $('resetBtn').onclick = resetFlight;
  if ($('toggleDockBtn')) $('toggleDockBtn').onclick = toggleDock;

  if ($('weatherBtn')) $('weatherBtn').onclick = () => cycleWeather();
  if ($('locationBtn')) $('locationBtn').onclick = () => openModal('locationModal');
  if ($('helpBtn')) $('helpBtn').onclick = () => openModal('controlsModal');

  if ($('hangarBtn')) $('hangarBtn').onclick = () => openModal('hangarModal');
  if ($('welcomeLocationBtn')) $('welcomeLocationBtn').onclick = () => openModal('locationModal');
  if ($('closeHangarBtn')) $('closeHangarBtn').onclick = closeAllModals;
  if ($('closeLocationBtn')) $('closeLocationBtn').onclick = closeAllModals;
  if ($('closeControlsBtn')) $('closeControlsBtn').onclick = closeAllModals;

  if ($('startRunwayBtn')) $('startRunwayBtn').onclick = () => startFlight(false, 'runway', currentLocationIdx);
  if ($('startApproachBtn')) $('startApproachBtn').onclick = () => startFlight(false, 'approach', currentLocationIdx);
  if ($('startAirborneBtn')) $('startAirborneBtn').onclick = () => startFlight(false, 'cruise', currentLocationIdx);
  if ($('tourBtn')) $('tourBtn').onclick = () => startFlight(true, 'cruise', currentLocationIdx);
}

// ==================== MAIN SIMULATION LOOP ====================
function loop(t) {
  const dt = Math.min(0.04, Math.max(0.005, (t - lastTime) / 1000));
  lastTime = t;

  if (running) {
    const curLat = flightLat();
    const curLng = flightLng();
    const ils = evaluateILS(curLat, curLng, fdm.s.alt, fdm.attitude.yaw, activeRunway);

    const ctrl = readControls(curLat, curLng, ils);
    fdm.controls.aileron = clamp(ctrl.roll, -1, 1);
    fdm.controls.elevator = clamp(ctrl.pitch, -1, 1);
    fdm.controls.rudder = clamp(ctrl.yaw, -1, 1);

    const a = fdm.step(dt, curLat, curLng, ils.onRunwaySurface);
    handleFlightEvents(a);

    // Crash impact & break-apart explosion
    if (a.crashed && !crashResetTimer) {
      const reason = a.crashReason || 'Terrain Impact';
      toast(`Crash: ${reason} — Resetting in 3s`, 3000);
      audio.playExplosion();
      if (aircraft3D) aircraft3D.triggerExplosion(a.ias);

      const flashEl = $('crashFlash');
      if (flashEl) {
        flashEl.classList.add('active');
        setTimeout(() => flashEl.classList.remove('active'), 260);
      }
      const appEl = $('app');
      if (appEl) {
        appEl.classList.add('screen-shake');
        setTimeout(() => appEl.classList.remove('screen-shake'), 650);
      }

      crashResetTimer = setTimeout(() => {
        resetFlight();
        crashResetTimer = null;
      }, 3000);
    }

    // Update 3D Globe
    if (worldEngine) {
      const att = a.euler;
      worldEngine.update(flightLat(), flightLng(), fdm.s.alt, att.yaw, att.pitch, att.roll, a.ias, cameraMode);
    }

    // Update 3D Aircraft + Effects
    if (aircraft3D) {
      aircraft3D.update({ ...a, engine: fdm.controls.engine }, cameraMode, dt);
    }

    // Update HUD & Cockpit Instruments
    updateHUD(a, ils, flightLat(), flightLng());

    // Update Multi-Layer Sound Engine
    audio.update({
      throttle: fdm.controls.engine,
      speedKt: a.ias,
      stall: a.stall,
      overspeed: a.overspeed,
      airbrake: !!fdm.controls.airbrake,
      onGround: a.onGround,
      afterburner: a.afterburner,
      reverseThrust: a.reverseThrust,
      gLoad: a.g,
      cameraMode,
      wheelBrake: fdm.controls.wheelBrake > 0.1 || fdm.controls.parkingBrake,
      transonic: a.transonic
    });
  }

  requestAnimationFrame(loop);
}

// ==================== LAUNCH SEQUENCE ====================
async function startFlight(isTour = false, mode = 'runway', locIdx = 0) {
  $('boot')?.classList.add('hidden');
  $('hud')?.classList.remove('hidden');

  apMode = isTour ? 'nav' : 'off';
  audio.init();
  audio.setAircraftProfile(AIRCRAFT_FLEET[currentAircraftIdx].id);

  if (!instruments && $('pfd')) {
    instruments = new FlightInstruments($('pfd'));
  }
  if (!cockpitHud && $('cockpitHud')) {
    cockpitHud = new CockpitHUD($('cockpitHud'));
  }
  if (!aircraft3D) {
    aircraft3D = new Aircraft3D($('app'));
  }
  window.aircraft3D = aircraft3D;

  await selectAircraft(currentAircraftIdx);
  configureScenario(locIdx, mode);

  if (!worldEngine) {
    googleController = await tryInitGoogle3D(START);
    if (googleController) {
      worldEngine = googleController;
      currentEngineType = 'google3d';
      if ($('engineBtn')) $('engineBtn').textContent = 'Map: Google 3D';
    } else {
      $('cesiumContainer').classList.remove('hidden');
      $('google3d').classList.add('hidden');
      cesiumController = await initCesiumFallback($('cesiumContainer'), START);
      worldEngine = cesiumController;
      currentEngineType = 'cesium';
      if ($('engineBtn')) $('engineBtn').textContent = 'Map: Satellite';
    }
  }

  worldEngine?.setCheckpoint(mode === 'approach'
    ? { name: `${activeRunway.icao} RWY ${activeRunway.rwy}`, lat: activeRunway.lat, lng: activeRunway.lng, alt: activeRunway.elev + 20 }
    : ROUTE[routeIndex]
  );

  // Sync weather lighting
  const preset = WEATHER_PRESETS[WEATHER_KEYS[currentWeatherIdx]];
  aircraft3D?.setTimeOfDay(preset.timeOfDay);
  worldEngine?.setTimeOfDay?.(preset.timeOfDay);

  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

initControls();

// Pre-warm Google 3D Maps tiles in the background
tryInitGoogle3D(START).then(ctrl => {
  if (ctrl && !googleController) {
    googleController = ctrl;
    worldEngine = ctrl;
    currentEngineType = 'google3d';
  }
}).catch(() => {});
