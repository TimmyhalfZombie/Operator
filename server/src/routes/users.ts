import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAuthDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';

const router = Router();

/**
 * GET /api/users/me
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const db = getAuthDb();
    const users = db.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { username: 1, phone: 1, email: 1 } }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      username: user.username ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/users/me/location
 */
router.get('/me/location', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const db = getAuthDb();
    const users = db.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          initial_lat: 1,
          initial_lng: 1,
          initial_address: 1,
          initial_loc_at: 1,
          last_lat: 1,
          last_lng: 1,
          last_address: 1,
          last_seen_at: 1,
        },
      }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    const lat = user.last_lat ?? user.initial_lat;
    const lng = user.last_lng ?? user.initial_lng;
    const address = user.last_address ?? user.initial_address;
    const updated_at = user.last_seen_at ?? user.initial_loc_at;

    if (lat == null || lng == null) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.json({
      lat: Number(lat),
      lng: Number(lng),
      address: address ?? null,
      updated_at: updated_at ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/users/me/push-token
 * Body: { token: string }
 * Saves Expo push token (addToSet -> allows multiple devices)
 */
router.post('/me/push-token', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    const token = String(req.body?.token || '').trim();

    if (!token) return res.status(400).json({ message: 'Missing token' });
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const db = getAuthDb();
    const users = db.collection('users');

    await users.updateOne(
      { _id: new ObjectId(id) },
      {
        $addToSet: { expoPushTokens: token },
        $set: { last_seen_at: new Date() },
      }
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/users/me/push-token
 * Body: { token: string }  (optional – removes one; if omitted, clears all)
 */
router.delete('/me/push-token', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const token = req.body?.token ? String(req.body.token) : null;

    const db = getAuthDb();
    const users = db.collection('users');

    if (token) {
      await users.updateOne(
        { _id: new ObjectId(id) },
        { $pull: { expoPushTokens: token } }
      );
    } else {
      await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { expoPushTokens: [] } }
      );
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
