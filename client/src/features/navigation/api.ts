import { api } from '../../lib/http';

export type RouteResult = {
  points: { lat: number; lng: number }[];
  distanceMeters: number;
  durationSec: number;
};

export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: 'drive' | 'walk' | 'bicycle' = 'drive'
): Promise<RouteResult> {
  const q = `from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&mode=${mode}`;
  return api(`/api/geo/route?${q}`, { auth: true });
}

export type PlaceItem = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
};

export async function fetchNearby(
  lat: number,
  lng: number,
  categories = 'fuel,service.vehicle.repair',
  radius = 2000
): Promise<{ items: PlaceItem[] }> {
  const q = `lat=${lat}&lng=${lng}&categories=${encodeURIComponent(categories)}&radius=${radius}`;
  return api(`/api/geo/places?${q}`, { auth: true });
}

/* ---------------- NEW: client location helpers ---------------- */

export type ClientLocation = { lat: number; lng: number };
export type LatLng = ClientLocation;

function normLoc(v: any): ClientLocation | null {
  if (!v) return null;
  if (typeof v.lat === 'number' && typeof v.lng === 'number') return { lat: v.lat, lng: v.lng };
  if (v.location && typeof v.location.lat === 'number' && typeof v.location.lng === 'number') {
    return { lat: v.location.lat, lng: v.location.lng };
  }
  if (Array.isArray(v.coordinates) && v.coordinates.length >= 2) {
    return { lat: Number(v.coordinates[1]), lng: Number(v.coordinates[0]) };
  }
  if (v.geo && typeof v.geo.lat === 'number' && typeof v.geo.lng === 'number') {
    return { lat: v.geo.lat, lng: v.geo.lng };
  }
  return null;
}

/** Tries common endpoints/shapes and returns {lat,lng}. Adjust paths if needed. */
export async function fetchClientLocation(clientId: string): Promise<ClientLocation> {
  const paths = [
    `/api/clients/${clientId}/location`,
    `/api/users/${clientId}/location`,
    `/api/clients/${clientId}`,
    `/api/users/${clientId}`,
  ];

  for (const p of paths) {
    try {
      const j = await api(p, { auth: true });
      const loc = normLoc(j) || normLoc(j?.data) || normLoc(j?.result);
      if (loc) return loc;
    } catch {
      // try next
    }
  }
  throw new Error('Client location not found');
}
