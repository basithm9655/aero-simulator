// Comprehensive 3D Obstacle & Elevation Collision Database
// Detects collisions with 3D buildings, skyscrapers, bridges, towers, and mountain ridges

const DEG_TO_RAD = Math.PI / 180;

function metersPerDeg(lat) {
  const r = lat * DEG_TO_RAD;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * r) + 1.175 * Math.cos(4 * r),
    lng: 111412.84 * Math.cos(r) - 93.5 * Math.cos(3 * r)
  };
}

function distMeters(lat1, lng1, lat2, lng2) {
  const m = metersPerDeg((lat1 + lat2) / 2);
  const dy = (lat2 - lat1) * m.lat;
  const dx = (lng2 - lng1) * m.lng;
  return Math.hypot(dx, dy);
}

// 3D Point Landmarks & High-Rise Towers
export const POINT_OBSTACLES = [
  // --- TOKYO ---
  { name: 'TOKYO SKYTREE (634m)', lat: 35.7100, lng: 139.8107, radius: 160, maxAlt: 634 },
  { name: 'TOKYO TOWER (333m)', lat: 35.6586, lng: 139.7454, radius: 120, maxAlt: 333 },
  { name: 'TOKYO METROPOLITAN TOCHO (243m)', lat: 35.6896, lng: 139.6917, radius: 180, maxAlt: 243 },
  { name: 'MODE GAKUEN COCOON TOWER (204m)', lat: 35.6916, lng: 139.6970, radius: 110, maxAlt: 204 },
  { name: 'SHINJUKU PARK TOWER (235m)', lat: 35.6858, lng: 139.6908, radius: 160, maxAlt: 235 },
  { name: 'SHIBUYA SCRAMBLE SQUARE (230m)', lat: 35.6590, lng: 139.7020, radius: 150, maxAlt: 230 },
  { name: 'ROPPONGI MORI TOWER (238m)', lat: 35.6604, lng: 139.7292, radius: 180, maxAlt: 238 },
  { name: 'TORANOMON HILLS (255m)', lat: 35.6669, lng: 139.7497, radius: 150, maxAlt: 255 },
  { name: 'RAINBOW BRIDGE (126m)', lat: 35.6366, lng: 139.7631, radius: 280, maxAlt: 126 },

  // --- NEW YORK CITY ---
  { name: 'ONE WORLD TRADE CENTER (541m)', lat: 40.7127, lng: -74.0134, radius: 160, maxAlt: 541 },
  { name: '3 WORLD TRADE CENTER (329m)', lat: 40.7115, lng: -74.0120, radius: 140, maxAlt: 329 },
  { name: 'EMPIRE STATE BUILDING (443m)', lat: 40.7484, lng: -73.9857, radius: 150, maxAlt: 443 },
  { name: 'CHRYSLER BUILDING (319m)', lat: 40.7516, lng: -73.9755, radius: 120, maxAlt: 319 },
  { name: 'ONE VANDERBILT (427m)', lat: 40.7528, lng: -73.9789, radius: 130, maxAlt: 427 },
  { name: '432 PARK AVENUE (426m)', lat: 40.7615, lng: -73.9718, radius: 110, maxAlt: 426 },
  { name: 'CENTRAL PARK TOWER (472m)', lat: 40.7663, lng: -73.9810, radius: 120, maxAlt: 472 },
  { name: 'HUDSON YARDS THE EDGE (395m)', lat: 40.7538, lng: -74.0022, radius: 190, maxAlt: 395 },
  { name: 'BROOKLYN BRIDGE TOWERS (84m)', lat: 40.7061, lng: -73.9969, radius: 220, maxAlt: 84 },

  // --- DUBAI ---
  { name: 'BURJ KHALIFA (828m)', lat: 25.1972, lng: 55.2744, radius: 250, maxAlt: 828 },
  { name: 'BURJ AL ARAB (321m)', lat: 25.1412, lng: 55.1852, radius: 150, maxAlt: 321 },
  { name: 'DUBAI FRAME (150m)', lat: 25.2345, lng: 55.3003, radius: 130, maxAlt: 150 },
  { name: 'PRINCESS TOWER & MARINA (413m)', lat: 25.0888, lng: 55.1458, radius: 220, maxAlt: 413 },

  // --- PARIS ---
  { name: 'EIFFEL TOWER (330m)', lat: 48.8584, lng: 2.2945, radius: 150, maxAlt: 330 },
  { name: 'MONTPARNASSE TOWER (210m)', lat: 48.8421, lng: 2.3219, radius: 130, maxAlt: 210 },
  { name: 'ARC DE TRIOMPHE (50m)', lat: 48.8738, lng: 2.2950, radius: 90, maxAlt: 50 },
  { name: 'NOTRE-DAME TOWERS (69m)', lat: 48.8530, lng: 2.3499, radius: 90, maxAlt: 69 },

  // --- SAN FRANCISCO ---
  { name: 'GOLDEN GATE BRIDGE (227m)', lat: 37.8199, lng: -122.4783, radius: 320, maxAlt: 227 },
  { name: 'SALESFORCE TOWER (326m)', lat: 37.7897, lng: -122.3972, radius: 130, maxAlt: 326 },
  { name: 'TRANSAMERICA PYRAMID (260m)', lat: 37.7952, lng: -122.4028, radius: 120, maxAlt: 260 },
  { name: 'BAY BRIDGE TOWERS (160m)', lat: 37.7983, lng: -122.3778, radius: 300, maxAlt: 160 },
  { name: 'SUTRO TOWER (298m)', lat: 37.7552, lng: -122.4528, radius: 130, maxAlt: 298 },

  // --- LONDON ---
  { name: 'THE SHARD (310m)', lat: 51.5045, lng: -0.0865, radius: 120, maxAlt: 310 },
  { name: '22 BISHOPSGATE (278m)', lat: 51.5145, lng: -0.0825, radius: 140, maxAlt: 278 },
  { name: 'LONDON EYE (135m)', lat: 51.5033, lng: -0.1195, radius: 90, maxAlt: 135 },
  { name: 'ONE CANADA SQUARE (240m)', lat: 51.5050, lng: -0.0200, radius: 160, maxAlt: 240 },
  { name: 'TOWER BRIDGE (65m)', lat: 51.5055, lng: -0.0754, radius: 140, maxAlt: 65 }
];

