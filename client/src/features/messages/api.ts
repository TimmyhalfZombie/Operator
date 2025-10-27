// CLIENT-SIDE API WRAPPER (socket-first with HTTP fallback)
import { api } from '../../lib/http';
import { getSocket } from '../../lib/socket';

/* ---------------- types ---------------- */
export type ConversationPreview = {
  id: string;
  title?: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unread?: number | null;
  requestId?: string | null;
};

export type ConversationDetail = ConversationPreview & {
  members?: string[];
  peer?: {
    id: string;
    username?: string;
    phone?: string;
    email?: string;
    name?: string;
    avatarUrl?: string | null;
  } | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  from: string;
  text: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
};

/* ---------------- helpers ---------------- */
function toId(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return String(v._id ?? v.id ?? '');
  return String(v);
}
function normalizeMsg(raw: any): ChatMessage {
  return {
    id: toId(raw?.id ?? raw?._id),
    conversationId: toId(raw?.conversationId ?? raw?.conversation ?? raw?.convId),
    from: toId(raw?.from ?? raw?.senderId ?? raw?.sender?._id ?? raw?.sender),
    text: String(raw?.text ?? raw?.content ?? ''),
    createdAt: new Date(raw?.createdAt ?? raw?.created_at ?? Date.now()).toISOString(),
  };
}
function normalizeList(items: any[]): ChatMessage[] {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeMsg);
}

async function httpFetchMessages(conversationId: string, before?: string, limit = 50) {
  const qs = new URLSearchParams();
  if (before) qs.set('before', before);
  if (limit) qs.set('limit', String(limit));
  const res = await api(`/api/conversations/${conversationId}/messages?${qs.toString()}`, {
    auth: true,
    method: 'GET',
  });
  const items = (res?.items ?? res?.data?.items ?? []) as any[];
  return normalizeList(items);
}

/* Small helper to await a one-off socket response */
function onceWithTimeout<T = any>(event: string, timeoutMs: number, onAttach: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const s = getSocket();
    if (!s) return reject(new Error('no_socket'));
    const timer = setTimeout(() => {
      try { s.off(event, handler as any); } catch {}
      reject(new Error('timeout'));
    }, timeoutMs);
    function handler(payload: any) {
      clearTimeout(timer);
      try { s.off(event, handler as any); } catch {}
      resolve(payload);
    }
    s.once(event, handler);
    onAttach();
  });
}

/* ---------------- conversations (HTTP) ---------------- */
export async function listConversations(limit = 50): Promise<ConversationPreview[]> {
  const res = await api(`/api/conversations?limit=${limit}`, { auth: true, method: 'GET' });
  return (res?.items ?? res?.data?.items ?? []) as ConversationPreview[];
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const res = await api(`/api/conversations/${conversationId}`, { auth: true, method: 'GET' });
  return (res?.data ?? res) as ConversationDetail;
}

export async function ensureConversation(peerUserId: string, requestId?: string): Promise<{ id: string }> {
  const res = await api(`/api/conversations/ensure`, {
    auth: true,
    method: 'POST',
    body: { peerUserId, requestId },
  });
  return (res?.data ?? res) as { id: string };
}

/* ---------------- messages (SOCKET-FIRST) ---------------- */

/** Fetch history. Uses Socket.IO `getMessages`; falls back to HTTP when needed. */
export async function fetchMessages(conversationId: string, before?: string, limit = 50): Promise<ChatMessage[]> {
  // if we need pagination ("before") or socket unavailable, use HTTP
  const s = getSocket();
  if (!s?.connected || before) {
    return httpFetchMessages(conversationId, before, limit);
  }

  try {
    const res: any = await onceWithTimeout('getMessages', 5000, () => {
      // server expects the raw conversationId as payload
      s.emit('getMessages', conversationId);
    });

    if (res?.success && Array.isArray(res?.data)) {
      return normalizeList(res.data);
    }
    // fallback if server refused
    return httpFetchMessages(conversationId, before, limit);
  } catch {
    return httpFetchMessages(conversationId, before, limit);
  }
}

/** Send a message via Socket.IO (ack); falls back to HTTP if necessary. */
export async function sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
  const s = getSocket();
  const payload = { conversationId, text: String(text ?? '').trim(), tempId: `tmp_${Math.random().toString(36).slice(2, 10)}` };

  if (s?.connected) {
    try {
      const ack: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
        s.emit('message:send', payload, (res: any) => {
          clearTimeout(timeout);
          resolve(res);
        });
      });
      // We rely on the realtime 'message:new' event to deliver the full message.
      // Return a minimal object so callers can optionally clear "pending" if they want.
      if (ack?.ok) {
        return {
          id: ack.id || payload.tempId,
          conversationId,
          from: 'me',
          text: payload.text,
          createdAt: new Date(ack.createdAt || Date.now()).toISOString(),
        };
      }
      // if ack not ok, fall through to HTTP
    } catch {
      /* fall back to HTTP */
    }
  }

  // Fallback to HTTP REST
  const res = await api(`/api/conversations/${conversationId}/messages`, {
    auth: true,
    method: 'POST',
    body: { text },
  });
  return normalizeMsg(res?.data ?? res);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await api(`/api/conversations/${conversationId}`, { auth: true, method: 'DELETE' });
}
