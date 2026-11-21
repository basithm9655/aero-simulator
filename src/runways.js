// Real-World Global Airport Runways & ILS (Instrument Landing System) Guidance Engine
// Provides accurate runway threshold geometry, 3° glideslope, localizer alignment, PAPI lights,
// surface detection (tarmac vs off-runway), and ILS final-approach spawn calculation.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function metersPerDeg(lat) {
  const r = lat * DEG;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * r) + 1.175 * Math.cos(4 * r),
    lng: 111412.84 * Math.cos(r) - 93.5 * Math.cos(3 * r)
  };
}

export const RUNWAYS = [
  {
    id: 'VOCB-05',
    icao: 'VOCB',
    airport: 'Coimbatore International',
    rwy: '05',
    locationId: 'cjb_runway',
    lat: 11.0223,
    lng: 77.0360,
    elev: 404,
    heading: 50,
    length: 2990,
    width: 60,
    ilsFreq: '109.50'
  },
  {
    id: 'VOCB-23',
    icao: 'VOCB',
    airport: 'Coimbatore International',
    rwy: '23',
    locationId: 'cjb_airborne',
    lat: 11.0396,
    lng: 77.0570,
    elev: 404,
    heading: 230,
    length: 2990,
    width: 60,
    ilsFreq: '109.50'
  },
  {
    id: 'KJFK-31L',
    icao: 'KJFK',
    airport: 'John F. Kennedy Intl',
    rwy: '31L',
    locationId: 'nyc',
    lat: 40.6253,
    lng: -73.7704,
    elev: 5,
    heading: 314,
    length: 4423,
    width: 65,
    ilsFreq: '111.35'
  },
  {
    id: 'KSFO-28R',
    icao: 'KSFO',
    airport: 'San Francisco Intl',
    rwy: '28R',
    locationId: 'sfo',
    lat: 37.6135,
    lng: -122.3571,
    elev: 4,
    heading: 284,
    length: 3618,
    width: 65,
    ilsFreq: '111.70'
  },
  {
    id: 'RJTT-34L',
    icao: 'RJTT',
    airport: 'Tokyo Haneda Intl',
    rwy: '34L',
    locationId: 'tokyo',
    lat: 35.5349,
    lng: 139.7798,
    elev: 6,
    heading: 337,
    length: 3000,
    width: 65,
    ilsFreq: '108.90'
  },
  {
    id: 'LFPO-24',
    icao: 'LFPO',
    airport: 'Paris Orly Airport',
    rwy: '24',
    locationId: 'paris',
    lat: 48.7327,
    lng: 2.3881,
    elev: 89,
    heading: 242,
    length: 3650,
    width: 60,
    ilsFreq: '110.90'
  },
  {
    id: 'OMDB-30R',
    icao: 'OMDB',
    airport: 'Dubai International',
    rwy: '30R',
    locationId: 'dubai',
    lat: 25.2435,
    lng: 55.3834,
    elev: 19,
    heading: 300,
    length: 4000,
    width: 65,
    ilsFreq: '111.30'
  },
  {
    id: 'EGLL-27L',
    icao: 'EGLL',
    airport: 'London Heathrow',
    rwy: '27L',
    locationId: 'london',
    lat: 51.4649,
    lng: -0.4340,
    elev: 25,
    heading: 271,
    length: 3658,
    width: 65,
    ilsFreq: '109.50'
  }
];

export function getRunwayForLocation(locationId) {
  return RUNWAYS.find(r => r.locationId === locationId) || RUNWAYS[0];
}

/**
 * Computes a stabilized 3-degree ILS final approach spawn point for any runway.
 * Places aircraft aligned on the extended centerline at `distMeters` prior to threshold.
 */
export function computeApproachStart(runway, distMeters = 4800) {
  const m = metersPerDeg(runway.lat);
  const backRad = ((runway.heading + 180) % 360) * DEG;
  const dNorth = Math.cos(backRad) * distMeters;
  const dEast = Math.sin(backRad) * distMeters;
  // Standard 3.0 deg ILS glideslope + 15m threshold crossing height
  const glideAlt = runway.elev + 15 + Math.tan(3.0 * DEG) * distMeters;
  return {
    lat: runway.lat + dNorth / m.lat,
    lng: runway.lng + dEast / m.lng,
    alt: Math.round(glideAlt),
    groundElev: runway.elev,
    heading: runway.heading,
    runway
  };
}

