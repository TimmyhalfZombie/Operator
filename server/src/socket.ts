import type { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Message } from './models/message';
import { Conversation } from './models/conversation';
import { ConversationMeta } from './models/conversationMeta';
import { getCustomerDb } from './db/connect';

type JwtUser = { id: string };

let ioRef: Server | null = null;
export function getIO(): Server {
  if (!ioRef) throw new Error('Socket.IO not initialized');
  return ioRef;
}

export function initSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
  });
  ioRef = io;

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string) ||
      (socket.handshake.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('no auth token'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as any;
      (socket as any).user = { id: String(payload.id || payload.sub) } as JwtUser;
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const me = (socket as any).user as JwtUser;
    const roomKey = (id: string) => `conv:${id}`;
    const joinRoom = (id?: string) => id && socket.join(roomKey(String(id)));
    const leaveRoom = (id?: string) => id && socket.leave(roomKey(String(id)));

    // Auto-join my conv rooms (best-effort)
    try {
      let convIds: string[] = [];
      if (Types.ObjectId.isValid(me.id)) {
        const mine = await Conversation.find({ members: new Types.ObjectId(me.id) }, { _id: 1 }).lean();
        convIds = mine.map((c: any) => String(c._id));
      } else {
        const agg = await Conversation.aggregate([
          { $addFields: { membersStr: { $map: { input: '$members', as: 'm', in: { $toString: '$$m' } } } } },
          { $match: { membersStr: me.id } },
          { $project: { _id: 1 } },
        ]);
        convIds = agg.map((c: any) => String(c._id));
      }
      convIds.forEach((id) => socket.join(roomKey(id)));
      if (process.env.NODE_ENV !== 'production') console.log('[socket] joined rooms:', convIds);
    } catch (e) {
      console.warn('[socket] auto-join failed:', (e as Error).message);
    }

    socket.on('conversation:join', (p: any) => joinRoom(p?.conversationId || p?.id));
    socket.on('join:conv', (id: string) => joinRoom(id));
    socket.on('join', (p: any) => joinRoom(p?.room || p?.conversationId || p?.id));

    socket.on('conversation:leave', (p: any) => leaveRoom(p?.conversationId || p?.id));
    socket.on('leave:conv', (id: string) => leaveRoom(id));
    socket.on('leave', (p: any) => leaveRoom(p?.room || p?.conversationId || p?.id));

    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (!conversationId) return;
      socket.to(roomKey(conversationId)).emit('typing', { userId: me.id, isTyping: !!isTyping });
    });

    async function createAndBroadcastMessage(p: { conversationId?: string; text?: string; tempId?: string }) {
      const conversationId = String(p?.conversationId || '');
      const text = String(p?.text || '').trim();
      const tempId = p?.tempId;

      if (!conversationId || !text) {
        if (process.env.NODE_ENV !== 'production') console.warn('[socket] missing conversationId/text', p);
        return;
      }

      // 1) Check conversation + membership
      let conv: any = null;
      try {
        conv = await Conversation.findById(conversationId);
      } catch (e) {
        console.error('[socket] invalid conversationId:', conversationId, (e as Error).message);
        throw e;
      }
      if (!conv) throw new Error('conversation_not_found');
      const isMember = conv.members.map(String).includes(me.id);
      if (!isMember) throw new Error('forbidden');

      const stamp = new Date();

      // 2) Try Mongoose insert, fall back to native if needed
      let msgDoc: any = null;
      try {
        const sender = Types.ObjectId.isValid(me.id) ? new Types.ObjectId(me.id) : me.id;
        msgDoc = await Message.create({
          conversationId: conv._id,            // ObjectId
          senderId: sender,                    // ObjectId or string (schema must allow string to avoid cast error)
          content: text,
          createdAt: stamp,
        });
        if (process.env.NODE_ENV !== 'production') console.log('[socket] mongoose insert OK:', String(msgDoc._id));
      } catch (e) {
        console.error('[socket] mongoose insert failed, falling back to native:', (e as Error).message);
        const db = await getCustomerDb();
        const ins = await db.collection('messages').insertOne({
          conversationId: conv._id,            // ObjectId
          senderId: Types.ObjectId.isValid(me.id) ? new Types.ObjectId(me.id) : me.id,
          content: text,
          createdAt: stamp,
        });
        msgDoc = { _id: ins.insertedId, conversationId: conv._id, senderId: me.id, content: text, createdAt: stamp };
      }

      // 3) Update previews (Mongoose; best-effort)
      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessage: text,
        lastMessageAt: stamp,
      }).catch((e) => console.warn('[socket] update conversation preview failed:', (e as Error).message));

      // 4) Unread +1 for others (best-effort)
      const others = conv.members.map(String).filter((u) => u !== me.id);
      await Promise.all(
        others.map(async (uid) => {
          try {
            if (Types.ObjectId.isValid(uid)) {
              await ConversationMeta.updateOne(
                { conversationId: conv._id, userId: new Types.ObjectId(uid) },
                { $inc: { unread: 1 } },
                { upsert: true }
              );
            } else {
              // @ts-expect-error optional string tracking if your schema has userIdStr
              await ConversationMeta.updateOne(
                { conversationId: conv._id, userIdStr: uid },
                { $inc: { unread: 1 }, $setOnInsert: { userIdStr: uid } },
                { upsert: true }
              ).catch(() => void 0);
            }
          } catch (e) {
            console.warn('[socket] unread update failed for', uid, (e as Error).message);
          }
        })
      );

      // 5) Broadcast + sender ack
      const payload = {
        id: String(msgDoc._id),
        conversationId: String(conv._id),
        from: String(Types.ObjectId.isValid(me.id) ? me.id : msgDoc.senderId),
        text,
        createdAt: (msgDoc.createdAt ?? stamp).toISOString(),
      };

      if (process.env.NODE_ENV !== 'production') console.log('[socket] broadcasting message:new', payload);
      io.to(roomKey(payload.conversationId)).emit('message:new', payload);
      if (tempId) socket.emit('message:delivered', { tempId, id: payload.id, createdAt: payload.createdAt });

      return payload;
    }

    socket.on('message:send', async (p: any, ack?: (res: any) => void) => {
      try {
        const m = await createAndBroadcastMessage({ conversationId: p?.conversationId, text: p?.text ?? p?.content, tempId: p?.tempId });
        ack && ack({ ok: true, id: m?.id, createdAt: m?.createdAt });
      } catch (e: any) {
        console.error('[socket] message:send error:', e?.message || e);
        ack && ack({ ok: false, error: e?.message || 'send_failed' });
      }
    });

    socket.on('newMessage', async (p: any, ack?: (res: any) => void) => {
      try {
        const m = await createAndBroadcastMessage({ conversationId: p?.conversationId, text: p?.text ?? p?.content, tempId: p?.tempId });
        ack && ack({ ok: true, id: m?.id, createdAt: m?.createdAt });
      } catch (e: any) {
        console.error('[socket] newMessage error:', e?.message || e);
        ack && ack({ ok: false, error: e?.message || 'send_failed' });
      }
    });
  });

  return io;
}
