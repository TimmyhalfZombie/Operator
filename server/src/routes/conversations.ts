import { Router } from 'express';
import { Types } from 'mongoose';
import { getAuthDb, getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';
import { Conversation } from '../models/conversation';
import { ConversationMeta } from '../models/conversationMeta';
import { Message } from '../models/message';
import { getIO } from '../socket';

function sanitizeMessageText(raw: any): string {
  const collapsed = String(raw ?? '').replace(/[\s\u00A0]+/g, ' ').trim();
  if (!collapsed) return '';
  const tokens = collapsed.split(' ');
  if (tokens.length > 1 && tokens.every((tok) => tok.length === 1)) {
    return tokens.join('');
  }
  return collapsed;
}

const r = Router();

function isValidOid(v: string | undefined | null): v is string { return !!v && Types.ObjectId.isValid(v); }

/* ---------------- helpers: robust title resolution ---------------- */

function pickFirstString(obj: any, paths: string[]): string | null {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    for (const k of parts) {
      if (cur == null) { cur = undefined; break; }
      cur = cur[k];
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim();
  }
  return null;
}

function deriveTitleFromAssist(assist: any): string | null {
  if (!assist) return null;
  // Try a bunch of common field names people use in assist/request docs
  return (
    pickFirstString(assist, [
      'clientName',
      'customerName',
      'name',
      'displayName',
      'fullName',
      'title',
      'contact.name',
      'profile.name',
      'user.name',
      'requesterName',
    ]) || null
  );
}

function deriveTitleFromUser(user: any): string | null {
  if (!user) return null;
  // Prefer explicit names, then username, then email/phone
  const full =
    pickFirstString(user, [
      'name',
      'displayName',
      'fullName',
      'firstname',
      'firstName',
      'given_name',
    ]) &&
    pickFirstString(user, ['lastname', 'lastName', 'family_name'])
      ? `${pickFirstString(user, ['firstname','firstName','given_name'])} ${pickFirstString(user, ['lastname','lastName','family_name'])}`
      : null;

  return (
    full ||
    pickFirstString(user, [
      'name',
      'displayName',
      'fullName',
      'username',
      'firstName',
      'given_name',
      'email',
      'phone',
    ]) ||
    null
  );
}

async function resolveTitleAndPeer(me: string, conv: any) {
  const customerDb = getCustomerDb();
  const authDb = getAuthDb();

  const participants = (conv?.participants || []).map((m: any) => String(m));
  const otherIdStr = participants.find((m: string) => m !== String(me)) || null;

  let title: string | null = conv?.title || null;
  let peer: any = null;

  // 1) Try requestId explicitly
  if (!title && conv?.requestId) {
    try {
      const assist = await customerDb
        .collection('assistrequests')
        .findOne({ _id: conv.requestId as any });
      title = deriveTitleFromAssist(assist);
    } catch {}
  }

  // 2) Try latest assistrequest for this peer (if we have peer id)
  if (!title && otherIdStr && isValidOid(otherIdStr)) {
    try {
      const assist = await customerDb
        .collection('assistrequests')
        .find({ userId: new Types.ObjectId(otherIdStr) })
        .project({ clientName: 1, customerName: 1, name: 1, displayName: 1, fullName: 1, contact: 1, profile: 1, user: 1, requesterName: 1, createdAt: 1 } as any)
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
      title = deriveTitleFromAssist(assist);
    } catch {}
  }

  // 3) Load peer record and use it for both peer info and title fallback
  if (otherIdStr && isValidOid(otherIdStr)) {
    try {
      const u = await authDb
        .collection('users')
        .findOne(
          { _id: new Types.ObjectId(otherIdStr) },
          { projection: { username: 1, phone: 1, email: 1, name: 1, displayName: 1, fullName: 1, firstname: 1, firstName: 1, lastname: 1, lastName: 1, given_name: 1, family_name: 1, avatarUrl: 1 } as any }
        );
      const name = deriveTitleFromUser(u);
      peer = {
        id: otherIdStr,
        username: u?.username ?? null,
        phone: u?.phone ?? null,
        email: u?.email ?? null,
        name: name ?? null,
        avatarUrl: u?.avatarUrl ?? null,
      };
      if (!title) title = name;
    } catch {}
  }

  return { title: title || null, peer, participants };
}

/* ---------------- list: previews (with better title) ---------------- */

r.get('/', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const limit = Math.min(Number(req.query.limit || 50), 200);

  const coalesceStage = {
    $addFields: {
      participants: {
        $cond: [
          { $gt: [{ $size: { $ifNull: ['$participants', []] } }, 0] },
          '$participants',
          '$members',
        ],
      },
    },
  };

  let pipeline: any[] = [];
  if (isValidOid(me)) pipeline = [coalesceStage, { $match: { participants: new Types.ObjectId(me) } }];
  else {
    pipeline = [
      coalesceStage,
      { $addFields: { participantsStr: { $map: { input: '$participants', as: 'm', in: { $toString: '$$m' } } } } },
      { $match: { participantsStr: me } },
    ];
  }

  pipeline.push(
    { $sort: { lastMessageAt: -1, updatedAt: -1 } },
    { $limit: limit },
    {
      $project: {
        id: { $toString: '$_id' },
        _id: 1,
        participants: 1,
        requestId: 1,
        title: 1,
        lastMessage: 1,
        lastMessageAt: 1,
      },
    }
  );

  const raw = await Conversation.aggregate(pipeline);
  const items = await Promise.all(
    raw.map(async (c: any) => {
      const { title } = await resolveTitleAndPeer(me, c);
      // Load unread for me (best-effort)
      let unread: number | null = null;
      try {
        const meta = await ConversationMeta.findOne(
          isValidOid(me)
            ? { conversationId: c._id, userId: new Types.ObjectId(me) }
            // @ts-ignore optional userIdStr when present
            : { conversationId: c._id, userIdStr: me }
        ).lean();
        unread = (meta as any)?.unread ?? null;
      } catch {}
      return {
        id: String(c._id),
        title: title || 'Conversation',
        requestId: c.requestId ? String(c.requestId) : null,
        lastMessage: c.lastMessage ?? null,
        lastMessageAt: c.lastMessageAt ?? null,
        participants: Array.isArray(c.participants) ? c.participants.map((m: any) => String(m)) : [],
        unread,
      };
    })
  );

  res.json({ items });
});

