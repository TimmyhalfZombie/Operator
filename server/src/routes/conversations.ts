import { Router } from 'express';
import { Types } from 'mongoose';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';
import { Conversation } from '../models/conversation';
import { ConversationMeta } from '../models/conversationMeta';
import { Message } from '../models/message';
import { getIO } from '../socket';

const r = Router();

function isValidOid(v: string | undefined | null): v is string { return !!v && Types.ObjectId.isValid(v); }

/** List my conversations */
r.get('/', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const limit = Math.min(Number(req.query.limit || 50), 200);
  let pipeline: any[] = [];

  if (isValidOid(me)) pipeline = [{ $match: { members: new Types.ObjectId(me) } }];
  else {
    pipeline = [
      { $addFields: { membersStr: { $map: { input: '$members', as: 'm', in: { $toString: '$$m' } } } } },
      { $match: { membersStr: me } },
    ];
  }

  pipeline.push(
    { $sort: { lastMessageAt: -1, updatedAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'conversationmetas',
        let: { convId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$conversationId', '$$convId'] },
                  ...(isValidOid(me) ? [{ $eq: ['$userId', new Types.ObjectId(me)] }] : [{ $eq: [{ $toString: '$userId' }, me] }]),
                ],
              },
            },
          },
          { $project: { unread: 1, lastReadAt: 1 } },
        ],
        as: 'meta',
      },
    },
    { $unwind: { path: '$meta', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        id: { $toString: '$_id' },
        title: 1,
        requestId: 1,
        lastMessage: 1,
        lastMessageAt: 1,
        unread: '$meta.unread',
      },
    }
  );

  const items = await Conversation.aggregate(pipeline);
  res.json({ items });
});

/** Get messages (ascending) */
r.get('/:id/messages', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  if (!isValidOid(convId)) return res.status(404).json({ error: 'not found' });

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const before = req.query.before ? new Date(String(req.query.before)) : null;

  const conv = await Conversation.findById(convId);
  if (!conv) return res.status(404).json({ error: 'not found' });
  if (!conv.members.map((m: any) => String(m)).includes(me)) return res.status(404).json({ error: 'not found' });

  const q: any = { conversationId: conv._id };
  if (before) q.createdAt = { $lt: before };

  const docs = await Message.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  const items = docs.map((m) => ({
    id: String(m._id),
    conversationId: String(m.conversationId),
    from: String(m.senderId),
    text: m.content,
    createdAt: (m.createdAt ?? new Date()).toISOString(),
  })).reverse();

  // Mark as read (best-effort)
  const now = new Date();
  try {
    if (isValidOid(me)) {
      await ConversationMeta.updateOne(
        { conversationId: conv._id, userId: new Types.ObjectId(me) },
        { $set: { unread: 0, lastReadAt: now } },
        { upsert: true }
      );
  } else {
    await ConversationMeta.updateOne(
      // @ts-ignore allow optional userIdStr when present in schema
      { conversationId: conv._id, userIdStr: me },
      // @ts-ignore allow optional userIdStr when present in schema
      { $set: { unread: 0, lastReadAt: now, userIdStr: me } },
      { upsert: true }
    ).catch(() => void 0);
  }
  } catch (e) {
    console.warn('[rest] mark read failed:', (e as Error).message);
  }

  res.json({ items });
});

