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

export type ChatMessage = {
  id: string;
  conversationId: string;
  from: string;
  text: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
};

export async function listConversations(limit = 50): Promise<ConversationPreview[]> {
  const res = await api(`/api/conversations?limit=${limit}`, { auth: true, method: 'GET' });
  return (res?.items ?? res?.data?.items ?? []) as ConversationPreview[];
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const res = await api(`/api/conversations/${conversationId}`, { auth: true, method: 'GET' });
  return (res?.data ?? res) as ConversationDetail;
}

export async function fetchMessages(conversationId: string, before?: string, limit = 50): Promise<ChatMessage[]> {
  const qs = new URLSearchParams();
  if (before) qs.set('before', before);
  if (limit) qs.set('limit', String(limit));
  const res = await api(`/api/conversations/${conversationId}/messages?${qs.toString()}`, { auth: true, method: 'GET' });
  return (res?.items ?? res?.data?.items ?? []) as ChatMessage[];
}

export async function sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
  const res = await api(`/api/conversations/${conversationId}/messages`, {
    auth: true,
    method: 'POST',
    body: { text },
  });
  return (res?.data ?? res) as ChatMessage;
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
