import { Router } from 'express';
import requireAuth from '../middleware/requireAuth';
import { Conversation } from '../models/conversation';
import { ConversationMeta } from '../models/conversationMeta';
import { Message } from '../models/message';
import { Types } from 'mongoose';

const r = Router();

/** List my conversations (with preview + unread) */
r.get('/', requireAuth, async (req: any, res) => {
  const me = String(req.user.id);
  const limit = Math.min(Number(req.query.limit || 50), 200);

  const items = await Conversation.aggregate([
    { $match: { members: new Types.ObjectId(me) } },
    { $sort: { lastMessageAt: -1, updatedAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'conversationmetas',
        let: { convId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$conversationId', '$$convId'] }, { $eq: ['$userId', new Types.ObjectId(me)] }] } } },
          { $project: { unread: 1, lastReadAt: 1 } }
        ],
        as: 'meta',
      },
    },
    { $unwind: { path: '$meta', preserveNullAndEmptyArrays: true } },
    { $project: { id: { $toString: '$_id' }, title: 1, requestId: 1, lastMessage: 1, lastMessageAt: 1, unread: '$meta.unread' } }
  ]);

  res.json({ items });
});

/** Get messages for a conversation (newest first, paginated) */
r.get('/:id/messages', requireAuth, async (req: any, res) => {
  const me = String(req.user.id);
  const convId = String(req.params.id);
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const before = req.query.before ? new Date(String(req.query.before)) : null;

  const conv = await Conversation.findById(convId);
  if (!conv || !conv.members.map(String).includes(me)) {
    return res.status(404).json({ error: 'not found' });
  }

  const q: any = { conversationId: conv._id };
  if (before) q.createdAt = { $lt: before };

  const docs = await Message.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  const items = docs
    .map((m) => ({
      id: String(m._id),
      conversationId: String(m.conversationId),
      from: String(m.senderId),
      text: m.content,
      createdAt: (m.createdAt ?? new Date()).toISOString(),
    }))
    .reverse();

  // mark as read for me
  await ConversationMeta.updateOne(
    { conversationId: conv._id, userId: me },
    { $set: { unread: 0, lastReadAt: new Date() } },
    { upsert: true }
  );

  res.json({ items });
});

/** Send a message (REST fallback) */
r.post('/:id/messages', requireAuth, async (req: any, res) => {
  const me = String(req.user.id);
  const convId = String(req.params.id);
  const { text } = req.body as { text: string };

  const conv = await Conversation.findById(convId);
  if (!conv || !conv.members.map(String).includes(me)) {
    return res.status(404).json({ error: 'not found' });
  }

  const m = await Message.create({
    conversationId: conv._id,
    senderId: me,
    content: text,
  });

  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: m.content,
    lastMessageAt: m.createdAt ?? new Date(),
  });

  // unread+1 for others
  const others = conv.members.map(String).filter((id) => id !== me);
  await Promise.all(
    others.map((userId) =>
      ConversationMeta.updateOne(
        { conversationId: conv._id, userId },
        { $inc: { unread: 1 } },
        { upsert: true }
      )
    )
  );

  res.json({
    id: String(m._id),
    conversationId: String(m.conversationId),
    from: String(m.senderId),
    text: m.content,
    createdAt: (m.createdAt ?? new Date()).toISOString(),
  });
});

/** (Optional) Ensure/get a conversation for a specific request+peer */
r.post('/ensure', requireAuth, async (req: any, res) => {
  const me = String(req.user.id);
  const { peerUserId, requestId } = req.body as { peerUserId: string; requestId?: string };

  const members = [new Types.ObjectId(me), new Types.ObjectId(peerUserId)].sort();
  const q: any = { members: { $all: members, $size: 2 } };
  if (requestId) q.requestId = new Types.ObjectId(requestId);

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

export default r;