/** Ensure/get a conversation for a peer/request */
r.post('/ensure', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  let { peerUserId, requestId } = req.body as { peerUserId?: string; requestId?: string };

  if (!peerUserId && requestId) {
    if (!isValidOid(requestId)) return res.status(400).json({ message: 'requestId must be a valid ObjectId' });
    try {
      const d = await getCustomerDb()
        .collection('assistrequests')
        .findOne({ _id: new Types.ObjectId(requestId) }, { projection: { userId: 1 } as any });
      const resolved = d?.userId ? String(d.userId) : undefined;
      if (resolved && isValidOid(resolved)) peerUserId = resolved;
    } catch {}
  }

  if (!isValidOid(me) || !isValidOid(peerUserId)) {
    return res.status(400).json({ message: 'peerUserId and auth user must be valid ObjectIds' });
  }

  const members = [new Types.ObjectId(me), new Types.ObjectId(peerUserId!)].sort();
  const q: any = { members: { $all: members, $size: 2 } };
  if (requestId) {
    if (!isValidOid(requestId)) return res.status(400).json({ message: 'requestId must be a valid ObjectId' });
    q.requestId = new Types.ObjectId(requestId);
  }

  let conv = await Conversation.findOne(q);
  if (!conv) {
    conv = await Conversation.create({
      members,
      requestId: requestId ? new Types.ObjectId(requestId) : undefined,
      lastMessageAt: new Date(),
    });
  }

  res.json({ id: String(conv._id) });
});

/** Send a message (REST) with native-DB fallback + broadcast */
r.post('/:id/messages', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  const text = String((req.body as any)?.text || '').trim();

  if (!isValidOid(convId)) return res.status(404).json({ error: 'not found' });
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const conv = await Conversation.findById(convId);
    if (!conv) return res.status(404).json({ error: 'not found' });
    if (!conv.members.map((m: any) => String(m)).includes(me)) return res.status(404).json({ error: 'not found' });

    const stamp = new Date();
    let msg: any = null;

    // Try mongoose
    try {
      const sender = isValidOid(me) ? new Types.ObjectId(me) : me;
      msg = await Message.create({
        conversationId: conv._id,   // ObjectId
        senderId: sender,           // ObjectId or string if schema allows
        content: text,
        createdAt: stamp,
      });
      if (process.env.NODE_ENV !== 'production') console.log('[rest] mongoose insert OK:', String(msg._id));
    } catch (e) {
      console.error('[rest] mongoose insert failed, falling back to native:', (e as Error).message);
      const db = await getCustomerDb();
      const ins = await db.collection('messages').insertOne({
        conversationId: conv._id,   // ObjectId
        senderId: isValidOid(me) ? new Types.ObjectId(me) : me,
        content: text,
        createdAt: stamp,
      });
      msg = { _id: ins.insertedId, conversationId: conv._id, senderId: me, content: text, createdAt: stamp };
    }

    await Conversation.findByIdAndUpdate(conv._id, { lastMessage: text, lastMessageAt: stamp }).catch((e) =>
      console.warn('[rest] update conversation preview failed:', (e as Error).message)
    );

  const others = conv.members.map((m: any) => String(m)).filter((id: string) => id !== me);
    await Promise.all(
      others.map(async (uid: string) => {
        try {
          if (isValidOid(uid)) {
            await ConversationMeta.updateOne(
              { conversationId: conv._id, userId: new Types.ObjectId(uid) },
              { $inc: { unread: 1 } },
              { upsert: true }
            );
          } else {
            await ConversationMeta.updateOne(
              // @ts-ignore allow optional userIdStr when present in schema
              { conversationId: conv._id, userIdStr: uid },
              // @ts-ignore allow optional userIdStr when present in schema
              { $inc: { unread: 1 }, $setOnInsert: { userIdStr: uid } },
              { upsert: true }
            ).catch(() => void 0);
          }
        } catch (e) {
          console.warn('[rest] unread update failed for', uid, (e as Error).message);
        }
      })
    );

    const payload = {
      id: String(msg._id),
      conversationId: String(conv._id),
      from: String(msg.senderId),
      text,
      createdAt: (msg.createdAt ?? stamp).toISOString(),
    };

    try {
      const io = getIO();
      if (process.env.NODE_ENV !== 'production') console.log('[rest] broadcasting message:new', payload);
      io.to(`conv:${payload.conversationId}`).emit('message:new', payload);
    } catch {}

    res.json(payload);
  } catch (e: any) {
    console.error('[rest] message create failed:', e?.message || e);
    res.status(500).json({ error: 'insert_failed', detail: e?.message || String(e) });
  }
});

export default r;
