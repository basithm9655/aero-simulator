// Comprehensive 3D Obstacle & Elevation Collision Database
// Detects collisions with 3D buildings, skyscrapers, bridges, towers, and mountain ridges
// while keeping all major global airport runways & approach corridors clear for takeoff and landing.

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
  { name: 'TOKYO SKYTREE (634m)', lat: 35.7100, lng: 139.8107, radius: 140, maxAlt: 634 },
  { name: 'TOKYO TOWER (333m)', lat: 35.6586, lng: 139.7454, radius: 110, maxAlt: 333 },
  { name: 'TOKYO METROPOLITAN TOCHO (243m)', lat: 35.6896, lng: 139.6917, radius: 160, maxAlt: 243 },
  { name: 'MODE GAKUEN COCOON TOWER (204m)', lat: 35.6916, lng: 139.6970, radius: 100, maxAlt: 204 },
  { name: 'SHINJUKU PARK TOWER (235m)', lat: 35.6858, lng: 139.6908, radius: 145, maxAlt: 235 },
  { name: 'SHIBUYA SCRAMBLE SQUARE (230m)', lat: 35.6590, lng: 139.7020, radius: 135, maxAlt: 230 },
  { name: 'ROPPONGI MORI TOWER (238m)', lat: 35.6604, lng: 139.7292, radius: 160, maxAlt: 238 },
  { name: 'TORANOMON HILLS (255m)', lat: 35.6669, lng: 139.7497, radius: 135, maxAlt: 255 },
  { name: 'RAINBOW BRIDGE (126m)', lat: 35.6366, lng: 139.7631, radius: 240, maxAlt: 126 },

  // --- NEW YORK CITY ---
  { name: 'ONE WORLD TRADE CENTER (541m)', lat: 40.7127, lng: -74.0134, radius: 140, maxAlt: 541 },
  { name: '3 WORLD TRADE CENTER (329m)', lat: 40.7115, lng: -74.0120, radius: 125, maxAlt: 329 },
  { name: 'EMPIRE STATE BUILDING (443m)', lat: 40.7484, lng: -73.9857, radius: 135, maxAlt: 443 },
  { name: 'CHRYSLER BUILDING (319m)', lat: 40.7516, lng: -73.9755, radius: 110, maxAlt: 319 },
  { name: 'ONE VANDERBILT (427m)', lat: 40.7528, lng: -73.9789, radius: 120, maxAlt: 427 },
  { name: '432 PARK AVENUE (426m)', lat: 40.7615, lng: -73.9718, radius: 100, maxAlt: 426 },
  { name: 'CENTRAL PARK TOWER (472m)', lat: 40.7663, lng: -73.9810, radius: 110, maxAlt: 472 },
  { name: 'HUDSON YARDS THE EDGE (395m)', lat: 40.7538, lng: -74.0022, radius: 170, maxAlt: 395 },
  { name: 'BROOKLYN BRIDGE TOWERS (84m)', lat: 40.7061, lng: -73.9969, radius: 190, maxAlt: 84 },

  // --- DUBAI ---
  { name: 'BURJ KHALIFA (828m)', lat: 25.1972, lng: 55.2744, radius: 210, maxAlt: 828 },
  { name: 'BURJ AL ARAB (321m)', lat: 25.1412, lng: 55.1852, radius: 135, maxAlt: 321 },
  { name: 'DUBAI FRAME (150m)', lat: 25.2345, lng: 55.3003, radius: 115, maxAlt: 150 },
  { name: 'PRINCESS TOWER & MARINA (413m)', lat: 25.0888, lng: 55.1458, radius: 190, maxAlt: 413 },

  // --- PARIS ---
  { name: 'EIFFEL TOWER (330m)', lat: 48.8584, lng: 2.2945, radius: 135, maxAlt: 330 },
  { name: 'MONTPARNASSE TOWER (210m)', lat: 48.8421, lng: 2.3219, radius: 120, maxAlt: 210 },
  { name: 'ARC DE TRIOMPHE (50m)', lat: 48.8738, lng: 2.2950, radius: 85, maxAlt: 50 },
  { name: 'NOTRE-DAME TOWERS (69m)', lat: 48.8530, lng: 2.3499, radius: 85, maxAlt: 69 },

  // --- SAN FRANCISCO ---
  { name: 'GOLDEN GATE BRIDGE (227m)', lat: 37.8199, lng: -122.4783, radius: 260, maxAlt: 227 },
  { name: 'SALESFORCE TOWER (326m)', lat: 37.7897, lng: -122.3972, radius: 120, maxAlt: 326 },
  { name: 'TRANSAMERICA PYRAMID (260m)', lat: 37.7952, lng: -122.4028, radius: 110, maxAlt: 260 },
  { name: 'BAY BRIDGE TOWERS (160m)', lat: 37.7983, lng: -122.3778, radius: 260, maxAlt: 160 },
  { name: 'SUTRO TOWER (298m)', lat: 37.7552, lng: -122.4528, radius: 120, maxAlt: 298 },

  // --- LONDON ---
  { name: 'THE SHARD (310m)', lat: 51.5045, lng: -0.0865, radius: 110, maxAlt: 310 },
  { name: '22 BISHOPSGATE (278m)', lat: 51.5145, lng: -0.0825, radius: 125, maxAlt: 278 },
  { name: 'LONDON EYE (135m)', lat: 51.5033, lng: -0.1195, radius: 85, maxAlt: 135 },
  { name: 'ONE CANADA SQUARE (240m)', lat: 51.5050, lng: -0.0200, radius: 145, maxAlt: 240 },
  { name: 'TOWER BRIDGE (65m)', lat: 51.5055, lng: -0.0754, radius: 125, maxAlt: 65 }
];

