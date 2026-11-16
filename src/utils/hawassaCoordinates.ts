export interface Coordinates {
  lat: number;
  lng: number;
}

export const HAWASSA_CENTER: Coordinates = {
  lat: 7.0621,
  lng: 38.4763,
};

export const NEIGHBORHOOD_COORDINATES: Record<string, Coordinates> = {
  Piazza: { lat: 7.0504, lng: 38.4955 },
  Menhariya: { lat: 7.0568, lng: 38.4852 },
  'Gebeya Dar': { lat: 7.0648, lng: 38.4732 },
  Tabor: { lat: 7.0415, lng: 38.481 },
  Datto: { lat: 7.0682, lng: 38.4895 },
  'Arab Sefer': { lat: 7.0585, lng: 38.479 },
  'Hayk Dar': { lat: 7.0532, lng: 38.4668 },
  Addisu: { lat: 7.045, lng: 38.491 },
  Atote: { lat: 7.0478, lng: 38.4864 },
  Bilo: { lat: 7.0372, lng: 38.4748 },
  Gudumale: { lat: 7.0598, lng: 38.4638 },
  'Amora Gedel / Lake Side': { lat: 7.0475, lng: 38.4646 },
  Mobile: { lat: 7.0525, lng: 38.489 },
  'Millennium / Alamura': { lat: 7.0335, lng: 38.4695 },
  'Hawassa University Main Campus': { lat: 7.0512, lng: 38.5015 },
};

const NEIGHBORHOOD_ALIASES: Record<string, string> = {
  piassa: 'Piazza',
  piazza: 'Piazza',
  menaharia: 'Menhariya',
  menhariya: 'Menhariya',
  'gebeya dar': 'Gebeya Dar',
  tabor: 'Tabor',
  dato: 'Datto',
  datto: 'Datto',
  'arab sefer': 'Arab Sefer',
  'hayk dar': 'Hayk Dar',
  addisu: 'Addisu',
  atote: 'Atote',
  bilo: 'Bilo',
  gudumale: 'Gudumale',
  'amora gedel': 'Amora Gedel / Lake Side',
  'amora gedel / lake side': 'Amora Gedel / Lake Side',
  'lake side': 'Amora Gedel / Lake Side',
  lakeside: 'Amora Gedel / Lake Side',
  mobile: 'Mobile',
  millennium: 'Millennium / Alamura',
  alamura: 'Millennium / Alamura',
  'millennium / alamura': 'Millennium / Alamura',
  'hawassa university': 'Hawassa University Main Campus',
  'hawassa university main campus': 'Hawassa University Main Campus',
  'hu main campus': 'Hawassa University Main Campus',
};

export function normalizeNeighborhoodKey(neighborhood?: string | null): string {
  const clean = (neighborhood ?? '').trim();
  if (!clean) return 'Piazza';
  const alias = NEIGHBORHOOD_ALIASES[clean.toLowerCase()];
  if (alias) return alias;
  const exact = Object.keys(NEIGHBORHOOD_COORDINATES).find(
    (k) => k.toLowerCase() === clean.toLowerCase()
  );
  return exact ?? clean;
}

export function getNeighborhoodCoordinates(neighborhood?: string | null): Coordinates {
  if (!neighborhood || neighborhood.trim().toLowerCase() === 'all hawassa') {
    return HAWASSA_CENTER;
  }
  const canonical = normalizeNeighborhoodKey(neighborhood);
  return NEIGHBORHOOD_COORDINATES[canonical] ?? HAWASSA_CENTER;
}

export function getShopCoordinates(shopId: string, neighborhood: string): Coordinates {
  const base = getNeighborhoodCoordinates(neighborhood);
  // Deterministic subtle offset per shopId so multiple shops in one neighborhood don't overlap on pins
  let hash = 0;
  for (let i = 0; i < shopId.length; i += 1) {
    hash = (hash * 31 + shopId.charCodeAt(i)) % 1000;
  }
  const latOffset = ((hash % 17) - 8) * 0.00035;
  const lngOffset = (((Math.floor(hash / 17)) % 17) - 8) * 0.00035;
  return {
    lat: Number((base.lat + latOffset).toFixed(6)),
    lng: Number((base.lng + lngOffset).toFixed(6)),
  };
}

function haversineKmInternal(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function resolveClosestNeighborhood(
  lat: number,
  lng: number,
  candidateNames?: readonly string[]
): { neighborhood: string; distanceKm: number; coords: Coordinates } {
  const keys =
    candidateNames && candidateNames.length > 0
      ? [...candidateNames]
      : Object.keys(NEIGHBORHOOD_COORDINATES);
  let bestName = keys[0] ?? 'Piazza';
  let bestCoords = getNeighborhoodCoordinates(bestName);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const name of keys) {
    const coords = getNeighborhoodCoordinates(name);
    const dist = haversineKmInternal({ lat, lng }, coords);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestName = name;
      bestCoords = coords;
    }
  }

  return {
    neighborhood: bestName,
    distanceKm: Number((Number.isFinite(bestDistance) ? bestDistance : 0).toFixed(2)),
    coords: bestCoords,
  };
}
