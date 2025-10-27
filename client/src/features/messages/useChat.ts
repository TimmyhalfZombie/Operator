import React from 'react';
import { SocketContext } from '../../contexts/SocketProvider';
import { ChatMessage, fetchMessages, sendMessage } from './api';

// Normalize any server payload shape into our ChatMessage shape
function normalize(raw: any): ChatMessage | null {
  if (!raw) return null;
  const id = String(raw.id ?? raw._id ?? raw.messageId ?? '');
  const conversationId = String(raw.conversationId ?? raw.conversation?.id ?? raw.convId ?? '');
  const from = String(raw.from ?? raw.senderId ?? raw.sender?.id ?? raw.userId ?? '');
  const text = String(raw.text ?? raw.content ?? raw.message ?? '');
  const createdAt = String(raw.createdAt ?? raw.timestamp ?? raw.time ?? new Date().toISOString());
  if (!conversationId || !from || !text) return null;
  return { id: id || `${conversationId}:${createdAt}:${from}`, conversationId, from, text, createdAt };
}

function byTimeAsc(a: ChatMessage, b: ChatMessage) {
  return +new Date(a.createdAt) - +new Date(b.createdAt);
}

/**
 * useChat
 * @param conversationId the conversation id
 * @param meId your logged-in user id (used for optimistic "mine" bubbles)
 */
export function useChat(conversationId?: string, meId: string = 'me') {
  const { socket } = React.useContext(SocketContext);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [typing, setTyping] = React.useState<string[]>([]);
  const seenIds = React.useRef<Set<string>>(new Set());

  // Initial history (socket-first via api.ts; falls back to HTTP)
  React.useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const hist = await fetchMessages(conversationId);
        if (!alive) return;
        const list = hist.map(normalize).filter(Boolean) as ChatMessage[];
        list.forEach((m) => seenIds.current.add(String(m.id)));
        setMessages(list.sort(byTimeAsc));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      setMessages([]);
      seenIds.current.clear();
    };
  }, [conversationId]);

  // Realtime socket wiring
  React.useEffect(() => {
    if (!socket || !conversationId) return;

    // Join common room aliases for compatibility with server
    socket.emit('conversation:join', { conversationId });
    socket.emit('join:conv', conversationId);
    socket.emit('join', { room: conversationId });

    const upsert = (raw: any) => {
      const m = normalize(raw?.message ?? raw);
      if (!m || m.conversationId !== conversationId) return;
      if (seenIds.current.has(String(m.id))) return;

      setMessages((prev) => {
        // replace optimistic if text+from match
        const idx = prev.findIndex((x) => x.pending && x.text === m.text && x.from === m.from);
        const next = prev.slice();
        if (idx >= 0) next[idx] = { ...m };
        else next.push(m);
        seenIds.current.add(String(m.id));
        return next.sort(byTimeAsc);
      });
    };

    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTyping((prev) => {
        const s = new Set(prev);
        isTyping ? s.add(userId) : s.delete(userId);
        return Array.from(s);
      });
    };

    socket.on('message:new', upsert);
    socket.on('message:created', upsert);
    socket.on('messageCreated', upsert);
    socket.on('message:incoming', upsert);
    socket.on('typing', onTyping);

    // Optional "read" signal (server may ignore)
    socket.emit('messages:read', { conversationId });

    return () => {
      socket.emit('conversation:leave', { conversationId });
      socket.emit('leave:conv', conversationId);
      socket.emit('leave', { room: conversationId });

      socket.off('message:new', upsert);
      socket.off('message:created', upsert);
      socket.off('messageCreated', upsert);
      socket.off('message:incoming', upsert);
      socket.off('typing', onTyping);
    };
  }, [socket, conversationId]);

  const send = React.useCallback(
    async (text: string) => {
      const t = text?.trim();
      if (!t) return;

      // optimistic bubble
      const tempId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        tempId: tempId as any,
        conversationId: conversationId ?? 'local',
        from: meId,
        text: t,
        createdAt: new Date().toISOString(),
        pending: true,
      } as any;
      setMessages((prev) => [...prev, optimistic].sort(byTimeAsc));

      if (conversationId) {
        try {
          // socket-first send; UI will be reconciled by 'message:new' event
          await sendMessage(conversationId, t);
        } catch {
          // mark as failed but keep visible
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = { ...(prev[idx] as any), pending: false, failed: true };
            return next;
          });
        }
      }
    },
    [conversationId, meId]
  );

  const setIsTyping = React.useCallback(
    (flag: boolean) => {
      if (!socket || !conversationId) return;
      socket.emit('typing', { conversationId, isTyping: !!flag });
    },
    [socket, conversationId]
  );

  return { messages, loading, typing, send, setIsTyping };
}