// Dense 3D Skyscraper Districts & Mountain Ridges (Bounding Boxes)
export const ZONE_OBSTACLES = [
  { name: 'SHINJUKU SKYSCRAPERS', minLat: 35.684, maxLat: 35.698, minLng: 139.686, maxLng: 139.702, maxAlt: 235 },
  { name: 'SHIBUYA 3D HIGH-RISES', minLat: 35.654, maxLat: 35.663, minLng: 139.696, maxLng: 139.706, maxAlt: 200 },
  { name: 'MANHATTAN FINANCIAL DISTRICT', minLat: 40.702, maxLat: 40.718, minLng: -74.020, maxLng: -74.004, maxAlt: 295 },
  { name: 'MIDTOWN MANHATTAN SKYSCRAPERS', minLat: 40.745, maxLat: 40.765, minLng: -74.002, maxLng: -73.970, maxAlt: 280 },
  { name: 'SHEIKH ZAYED ROAD CORRIDOR', minLat: 25.190, maxLat: 25.225, minLng: 55.262, maxLng: 55.285, maxAlt: 340 },
  { name: 'LA DEFENSE SKYSCRAPERS', minLat: 48.885, maxLat: 48.896, minLng: 2.230, maxLng: 2.248, maxAlt: 225 },
  { name: 'SAN FRANCISCO FINANCIAL HIGH-RISES', minLat: 37.788, maxLat: 37.799, minLng: -122.406, maxLng: -122.392, maxAlt: 220 },
  { name: 'MARUDHAMALAI MOUNTAIN RIDGE', minLat: 11.038, maxLat: 11.062, minLng: 76.840, maxLng: 76.865, maxAlt: 880 },
  { name: 'KURIDIMALAI MOUNTAIN RANGE', minLat: 11.065, maxLat: 11.130, minLng: 76.830, maxLng: 76.890, maxAlt: 1180 },
  { name: 'WESTERN GHATS ESCARPMENT', minLat: 10.900, maxLat: 11.150, minLng: 76.650, maxLng: 76.815, maxAlt: 1650 }
];

// Designated Airport Safe Zones (All 7 Global Destination Runways & Approach/Departure Corridors)
const SAFE_RUNWAYS = [
  // Coimbatore International Airport (VOCB) Runway 05/23
  { minLat: 10.990, maxLat: 11.075, minLng: 77.000, maxLng: 77.095, elev: 404 },
  // New York JFK (KJFK)
  { minLat: 40.600, maxLat: 40.675, minLng: -73.830, maxLng: -73.720, elev: 5 },
  // San Francisco Intl (KSFO)
  { minLat: 37.585, maxLat: 37.655, minLng: -122.410, maxLng: -122.310, elev: 4 },
  // Tokyo Haneda (RJTT)
  { minLat: 35.505, maxLat: 35.595, minLng: 139.735, maxLng: 139.835, elev: 6 },
  // Paris Orly (LFPO)
  { minLat: 48.695, maxLat: 48.765, minLng: 2.310, maxLng: 2.445, elev: 89 },
  // Dubai International (OMDB)
  { minLat: 25.215, maxLat: 25.290, minLng: 55.310, maxLng: 55.435, elev: 19 },
  // London Heathrow (EGLL)
  { minLat: 51.445, maxLat: 51.500, minLng: -0.520, maxLng: -0.370, elev: 25 }
];

export function isNearRunway(lat, lng) {
  return SAFE_RUNWAYS.some(r =>
    lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng
  );
}

/**
 * Checks for collision with 3D buildings, towers, bridges, mountain ridges, and urban structures.
 * Also supports low-speed deliberate off-field landings without unfair urban obstacle triggers.
 */
export function checkObstacleCollision(lat, lng, alt, iasKt = 160, onGround = false, groundElev = 404) {
  if (onGround) return { hit: false };

  // 1. Check Specific 3D Towers & Landmarks
  for (const obs of POINT_OBSTACLES) {
    if (alt <= obs.maxAlt) {
      const d = distMeters(lat, lng, obs.lat, obs.lng);
      if (d <= obs.radius) {
        return { hit: true, name: obs.name, height: obs.maxAlt };
      }
    }
  }

  // 2. Check 3D Skyscraper Districts & Mountain Ridges
  for (const zone of ZONE_OBSTACLES) {
    if (lat >= zone.minLat && lat <= zone.maxLat && lng >= zone.minLng && lng <= zone.maxLng) {
      if (alt <= zone.maxAlt) {
        return { hit: true, name: zone.name, height: zone.maxAlt };
      }
    }
  }

  // 3. High-speed low-altitude impact outside clear airport zones
  // Allows deliberate slow landing approaches anywhere while penalizing reckless high-speed treetop buzzing
  const nearRunway = isNearRunway(lat, lng);
  if (!nearRunway && alt < groundElev + 10 && iasKt > 175) {
    return {
      hit: true,
      name: 'LOW-ALTITUDE URBAN OBSTACLES',
      height: groundElev + 10
    };
  }

  return { hit: false };
}
