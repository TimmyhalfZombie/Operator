import { api } from '../../lib/http';
import { AssistanceRequest } from './types';

function toLatLng(loc?: { coordinates?: [number, number] | number[] }) {
  const c = loc?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return undefined;
  const [lng, lat] = c;
  if (!Number.isFinite(lat as any) || !Number.isFinite(lng as any)) return undefined;
  return { lat: Number(lat), lng: Number(lng) };
}

function normalize(raw: any): AssistanceRequest {
  if (!raw) return raw;

  const address = raw?.address ?? raw?.location?.address ?? '';

  return {
    id: raw?.id ?? raw?._id,
    status: raw?.status,

    clientName: raw?.clientName ?? raw?.customerName ?? 'Customer',
    phone: raw?.phone ?? raw?.customerPhone ?? undefined,

    placeName: raw?.placeName ?? address,
    address,
    coords: raw?.coords ?? toLatLng(raw?.location) ?? null,

    vehicleType: raw?.vehicleType ?? raw?.vehicle?.model ?? undefined,
    plateNumber: raw?.plateNumber ?? raw?.vehicle?.plate ?? undefined,
    otherInfo: raw?.otherInfo ?? raw?.vehicle?.notes ?? undefined,

    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,

    _raw: raw,
  };
}

export async function fetchNextAssist(): Promise<AssistanceRequest | null> {
  const res = await api('/api/assist/next', { method: 'GET', auth: true });

  // Accept both shapes: { ok, data } or raw object
  const body = (res && (res as any).data !== undefined ? (res as any).data : res) as any;
  const raw = body && body.data !== undefined ? body.data : body;

  if (!raw) return null;
  return normalize(raw);
}

export async function acceptAssist(id: string): Promise<void> {
  try {
    await api(`/api/assist/${id}/accept`, { method: 'POST', auth: true });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/not\s*pending|not\s*found|404|409/i.test(msg)) {
      throw new Error('This request is no longer pending (already handled).');
    }
    throw e;
  }
}

export async function declineAssist(id: string): Promise<void> {
  await api(`/api/assist/${id}/decline`, { method: 'POST', auth: true });
}