/* ---------------- detail: title + peer info ---------------- */

r.get('/:id', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  if (!isValidOid(convId)) return res.status(404).json({ error: 'not_found' });

  const conv = await Conversation.findById(convId);
  if (!conv) return res.status(404).json({ error: 'not_found' });
  const participants = (conv.participants || []).map((m: any) => String(m));
  if (!participants.includes(me)) return res.status(404).json({ error: 'not_found' });

  const { title, peer } = await resolveTitleAndPeer(me, conv);

  // unread for me
  let unread: number | null = null;
  try {
    const meta = await ConversationMeta.findOne(
      isValidOid(me)
        ? { conversationId: conv._id, userId: new Types.ObjectId(me) }
        // @ts-ignore when schema allows
        : { conversationId: conv._id, userIdStr: me }
    ).lean();
    unread = (meta as any)?.unread ?? null;
  } catch {}

  res.json({
    id: String(conv._id),
    requestId: conv.requestId ? String(conv.requestId) : null,
    participants,
    title: title || 'Conversation',
    peer,
    lastMessage: (conv as any)?.lastMessage ?? null,
    lastMessageAt: (conv as any)?.lastMessageAt ?? null,
    unread,
  });
});

/* ---------------- messages ---------------- */

r.get('/:id/messages', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  if (!isValidOid(convId)) return res.status(404).json({ error: 'not found' });

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const before = req.query.before ? new Date(String(req.query.before)) : null;

  const conv = await Conversation.findById(convId);
  if (!conv) return res.status(404).json({ error: 'not found' });
  if (!conv.participants.map((m: any) => String(m)).includes(me)) return res.status(404).json({ error: 'not found' });

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

  const now = new Date();
  try {
    if (isValidOid(me)) {
      await ConversationMeta.updateOne(
        { conversationId: conv._id, userId: new Types.ObjectId(me) },
        { $set: { unread: 0, lastReadAt: now } },
        { upsert: true }
      );
    } else {
      // @ts-ignore when schema allows userIdStr
      await ConversationMeta.updateOne(
        { conversationId: conv._id, userIdStr: me },
        { $set: { unread: 0, lastReadAt: now, userIdStr: me } },
        { upsert: true }
      ).catch(() => void 0);
    }
  } catch (e) {
    console.warn('[rest] mark read failed:', (e as Error).message);
  }

  res.json({ items });
});

/* ---------------- delete message ---------------- */

