import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth } from '../middleware/jwt';
import { getCustomerDb } from '../db/connect';

const router = Router();

/**
 * CLIENT (current user only)
 * GET /api/assist/mine?limit=100&status=pending|accepted|completed
 */
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string; email?: string };
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    if (!ObjectId.isValid(user.id)) return res.status(400).json({ message: 'Bad user id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const query: any = { userId: new ObjectId(user.id) };
    if (status) query.status = status;

    const docs = await coll
      .find(query, {
        sort: { createdAt: -1 },
        limit,
        projection: {
          _id: 1,
          status: 1,
          vehicle: 1,
          location: 1,
          createdAt: 1,
          updatedAt: 1,
          assignedTo: 1,
          userId: 1,
        },
      })
      .toArray();

    const items = docs.map((d) => ({
      id: String(d._id),
      status: d.status || 'pending',
      vehicle: d.vehicle || null,
      location: d.location || null,
      createdAt: d.createdAt || d.created_at || null,
      updatedAt: d.updatedAt || d.updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/**
 * OPERATOR (see everyone’s requests)
 * GET /api/assist/inbox?status=pending|accepted|completed&limit=100
 * - requires any valid operator auth (JWT) but does NOT filter by userId
 * - intended for the operator app inbox/activity
 */
router.get('/inbox', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const query: any = {};
    if (status) query.status = status;

    const docs = await coll
      .find(query, {
        sort: { createdAt: -1 },
        limit,
        projection: {
          _id: 1,
          status: 1,
          vehicle: 1,
          location: 1,
          createdAt: 1,
          updatedAt: 1,
          assignedTo: 1,
          userId: 1,
        },
      })
      .toArray();

    const items = docs.map((d) => ({
      id: String(d._id),
      status: d.status || 'pending',
      vehicle: d.vehicle || null,
      location: d.location || null,
      createdAt: d.createdAt || d.created_at || null,
      updatedAt: d.updatedAt || d.updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

export default router;