// Dense 3D Skyscraper Districts & Mountain Ridges (Bounding Boxes)
export const ZONE_OBSTACLES = [
  // TOKYO: Shinjuku Skyscraper Canyon
  {
    name: 'SHINJUKU SKYSCRAPERS',
    minLat: 35.684, maxLat: 35.698,
    minLng: 139.686, maxLng: 139.702,
    maxAlt: 245
  },
  // TOKYO: Shibuya 3D Canyon
  {
    name: 'SHIBUYA 3D HIGH-RISES',
    minLat: 35.654, maxLat: 35.663,
    minLng: 139.696, maxLng: 139.706,
    maxAlt: 210
  },
  // NYC: Lower Manhattan Financial District Canyon
  {
    name: 'MANHATTAN FINANCIAL DISTRICT HIGH-RISES',
    minLat: 40.702, maxLat: 40.718,
    minLng: -74.020, maxLng: -74.004,
    maxAlt: 310
  },
  // NYC: Midtown Manhattan Skyscraper Grid
  {
    name: 'MIDTOWN MANHATTAN SKYSCRAPERS',
    minLat: 40.745, maxLat: 40.765,
    minLng: -74.002, maxLng: -73.970,
    maxAlt: 290
  },
  // DUBAI: Sheikh Zayed Road Skyscraper Corridor
  {
    name: 'SHEIKH ZAYED ROAD SKYSCRAPERS',
    minLat: 25.190, maxLat: 25.225,
    minLng: 55.262, maxLng: 55.285,
    maxAlt: 360
  },
  // PARIS: La Défense Skyscraper District
  {
    name: 'LA DEFENSE SKYSCRAPERS',
    minLat: 48.885, maxLat: 48.896,
    minLng: 2.230, maxLng: 2.248,
    maxAlt: 235
  },
  // SF: Downtown Financial District
  {
    name: 'SAN FRANCISCO FINANCIAL HIGH-RISES',
    minLat: 37.788, maxLat: 37.799,
    minLng: -122.406, maxLng: -122.392,
    maxAlt: 230
  },
  // COIMBATORE: Marudhamalai Hill Ridge
  {
    name: 'MARUDHAMALAI MOUNTAIN RIDGE',
    minLat: 11.038, maxLat: 11.062,
    minLng: 76.840, maxLng: 76.865,
    maxAlt: 880
  },
  // COIMBATORE: Kuridimalai / Thadagam Ridge
  {
    name: 'KURIDIMALAI MOUNTAIN RANGE',
    minLat: 11.065, maxLat: 11.130,
    minLng: 76.830, maxLng: 76.890,
    maxAlt: 1180
  },
  // COIMBATORE: Vellingiri / Western Ghats Escarpment
  {
    name: 'WESTERN GHATS MOUNTAIN WALL',
    minLat: 10.900, maxLat: 11.150,
    minLng: 76.650, maxLng: 76.815,
    maxAlt: 1650
  }
];

