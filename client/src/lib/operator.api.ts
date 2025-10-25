// client/src/lib/operator.api.ts
import { http } from './http';

export type OperatorLocation = {
  lat: number;
  lng: number;
  updated_at?: string;
  heading?: number;
  speed?: number;
};

export async function fetchMyLocationFromServer(): Promise<OperatorLocation | undefined> {
  try {
    // Assumes http.ts baseURL already points at /api
    const { data } = await http.get('/users/me/location');
    if (typeof data?.lat === 'number' && typeof data?.lng === 'number') {
      return {
        lat: Number(data.lat),
        lng: Number(data.lng),
        updated_at: data.updated_at ?? undefined,
        heading: data.heading ?? undefined,
        speed: data.speed ?? undefined,
      };
    }
  } catch {
    // swallow; map will just hide the operator marker
  }
  return undefined;
}