r.delete('/:id/messages/:messageId', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  const messageId = String(req.params.messageId || '');

  if (!isValidOid(convId) || !isValidOid(messageId)) return res.status(404).json({ error: 'not found' });

  try {
    const conv = await Conversation.findById(convId);
    if (!conv) return res.status(404).json({ error: 'not found' });
    if (!conv.participants.map((m: any) => String(m)).includes(me)) return res.status(404).json({ error: 'not found' });

    const msg = await Message.findOneAndDelete({ _id: new Types.ObjectId(messageId), conversationId: conv._id });
    if (!msg) return res.status(404).json({ error: 'not found' });

    // Update conversation preview if needed
    try {
      const latest = (await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 }).lean()) as any;
      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessage: latest?.content ?? latest?.text ?? null,
        lastMessageAt: latest?.createdAt ?? null,
      }).catch(() => void 0);
    } catch (e) {
      console.warn('[rest] update conversation preview after delete failed:', (e as Error).message);
    }

    try {
      const io = getIO();
      io.to(`conv:${convId}`).emit('message:deleted', {
        success: true,
        conversationId: String(convId),
        messageId: String(messageId),
      });
    } catch {}

    res.json({ ok: true });
  } catch (e: any) {
    console.error('[rest] delete message failed:', e?.message || e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/* ---------------- ensure conversation ---------------- */

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

  const participantsArr = [new Types.ObjectId(me), new Types.ObjectId(peerUserId!)].sort();
  const participantsHash = participantsArr.map(String).sort().join(':');
  const q: any = { participantsHash };

  let conv = await Conversation.findOne(q);
  if (!conv) {
    if (requestId && !isValidOid(requestId)) {
      return res.status(400).json({ message: 'requestId must be a valid ObjectId' });
    }
    try {
      conv = await Conversation.create({
        participants: participantsArr,
        requestId: requestId ? new Types.ObjectId(requestId) : undefined,
        lastMessageAt: new Date(),
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        conv = await Conversation.findOne(q);
      }
      if (!conv) throw err;
    }
  } else if (requestId && !conv.requestId && isValidOid(requestId)) {
    await Conversation.updateOne({ _id: conv._id }, { $set: { requestId: new Types.ObjectId(requestId) } }).catch(() => void 0);
  }

  res.json({ id: String(conv._id) });
});

/* ---------------- send (REST) + broadcast ---------------- */

r.post('/:id/messages', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  const text = sanitizeMessageText((req.body as any)?.text || '');

  if (!isValidOid(convId)) return res.status(404).json({ error: 'not found' });
  if (!text) return res.status(400).json({ error: 'Text is required' });

  try {
    const conv = await Conversation.findById(convId);
    if (!conv) return res.status(404).json({ error: 'not found' });
    if (!conv.participants.map((m: any) => String(m)).includes(me)) return res.status(404).json({ error: 'not found' });

    const stamp = new Date();
    const sender = isValidOid(me) ? new Types.ObjectId(me) : me;
    const msg = await Message.create({
      conversationId: conv._id,
      senderId: sender,
      content: text,
      createdAt: stamp,
    });

    await Conversation.findByIdAndUpdate(conv._id, { lastMessage: text, lastMessageAt: stamp }).catch((e) =>
      console.warn('[rest] update conversation preview failed:', (e as Error).message)
    );

    const others = conv.participants.map((m: any) => String(m)).filter((id: string) => id !== me);
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
            // @ts-ignore when schema allows userIdStr
            await ConversationMeta.updateOne(
              { conversationId: conv._id, userIdStr: uid },
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
      io.to(`conv:${payload.conversationId}`).emit('message:new', payload);
    } catch {}

    res.json(payload);
  } catch (e: any) {
    console.error('[rest] message create failed:', e?.message || e);
    res.status(500).json({ error: 'insert_failed', detail: e?.message || String(e) });
  }
});

/* ---------------- delete ---------------- */

r.delete('/:id', requireAuth as any, async (req: any, res) => {
  const me: string = String(req.user?.id || '');
  const convId = String(req.params.id || '');
  if (!isValidOid(convId)) return res.status(404).json({ error: 'not_found' });

  try {
    const conv = await Conversation.findById(convId);
    if (!conv) return res.status(404).json({ error: 'not_found' });
    const isMember = conv.participants.map((m: any) => String(m)).includes(me);
    if (!isMember) return res.status(403).json({ error: 'forbidden' });

    const db = getCustomerDb();
    await db.collection('messages').deleteMany({ conversationId: conv._id });
    await db.collection('conversationmetas').deleteMany({ conversationId: conv._id });
    await Conversation.deleteOne({ _id: conv._id });

    try {
      const io = getIO();
      io.to(`conv:${convId}`).emit('conversation:deleted', { id: convId });
    } catch {}

    res.json({ ok: true });
  } catch (e) {
    console.error('[rest] delete conversation failed:', (e as Error).message);
    res.status(500).json({ error: 'delete_failed' });
  }
});

export default r;
