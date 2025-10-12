import { http } from './http';

export type OperatorLocation = {
  lat: number;
  lng: number;
  updated_at?: string;
};

export async function fetchMyLocationFromServer(): Promise<OperatorLocation> {
  // Assumes http.ts baseURL includes /api (e.g., http://localhost:3000/api)
  const { data } = await http.get('/users/me/location');
  return data;
}

export async function fetchDriveRouteGeoapify(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  apiKey: string
): Promise<any | null> {
  try {
    const url =
      `https://api.geoapify.com/v1/routing?waypoints=${fromLng},${fromLat}|${toLng},${toLat}&mode=drive&apiKey=${apiKey}`;
    const r = await fetch(url);
    const j = await r.json();
    const feat = j?.features?.[0];
    return feat ? { type: 'FeatureCollection', features: [feat] } : null;
  } catch {
    return null;
  }
}
