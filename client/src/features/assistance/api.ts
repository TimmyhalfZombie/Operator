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

    // Preserve the original location object for ActivityScreen
    location: raw?.location,
    vehicle: raw?.vehicle,

    _raw: raw,
  };
}

/** Get newest pending request for the operator. */
export async function fetchNextAssist(): Promise<AssistanceRequest | null> {
  const res = await api('/api/assist/next', { method: 'GET', auth: true });

  // Accept both shapes: { ok, data } or raw object
  const body = (res && (res as any).data !== undefined ? (res as any).data : res) as any;
  const raw = body && body.data !== undefined ? body.data : body;

  if (!raw) return null;
  return normalize(raw);
}

/** Accept a specific request by id. */
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

/** Decline a specific request by id. */
export async function declineAssist(id: string): Promise<void> {
  await api(`/api/assist/${id}/decline`, { method: 'POST', auth: true });
}

/** List requests for Activity (e.g., pending inbox). */
export async function fetchAssistInbox(params: { status?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));

  const res = await api(`/api/assist/inbox?${q.toString()}`, { method: 'GET', auth: true });
  const items = (res?.items ?? res?.data?.items ?? []) as any[];
  return items.map(normalize);
}

/**
 * Mark a request as completed (used when operator taps "Repaired").
 * If the server replies 404 (e.g., a second quick tap, or already completed),
 * we treat it as "already completed" and return a minimal payload so the UI can continue.
 */
export async function completeAssist(
  id: string,
  rating?: number
): Promise<{
  id: string;
  status: string;
  completedAt?: string;
  clientName?: string;
  phone?: string;
  placeName?: string;
  address?: string;
  vehicleType?: string;
  plateNumber?: string;
  otherInfo?: string;
  startName?: string;
  startAddr?: string;
  endName?: string;
  endAddr?: string;
  rating?: number | null;
}> {
  try {
    const res = await api(`/api/assist/${id}/complete`, {
      method: 'POST',
      auth: true,
      body: rating === undefined ? {} : { rating },
    });
    return (res?.data ?? res) as any;
  } catch (e: any) {
    const status = e?.status ?? 0;
    const msg = String(e?.message || '');
    if (status === 404 && /not\s*found/i.test(msg)) {
      // Treat as already-completed and let the caller proceed.
      return { id, status: 'completed' };
    }
    throw e;
  }
}

/** Fetch a single request by id (used for Activity detail screen). */
export async function getAssistById(id: string): Promise<AssistanceRequest> {
  const res = await api(`/api/assist/${id}`, { method: 'GET', auth: true });
  const raw = (res?.data ?? res) as any;
  return normalize(raw);
}
