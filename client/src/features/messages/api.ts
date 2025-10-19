// CLIENT-SIDE API WRAPPER (no mongoose imports here)
import { api } from '../../lib/http';

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

// Normalized message shape for the UI
export type ChatMessage = {
  id: string;
  conversationId: string;
  from: string;        // ALWAYS: sender user id as string
  text: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
};

// --- helpers to normalize various backend field names into ChatMessage --- //
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
// ----------------------------------------------------------------------- //

export async function listConversations(limit = 50): Promise<ConversationPreview[]> {
  const res = await api(`/api/conversations?limit=${limit}`, { auth: true, method: 'GET' });
  return (res?.items ?? res?.data?.items ?? []) as ConversationPreview[];
}

export async function getConversation(conversationId: string): Promise<any> {
  const res = await api(`/api/conversations/${conversationId}`, { auth: true, method: 'GET' });
  return (res?.data ?? res);
}

export async function fetchMessages(conversationId: string, before?: string, limit = 50): Promise<ChatMessage[]> {
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

export async function sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
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

// Optional helper when you only have request+peer and no conversation yet
export async function ensureConversation(peerUserId: string, requestId?: string): Promise<{ id: string }> {
  const res = await api(`/api/conversations/ensure`, {
    auth: true,
    method: 'POST',
    body: { peerUserId, requestId },
  });
  return (res?.data ?? res) as { id: string };
}
