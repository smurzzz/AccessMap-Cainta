// CARTO basemap raster tiles (built on OpenStreetMap data, free, no key).
// The raw OSM tile server (tile.openstreetmap.org) 403s the default Android
// UrlTile user-agent (react-native-maps#3747), which showed as a black map.
export const TILE_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

export const SAN_ISIDRO_REGION = {
  latitude: 14.582,
  longitude: 121.132,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export const SAN_ISIDRO_BOUNDS = {
  southWest: { latitude: 14.566, longitude: 121.114 },
  northEast: { latitude: 14.598, longitude: 121.148 },
};

export type RouteStepData = {
  distance: number;
  duration: number;
  type: number;
  instruction: string;
};

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type DirectionsResult = {
  totalDistance: number;
  totalDuration: number;
  steps: RouteStepData[];
  coords: RouteCoordinate[];
};

type OrsStep = {
  distance: number;
  duration: number;
  type?: number;
  instruction?: string;
};

type OrsResponse = {
  features?: {
    geometry?: { coordinates?: number[][] };
    properties?: {
      segments?: { steps?: OrsStep[] }[];
      summary?: { distance?: number; duration?: number };
    };
  }[];
  error?: { message?: string };
};

const orsKey = process.env.EXPO_PUBLIC_ORS_API_KEY;

export async function getDirections(opts: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}): Promise<DirectionsResult> {
  if (!orsKey) {
    throw new Error('Missing EXPO_PUBLIC_ORS_API_KEY. Add it to your .env file.');
  }
  const { originLat, originLng, destLat, destLng } = opts;
  const url =
    'https://api.openrouteservice.org/v2/directions/foot-walking' +
    `?api_key=${encodeURIComponent(orsKey)}` +
    `&start=${encodeURIComponent(`${originLng},${originLat}`)}` +
    `&end=${encodeURIComponent(`${destLng},${destLat}`)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Could not reach the routing service. Check your connection and try again.');
  }

  if (!response.ok) {
    let detail = `Routing service error (${response.status}).`;
    try {
      const body = (await response.json()) as OrsResponse;
      if (body.error?.message) detail = body.error.message;
    } catch {
      // keep the generic detail
    }
    throw new Error(detail);
  }

  const json = (await response.json()) as OrsResponse;
  const feature = json.features?.[0];
  const properties = feature?.properties;
  const steps: RouteStepData[] = (properties?.segments ?? [])
    .flatMap((segment) => segment.steps ?? [])
    .map((step) => ({
      distance: step.distance ?? 0,
      duration: step.duration ?? 0,
      type: step.type ?? 6,
      instruction: step.instruction ?? '',
    }));

  if (steps.length === 0) {
    throw new Error('No walking route is available between these points.');
  }

  const summary = properties?.summary;
  const totalDistance =
    summary?.distance ??
    steps.reduce((sum, step) => sum + step.distance, 0);
  const totalDuration =
    summary?.duration ??
    steps.reduce((sum, step) => sum + step.duration, 0);

  const coords: RouteCoordinate[] = (feature?.geometry?.coordinates ?? []).map(
    ([lng, lat]) => ({ latitude: lat, longitude: lng }),
  );

  return {
    totalDistance: Math.round(totalDistance),
    totalDuration: Math.round(totalDuration),
    steps,
    coords,
  };
}

export function regionForCoords(coords: RouteCoordinate[]) {
  if (coords.length === 0) return undefined;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const coord of coords) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.004) * 1.4,
    longitudeDelta: Math.max(maxLng - minLng, 0.004) * 1.4,
  };
}

const STEP_ICONS: Record<number, string> = {
  0: '←', // left
  1: '→', // right
  2: '↩', // sharp left
  3: '↪', // sharp right
  4: '↖', // slight left
  5: '↗', // slight right
  6: '↑', // straight
  7: '◌', // enter roundabout
  8: '↪', // exit roundabout
  9: '↺', // u-turn
  10: '⌖', // goal / arrive
  11: '●', // depart
  12: '↖', // keep left
  13: '↗', // keep right
};

export function stepIcon(type: number): string {
  return STEP_ICONS[type] ?? '↑';
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'under 1 min';
  return `${minutes} min`;
}