// server/src/routes/conversations.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { Conversation } from '../models/conversation';
import { ConversationMeta } from '../models/conversationMeta';
import { Message } from '../models/message';
import { Types } from 'mongoose';

const r = Router();

function isValidOid(v: string | undefined | null): v is string {
  return !!v && Types.ObjectId.isValid(v);
}

/** List my conversations (preview + unread) */
r.get('/', requireAuth, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const limit = Math.min(Number(req.query.limit || 50), 200);

  let pipeline: any[] = [];

  if (isValidOid(me)) {
    // Fast path when JWT id is an ObjectId
    pipeline = [
      { $match: { members: new Types.ObjectId(me) } },
    ];
  } else {
    // Fallback: compare by string representation of members
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
                  {
                    // If req.user.id is not ObjectId, compare by string
                    ...(isValidOid(me)
                      ? { $eq: ['$userId', new Types.ObjectId(me)] }
                      : {
                          $eq: [{ $toString: '$userId' }, me],
                        }),
                  },
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

/** Get messages for a conversation (newest first → reversed for display) */
r.get('/:id/messages', requireAuth, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');

  // Validate conversation id
  if (!isValidOid(convId)) {
    return res.status(404).json({ error: 'not found' });
  }

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const before = req.query.before ? new Date(String(req.query.before)) : null;

  const conv = await Conversation.findById(convId);
  if (!conv) return res.status(404).json({ error: 'not found' });

  // Membership check tolerant to non-ObjectId JWT ids
  const isMember = conv.members.map((m: any) => String(m)).includes(me);
  if (!isMember) return res.status(404).json({ error: 'not found' });

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

  // Mark as read for me (store as ObjectId when possible; else best-effort string compare path)
  if (isValidOid(me)) {
    await ConversationMeta.updateOne(
      { conversationId: conv._id, userId: new Types.ObjectId(me) },
      { $set: { unread: 0, lastReadAt: new Date() } },
      { upsert: true }
    );
  } else {
    // Fallback path for non-ObjectId user ids: track by stringified userId in a separate field if your schema supports it,
    // or simply skip unread tracking for non-ObjectId users.
    await ConversationMeta.updateOne(
      // @ts-expect-error: if your schema only allows ObjectId, you may omit this block
      { conversationId: conv._id, userIdStr: me },
      { $set: { unread: 0, lastReadAt: new Date(), userIdStr: me } },
      { upsert: true }
    ).catch(() => void 0);
  }

  res.json({ items });
});

/** Ensure/get a conversation for a specific request+peer */
r.post('/ensure', requireAuth, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const { peerUserId, requestId } = req.body as { peerUserId: string; requestId?: string };

  // For integrity, require ObjectIds for participants (prevents duplicates across types)
  if (!isValidOid(me) || !isValidOid(peerUserId)) {
    return res.status(400).json({ message: 'peerUserId and auth user must be valid ObjectIds' });
  }

  const members = [new Types.ObjectId(me), new Types.ObjectId(peerUserId)].sort();
  const q: any = { members: { $all: members, $size: 2 } };

  if (requestId) {
    if (!isValidOid(requestId)) {
      return res.status(400).json({ message: 'requestId must be a valid ObjectId' });
    }
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

/** Send a message (REST) */
r.post('/:id/messages', requireAuth, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  const { text } = req.body as { text: string };

  if (!isValidOid(convId)) return res.status(404).json({ error: 'not found' });

  const conv = await Conversation.findById(convId);
  if (!conv) return res.status(404).json({ error: 'not found' });

  const isMember = conv.members.map((m: any) => String(m)).includes(me);
  if (!isMember) return res.status(404).json({ error: 'not found' });

  const m = await Message.create({
    conversationId: conv._id,
    senderId: isValidOid(me) ? new Types.ObjectId(me) : me, // if your schema enforces ObjectId, ensure JWT id is ObjectId
    content: text,
  });

  await Conversation.findByIdAndUpdate(conv._id, {
    lastMessage: m.content,
    lastMessageAt: m.createdAt ?? new Date(),
  });

  // unread +1 for others
  const others = conv.members.map((x: any) => String(x)).filter((id: string) => id !== me);

  await Promise.all(
    others.map(async (uid: string) => {
      if (isValidOid(uid)) {
        await ConversationMeta.updateOne(
          { conversationId: conv._id, userId: new Types.ObjectId(uid) },
          { $inc: { unread: 1 } },
          { upsert: true }
        );
      } else {
        await ConversationMeta.updateOne(
          // @ts-expect-error: see note in GET messages about userIdStr
          { conversationId: conv._id, userIdStr: uid },
          { $inc: { unread: 1 }, $setOnInsert: { userIdStr: uid } },
          { upsert: true }
        ).catch(() => void 0);
      }
    })
  );

  res.json({
    id: String(m._id),
    conversationId: String(m.conversationId),
    from: String(m.senderId),
    text: m.content,
    createdAt: (m.createdAt ?? new Date()).toISOString(),
  });
});

export default r;
