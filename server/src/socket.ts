import type { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message } from './models/message';
import { Conversation } from './models/conversation';
import { ConversationMeta } from './models/conversationMeta';

export function initSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string) ||
      (socket.handshake.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('no auth token'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as any;
      (socket as any).user = { id: String(payload.id || payload.sub) };
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const me = (socket as any).user;

    socket.on('join:conv', (conversationId: string) => {
      if (!conversationId) return;
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave:conv', (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('message:send', async (payload: { conversationId: string; text: string }) => {
      if (!payload?.conversationId || !payload?.text) return;
      const m = await Message.create({
        conversationId: payload.conversationId,
        senderId: me.id,
        content: payload.text,
      });

      // update conversation last message
      await Conversation.findByIdAndUpdate(payload.conversationId, {
        lastMessage: m.content,
        lastMessageAt: m.createdAt ?? new Date(),
      });

      // increase unread for other members
      const conv = await Conversation.findById(payload.conversationId).lean();
      const others = (conv?.members || []).map(String).filter((id) => id !== me.id);
      await Promise.all(
        others.map((userId) =>
          ConversationMeta.updateOne(
            { conversationId: conv?._id, userId },
            { $inc: { unread: 1 } },
            { upsert: true }
          )
        )
      );

      io.to(`conv:${payload.conversationId}`).emit('message:new', {
        id: String(m._id),
        conversationId: String(m.conversationId),
        from: String(m.senderId),
        text: m.content,
        createdAt: (m.createdAt ?? new Date()).toISOString(),
      });
    });

    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit('typing', { userId: me.id, isTyping: !!isTyping });
    });
  });

  return io;
}
