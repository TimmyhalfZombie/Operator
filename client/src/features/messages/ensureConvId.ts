import { ensureConversation } from './api';

/**
 * Ensure we have a valid Mongo conversation ObjectId.
 * Priority: explicit id → ensure via (peerUserId, requestId) → undefined
 */
export async function ensureConversationId(
  id?: string,
  options: { requestId?: string; peerUserId?: string } = {}
): Promise<string | undefined> {
  const clean = (v?: string) => (v && typeof v === 'string' ? v.trim() : undefined);
  const existing = clean(id);
  if (existing && existing !== 'new') return existing;

  const peer = clean(options.peerUserId);
  const req = clean(options.requestId);
  if (!peer && !req) return undefined;

  try {
    const res = await ensureConversation(peer || '', req);
    return clean(res?.id);
  } catch {
    return undefined;
  }
}