// Designated Airport Safe Zones (Runways & Flat Touchdown Strips)
const SAFE_RUNWAYS = [
  // Coimbatore International Airport (CJB) Runway 05/23 & Departure Corridor
  { minLat: 11.012, maxLat: 11.050, minLng: 77.020, maxLng: 77.065, elev: 404 },
  // JFK / LaGuardia
  { minLat: 40.630, maxLat: 40.655, minLng: -73.795, maxLng: -73.765, elev: 8 },
  // Tokyo Haneda (HND)
  { minLat: 35.535, maxLat: 35.565, minLng: 139.765, maxLng: 139.800, elev: 6 }
];

export function isNearRunway(lat, lng) {
  return SAFE_RUNWAYS.some(r =>
    lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng
  );
}

/**
 * Checks for collision with 3D buildings, towers, bridges, mountain ridges, and urban structures
 * @param {number} lat Current latitude
 * @param {number} lng Current longitude
 * @param {number} alt Current altitude (meters MSL)
 * @param {number} iasKt Indicated airspeed (knots)
 * @param {boolean} onGround True if already rolling on ground
 * @param {number} groundElev Local base ground elevation (meters MSL)
 * @returns {{ hit: boolean, name?: string, height?: number }}
 */
export function checkObstacleCollision(lat, lng, alt, iasKt = 160, onGround = false, groundElev = 404) {
  // If already rolling safely on the ground, don't re-trigger obstacle hit
  if (onGround) return { hit: false };

  // 1. Check Specific 3D Towers & Landmarks
  for (const obs of POINT_OBSTACLES) {
    if (alt <= obs.maxAlt) {
      const d = distMeters(lat, lng, obs.lat, obs.lng);
      if (d <= obs.radius) {
        return {
          hit: true,
          name: obs.name,
          height: obs.maxAlt
        };
      }
    }
  }

  // 2. Check 3D Skyscraper Districts & Mountain Ridges
  for (const zone of ZONE_OBSTACLES) {
    if (lat >= zone.minLat && lat <= zone.maxLat && lng >= zone.minLng && lng <= zone.maxLng) {
      if (alt <= zone.maxAlt) {
        return {
          hit: true,
          name: zone.name,
          height: zone.maxAlt
        };
      }
    }
  }

  // 3. Low-Altitude Urban Obstacle Impact (Trees, Homes, Utility Structures)
  // If flying low (< 14m above local ground) outside clear airport runway strips at high speed
  const nearRunway = isNearRunway(lat, lng);
  if (!nearRunway && alt < groundElev + 14 && iasKt > 135) {
    return {
      hit: true,
      name: 'RESIDENTIAL BUILDINGS & TREES',
      height: groundElev + 14
    };
  }

  return { hit: false };
}
