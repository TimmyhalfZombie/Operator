import type { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Message } from './models/message';
import { Conversation } from './models/conversation';
import { ConversationMeta } from './models/conversationMeta';
import { getCustomerDb } from './db/connect';
import { sendPushToUserIds } from './lib/expoPush'; // optional; used for chat push

type JwtUser = { id: string };

let ioRef: Server | null = null;
export function getIO(): Server {
  if (!ioRef) throw new Error('Socket.IO not initialized');
  return ioRef;
}

const userRoom = (userId: string) => `user:${userId}`;
const convRoom = (id: string) => `conv:${id}`;
const operatorsRoom = 'operators';

// ---------- helpers for new-request payload prettification ----------
function pickClientName(d: any): string {
  return (
    d?.clientName ||
    d?.customerName ||
    d?.location?.contactName ||
    d?.location?.contact?.name ||
    d?.contactName ||
    d?.user?.name ||
    'Customer'
  );
}
function pickPlaceName(d: any): string {
  return d?.placeName || d?.location?.name || d?.vehicle?.model || 'Location';
}
function pickAddress(d: any): string {
  return (
    d?.address ||
    d?.location?.address ||
    d?.location?.formattedAddress ||
    d?.location?.displayName ||
    ''
  );
}

let assistWatchStarted = false;
async function startAssistWatcher(io: Server) {
  if (assistWatchStarted) return;
  try {
    const db = await getCustomerDb();
    const coll = db.collection('assistrequests');

    // Watch for new pending requests; requires MongoDB replica set/Atlas
    const changeStream = coll.watch(
      [
        { $match: { operationType: { $in: ['insert'] } } },
      ],
      { fullDocument: 'default' }
    );

    changeStream.on('change', (chg: any) => {
      try {
        const doc = chg.fullDocument;
        if (!doc) return;
        if (doc.status && doc.status !== 'pending') return;

        const payload = {
          id: String(doc._id),
          status: doc.status || 'pending',
          clientName: pickClientName(doc),
          placeName: pickPlaceName(doc),
          address: pickAddress(doc),
          location: doc.location || null,
          vehicle: doc.vehicle || null,
          createdAt: doc.createdAt || doc.created_at || new Date(),
          userId: doc.userId ? String(doc.userId) : null,
        };

        // Broadcast instantly to all operators
        io.to(operatorsRoom).emit('assist:created', payload);
      } catch (e) {
        console.warn('[assist:created] emit failed:', (e as Error).message);
      }
    });

    changeStream.on('error', (err: any) => {
      console.warn('[assist watcher] change stream error:', err?.message || err);
    });

    assistWatchStarted = true;
    console.log('[assist watcher] started');
  } catch (e) {
    console.warn('[assist watcher] disabled:', (e as Error).message);
  }
}

async function usersInRoom(io: Server, room: string): Promise<Set<string>> {
  const sockets = await io.in(room).fetchSockets();
  const ids = new Set<string>();
  sockets.forEach((s) => {
    const uid = (s as any).user?.id;
    if (uid) ids.add(String(uid));
  });
  return ids;
}

