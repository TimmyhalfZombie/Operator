import React from 'react';
import { SocketContext } from '../../contexts/SocketProvider';
import { ChatMessage, fetchMessages, sendMessage } from './api';

export function useChat(conversationId?: string) {
  const { socket } = React.useContext(SocketContext);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [typing, setTyping] = React.useState<string[]>([]);

  // initial history
  React.useEffect(() => {
    if (!conversationId) return;
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const hist = await fetchMessages(conversationId);
        if (!live) return;
        setMessages(hist);
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [conversationId]);

  // realtime
  React.useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('join:conv', conversationId);

    const onNew = (m: ChatMessage) => {
      if (m.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, m]);
    };
    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTyping((prev) => {
        const s = new Set(prev);
        isTyping ? s.add(userId) : s.delete(userId);
        return Array.from(s);
      });
    };

    socket.on('message:new', onNew);
    socket.on('typing', onTyping);
    return () => {
      socket.emit('leave:conv', conversationId);
      socket.off('message:new', onNew);
      socket.off('typing', onTyping);
    };
  }, [socket, conversationId]);

  const send = React.useCallback(async (text: string) => {
    if (!text.trim() || !conversationId) return;
    if (socket?.connected) {
      socket.emit('message:send', { conversationId, text });
    } else {
      const m = await sendMessage(conversationId, text); // REST fallback
      setMessages((prev) => [...prev, m]);
    }
  }, [socket, conversationId]);

  const setIsTyping = React.useCallback((flag: boolean) => {
    if (!socket || !conversationId) return;
    socket.emit('typing', { conversationId, isTyping: !!flag });
  }, [socket, conversationId]);

  return { messages, loading, typing, send, setIsTyping };
}
