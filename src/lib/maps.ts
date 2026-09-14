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

// Shared option shape for both routers.
type DirectionsOpts = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
};

// --- OpenRouteService (preferred: true pedestrian profile, needs a key) ---

async function orsDirections(opts: DirectionsOpts): Promise<DirectionsResult> {
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

// --- OSRM fallback (free public demo server, no API key required) ---

type OsrmManeuver = { type?: string; modifier?: string };

type OsrmStep = {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OsrmManeuver;
};

type OsrmResponse = {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: number[][] };
    legs?: { steps?: OsrmStep[] }[];
  }[];
};

// Map OSRM maneuver types/modifiers onto the ORS step-type numbers the UI icons use.
function osrmStepType(maneuver: OsrmManeuver): number {
  const type = maneuver.type ?? '';
  const mod = maneuver.modifier ?? '';
  if (type === 'depart') return 11;
  if (type === 'arrive') return 10;
  if (type === 'roundabout' || type === 'rotary') return 7;
  if (type === 'exit roundabout' || type === 'exit rotary') return 8;
  if (mod === 'uturn') return 9;
  switch (mod) {
    case 'left': return 0;
    case 'right': return 1;
    case 'sharp left': return 2;
    case 'sharp right': return 3;
    case 'slight left': return 4;
    case 'slight right': return 5;
    default: return 6;
  }
}

function osrmInstruction(step: OsrmStep): string {
  const name = step.name ? ` onto ${step.name}` : '';
  const type = step.maneuver?.type ?? '';
  const mod = step.maneuver?.modifier ?? '';
  switch (type) {
    case 'depart':
      return step.name ? `Start on ${step.name}` : 'Head out';
    case 'arrive':
      return 'Arrive at your destination';
    case 'turn':
    case 'end of road':
      return `Turn ${mod || 'straight'}${name}`;
    case 'fork':
      return `Keep ${mod === 'left' ? 'left' : 'right'}${name}`;
    case 'roundabout':
    case 'rotary':
      return `Enter the roundabout${name}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${name}`;
    case 'new name':
      return `Continue${name}`;
    case 'merge':
      return `Merge${name}`;
    case 'on ramp':
      return `Take the ramp${name}`;
    case 'off ramp':
      return `Take the exit${name}`;
    default:
      return mod === 'uturn' ? `Make a U-turn${name}` : `Continue straight${name}`;
  }
}

async function osrmDirections(opts: DirectionsOpts): Promise<DirectionsResult> {
  const { originLat, originLng, destLat, destLng } = opts;
  const url =
    'https://router.project-osrm.org/route/v1/foot' +
    `/${originLng},${originLat};${destLng},${destLat}` +
    '?overview=full&steps=true&geometries=geojson';

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Could not reach the routing service. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new Error(`Routing service error (${response.status}).`);
  }

  const json = (await response.json()) as OsrmResponse;
  const route = json.routes?.[0];
  const stepsRaw = route?.legs?.[0]?.steps ?? [];

  if (!route || stepsRaw.length === 0) {
    throw new Error('No walking route is available between these points.');
  }

  const steps: RouteStepData[] = stepsRaw.map((step) => ({
    distance: step.distance ?? 0,
    duration: step.duration ?? 0,
    type: osrmStepType(step.maneuver ?? {}),
    instruction: osrmInstruction(step),
  }));

  const coords: RouteCoordinate[] = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]) => ({ latitude: lat, longitude: lng }),
  );

  return {
    totalDistance: Math.round(route.distance ?? steps.reduce((sum, s) => sum + s.distance, 0)),
    totalDuration: Math.round(route.duration ?? steps.reduce((sum, s) => sum + s.duration, 0)),
    steps,
    coords,
  };
}

export async function getDirections(opts: DirectionsOpts): Promise<DirectionsResult> {
  // ORS gives the true pedestrian profile when a key is configured; otherwise
  // (or if ORS fails) fall back to the free keyless OSRM router so directions
  // always work.
  if (orsKey) {
    try {
      return await orsDirections(opts);
    } catch (orsError) {
      try {
        return await osrmDirections(opts);
      } catch {
        throw orsError instanceof Error ? orsError : new Error('Could not load directions. Please try again.');
      }
    }
  }
  return osrmDirections(opts);
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