export function initSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
  });
  ioRef = io;

  // Start zero-delay assist watcher (if DB supports change streams)
  startAssistWatcher(io).catch(() => {});

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

    // Join personal user room + operators broadcast room (this app is Operator)
    socket.join(userRoom(me.id));
    socket.join(operatorsRoom);

    // Auto-join all my conversation rooms
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
      convIds.forEach((id) => socket.join(convRoom(id)));
      if (process.env.NODE_ENV !== 'production') console.log('[socket] joined rooms:', convIds);
    } catch (e) {
      console.warn('[socket] auto-join failed:', (e as Error).message);
    }

    const joinAny = (id?: string) => id && socket.join(convRoom(String(id)));
    const leaveAny = (id?: string) => id && socket.leave(convRoom(String(id)));

    socket.on('conversation:join', (p: any) => joinAny(p?.conversationId || p?.id));
    socket.on('join:conv', (id: string) => joinAny(id));
    socket.on('join', (p: any) => joinAny(p?.room || p?.conversationId || p?.id));

    socket.on('conversation:leave', (p: any) => leaveAny(p?.conversationId || p?.id));
    socket.on('leave:conv', (id: string) => leaveAny(id));
    socket.on('leave', (p: any) => leaveAny(p?.room || p?.conversationId || p?.id));

    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (!conversationId) return;
      socket.to(convRoom(conversationId)).emit('typing', { userId: me.id, isTyping: !!isTyping });
    });

    // ---- conversation creation (unchanged) ----
    socket.on('newConversation', async (payload: any) => {
      try {
        const type = (payload?.type || 'direct').toString();
        let participants: string[] = Array.isArray(payload?.participants) ? payload.participants.map(String) : [];
        participants = Array.from(new Set(participants.filter(Boolean)));

        if (!participants.includes(me.id)) participants.push(me.id);
        if (participants.length < 2) {
          return socket.emit('newConversation', { success: false, msg: 'Not enough participants' });
        }

        const memberOids = participants.map((id) => new Types.ObjectId(id));
        let conv: any;

        if (type === 'direct' && participants.length === 2) {
          conv = await Conversation.findOne({ members: { $all: memberOids, $size: 2 } });
          if (!conv) {
            conv = await Conversation.create({
              members: memberOids.sort(),
              title: payload?.name || undefined,
              lastMessageAt: new Date(),
            });
          }
        } else {
          conv = await Conversation.create({
            members: memberOids.sort(),
            title: payload?.name || undefined,
            lastMessageAt: new Date(),
          });
        }

        socket.join(convRoom(String(conv._id)));
        socket.emit('newConversation', { success: true, data: conv });
      } catch (err: any) {
        console.error('[socket] newConversation failed:', err?.message || err);
        socket.emit('newConversation', { success: false, msg: 'Failed to create conversation' });
      }
    });

    // ---- message history (unchanged) ----
    socket.on('getMessages', async (conversationId: string) => {
      try {
        if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
          return socket.emit('getMessages', { success: false, msg: 'Invalid conversation id' });
        }
        const conv = await Conversation.findById(conversationId);
        if (!conv) return socket.emit('getMessages', { success: false, msg: 'Conversation not found' });
        if (!conv.members.map(String).includes(me.id)) {
          return socket.emit('getMessages', { success: false, msg: 'Forbidden' });
        }

        const docs = await Message.find({ conversationId: conv._id }).sort({ createdAt: -1 }).limit(200).lean();

        const mapped = docs.map((m: any) => ({
          _id: String(m._id),
          content: m.content,
          attachment: m.attachment ?? null,
          createdAt: (m.createdAt ?? new Date()).toISOString(),
          senderId: { _id: String(m.senderId) },
          conversationId: String(m.conversationId),
        }));

        socket.emit('getMessages', { success: true, data: mapped });
      } catch (err: any) {
        console.error('[socket] getMessages failed:', err?.message || err);
        socket.emit('getMessages', { success: false, msg: 'Failed to fetch messages' });
      }
    });

    // ---- send message (unchanged; also triggers remote push if you kept expoPush.ts) ----
    async function createAndBroadcastMessage(p: { conversationId?: string; text?: string; tempId?: string }) {
      const conversationId = String(p?.conversationId || '');
      const text = String(p?.text || '').trim();
      const tempId = p?.tempId;

      if (!conversationId || !text) {
        if (process.env.NODE_ENV !== 'production') console.warn('[socket] missing conversationId/text', p);
        return;
      }

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

      let msgDoc: any = null;
      try {
        const sender = Types.ObjectId.isValid(me.id) ? new Types.ObjectId(me.id) : me.id;
        msgDoc = await Message.create({
          conversationId: conv._id,
          senderId: sender,
          content: text,
          createdAt: stamp,
        });
      } catch (e) {
        console.error('[socket] mongoose insert failed, falling back to native:', (e as Error).message);
        const db = await getCustomerDb();
        const ins = await db.collection('messages').insertOne({
          conversationId: conv._id,
          senderId: Types.ObjectId.isValid(me.id) ? new Types.ObjectId(me.id) : me.id,
          content: text,
          createdAt: stamp,
        });
        msgDoc = { _id: ins.insertedId, conversationId: conv._id, senderId: me.id, content: text, createdAt: stamp };
      }

      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessage: text,
        lastMessageAt: stamp,
      }).catch((e) => console.warn('[socket] update conversation preview failed:', (e as Error).message));

      const others = conv.members.map(String).filter((u) => u !== me.id);

      await Promise.all(
        others.map(async (uid) => {
          try {
            await ConversationMeta.updateOne(
              { conversationId: conv._id, userId: new Types.ObjectId(uid) },
              { $inc: { unread: 1 } },
              { upsert: true }
            );
          } catch {}
        })
      );

      const payload = {
        id: String(msgDoc._id),
        conversationId: String(conv._id),
        from: String(Types.ObjectId.isValid(me.id) ? me.id : msgDoc.senderId),
        text,
        createdAt: (msgDoc.createdAt ?? stamp).toISOString(),
      };

      io.to(convRoom(payload.conversationId)).emit('message:new', payload);
      io.to(convRoom(payload.conversationId)).emit('message:created', { message: payload, conversationId: payload.conversationId });

      if (tempId) socket.emit('message:delivered', { tempId, id: payload.id, createdAt: payload.createdAt });

      // Optional: remote push for recipients not in room
      try {
        const inRoom = await usersInRoom(io, convRoom(payload.conversationId));
        const targets = others.filter((uid) => !inRoom.has(uid));
        if (targets.length) {
          await sendPushToUserIds(targets, {
            title: 'New message',
            body: text.length > 120 ? text.slice(0, 117) + '…' : text,
            data: { type: 'chat', conversationId: payload.conversationId },
          });
        }
      } catch (e) {
        console.warn('[push] chat push failed:', (e as Error).message);
      }

      return payload;
    }

    socket.on('message:send', async (p: any, ack?: (res: any) => void) => {
      try {
        const m = await createAndBroadcastMessage({ conversationId: p?.conversationId, text: p?.text ?? p?.content, tempId: p?.tempId });
        ack && ack({ ok: true, id: m?.id, createdAt: m?.createdAt });
      } catch (e: any) {
        ack && ack({ ok: false, error: e?.message || 'send_failed' });
      }
    });

    socket.on('newMessage', async (p: any, ack?: (res: any) => void) => {
      try {
        const m = await createAndBroadcastMessage({ conversationId: p?.conversationId, text: p?.text ?? p?.content, tempId: p?.tempId });
        ack && ack({ ok: true, id: m?.id, createdAt: m?.createdAt });
      } catch (e: any) {
        ack && ack({ ok: false, error: e?.message || 'send_failed' });
      }
    });

    socket.on('conversation:broadcastDeleted', (id: string) => {
      if (!id) return;
      io.to(convRoom(id)).emit('conversation:deleted', { id, conversationId: id });
    });
  });

  return io;
}

export const rooms = { userRoom, convRoom };
