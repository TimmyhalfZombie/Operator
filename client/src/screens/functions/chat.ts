import { useEffect, useState } from 'react';
import { tokens } from '../../auth/tokenStore';
import { ensureConversationId } from '../../features/messages/ensureConvId';

export function decodeJwtSubFromAccess(): string | null {
  try {
    const t = tokens.getAccess();
    if (!t) return null;
    const part = t.split('.')[1];
    if (!part) return null;
    const padded = (part + '===').slice(0, Math.ceil((part.length + 3) / 4) * 4)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    let json = '';
    try {
      // @ts-ignore atob may exist in RN/Expo
      if (typeof atob === 'function') {
        // @ts-ignore atob global
        const bin = atob(padded);
        try { json = decodeURIComponent(escape(bin)); } catch { json = bin; }
      } else if (typeof (globalThis as any).Buffer !== 'undefined') {
        json = (globalThis as any).Buffer.from(padded, 'base64').toString('utf8');
      }
    } catch { /* ignore */ }
    if (!json) return null;
    const payload = JSON.parse(json);
    const id = payload?.sub ?? payload?.id ?? payload?.userId ?? null;
    return id ? String(id) : null;
  } catch { return null; }
}

export function getMyIdSync(): string {
  return decodeJwtSubFromAccess() || 'me';
}

export function isMyMessage(from: string, myId: string): boolean {
  const decoded = decodeJwtSubFromAccess();
  return from === myId || (!!decoded && from === decoded);
}

export function useResolvedConversationId(
  idParam?: string,
  requestId?: string,
  peer?: string
): string | undefined {
  const [convId, setConvId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const resolved = await ensureConversationId(
        typeof idParam === 'string' ? idParam : undefined,
        { requestId: typeof requestId === 'string' ? requestId : undefined, peerUserId: typeof peer === 'string' ? peer : undefined }
      );
      if (!alive) return;
      setConvId(resolved);
    })();
    return () => { alive = false; };
  }, [idParam, requestId, peer]);

  return convId;
}