/**
 * Evaluates aircraft position relative to the nearest airport runway (or specified target runway)
 * and computes full ILS localizer, glideslope, DME, PAPI lights, and runway-surface status.
 */
export function evaluateILS(lat, lng, alt, heading, preferredRunway = null) {
  const m = metersPerDeg(lat);
  let best = null;
  let bestScore = Infinity;

  const candidates = preferredRunway ? [preferredRunway, ...RUNWAYS.filter(r => r.id !== preferredRunway.id)] : RUNWAYS;

  for (const r of candidates) {
    const dN = (lat - r.lat) * m.lat;
    const dE = (lng - r.lng) * m.lng;
    const dist = Math.hypot(dN, dE);
    // Prefer runways within 45 km, giving slight priority to preferred runway
    const score = (preferredRunway && r.id === preferredRunway.id && dist < 35000) ? dist * 0.65 : dist;
    if (score < bestScore) {
      bestScore = score;
      best = { runway: r, dN, dE, dist };
    }
  }

  if (!best || best.dist > 55000) {
    return { active: false, onRunwaySurface: false };
  }

  const r = best.runway;
  const rwyRad = r.heading * DEG;
  const fwdN = Math.cos(rwyRad);
  const fwdE = Math.sin(rwyRad);
  const rightN = -fwdE;
  const rightE = fwdN;

  // Longitudinal coordinate along runway:
  // < 0 means approaching threshold; 0..r.length means over/on runway pavement
  const alongM = best.dN * fwdN + best.dE * fwdE;
  // Cross-track deviation in meters (+ = right of centerline, - = left of centerline)
  const crossM = best.dN * rightN + best.dE * rightE;

  // Distance to touchdown zone (aiming point ~300m past threshold)
  const distToAimM = Math.max(1, 300 - alongM);
  const dmeKm = best.dist / 1000;
  const dmeNm = best.dist / 1852;

  // On runway pavement check (generous lateral margin for sim usability)
  const onRunwaySurface = alongM >= -60 && alongM <= r.length + 120 && Math.abs(crossM) <= r.width * 1.15;

  // Localizer angular deviation: full-scale deflection = ±2.5° (or ±150m close in)
  const distForAngle = Math.max(800, Math.abs(300 - alongM));
  const locAngleDeg = Math.atan2(crossM, distForAngle) * RAD;
  // locDev > 0 means aircraft is RIGHT of centerline -> fly LEFT (needle left)
  const locDev = Math.max(-1.2, Math.min(1.2, locAngleDeg / 2.5));

  // Glideslope deviation (3.0° ideal path to touchdown zone)
  const aglAboveRwy = alt - r.elev;
  const idealAlt = 15 + Math.tan(3.0 * DEG) * Math.max(0, 300 - alongM);
  const gsAngleDeg = alongM < 300 ? Math.atan2(Math.max(0, aglAboveRwy), distToAimM) * RAD : 3.0;
  // gsDev > 0 means aircraft is ABOVE glideslope -> fly DOWN (diamond below center)
  const gsDev = Math.max(-1.2, Math.min(1.2, (gsAngleDeg - 3.0) / 0.7));

  // PAPI 4-Light Indicator (0 = 4 Red very low, 2 = 2 White / 2 Red on path, 4 = 4 White very high)
  let papiWhite = 2;
  if (gsAngleDeg > 3.5) papiWhite = 4;
  else if (gsAngleDeg > 3.18) papiWhite = 3;
  else if (gsAngleDeg >= 2.82) papiWhite = 2;
  else if (gsAngleDeg >= 2.5) papiWhite = 1;
  else papiWhite = 0;

  // Heading alignment error to runway course (-180..180)
  const hdgDiff = ((r.heading - heading + 540) % 360) - 180;

  // Active ILS reception cone when within 30 km and roughly aligned or near airport
  const active = best.dist < 32000;

  return {
    active,
    runway: r,
    alongM,
    crossM,
    dmeKm,
    dmeNm,
    idealAlt,
    aglAboveRwy,
    locDev,
    gsDev,
    gsAngleDeg,
    papiWhite,
    hdgDiff,
    onRunwaySurface
  };
}
