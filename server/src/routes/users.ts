import { Router } from 'express';
import { ObjectId, type Document, type UpdateFilter } from 'mongodb';
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

    // Read operator location from the app DB (appdb)
    const db = getAuthDb();
    const users = db.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          initial_lat: 1,
          initial_lng: 1,
          // tolerate alternate spellings/keys
          initial_long: 1,
          inital_lat: 1,
          inital_long: 1,
          initial_address: 1,
          initial_loc_at: 1,
          last_lat: 1,
          last_lng: 1,
          last_long: 1,
          last_address: 1,
          last_seen_at: 1,
        },
      }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    // prefer last_* then fall back to initial_*, accepting common alternate keys
    const lat =
      user.last_lat ??
      user.initial_lat ??
      user.inital_lat ?? // tolerate typo
      null;

    const lng =
      user.last_lng ??
      user.last_long ??
      user.initial_lng ??
      user.initial_long ??
      user.inital_long ?? // tolerate typo
      null;
    const address = user.last_address ?? user.initial_address;
    const updated_at = user.last_seen_at ?? user.initial_loc_at;

    if (lat == null || lng == null) return res.status(404).json({ message: 'Location not found' });

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
 * POST /api/users/me/location
 * Body: { lat: number, lng: number, address?: string }
 * Updates operator's last_* fields in appdb.users so client maps can read it.
 */
router.post('/me/location', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const latNum = Number(req.body?.lat);
    const lngNum = Number(req.body?.lng);
    const address = req.body?.address ? String(req.body.address) : null;

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ message: 'Invalid lat/lng' });
    }

    const db = getAuthDb(); // appdb
    const users = db.collection('users');

    const updatedAt = new Date();

    // Read existing initial_* to avoid overwriting if already set
    const existing = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { initial_lat: 1, initial_lng: 1, initial_long: 1, initial_address: 1, initial_loc_at: 1 } }
    );

    const hasInitialLat = existing && (existing as any).initial_lat != null;
    const hasInitialLng = existing && ((existing as any).initial_lng != null || (existing as any).initial_long != null);

    const setDoc: Record<string, any> = {
      // Always keep last_* updated for live location
      last_lat: latNum,
      last_lng: lngNum,
      last_long: lngNum,
      last_address: address,
      last_seen_at: updatedAt,
    };

    // Backfill initial_* once if missing so clients using initial_* work
    if (!hasInitialLat) setDoc.initial_lat = latNum;
    if (!hasInitialLng) {
      setDoc.initial_lng = lngNum;
      setDoc.initial_long = lngNum; // compatibility with schemas using "long"
    }
    if (existing && (existing as any).initial_address == null && address != null) {
      setDoc.initial_address = address;
    }
    if (existing && (existing as any).initial_loc_at == null) {
      setDoc.initial_loc_at = updatedAt;
    }

    await users.updateOne(
      { _id: new ObjectId(id) },
      { $set: setDoc },
      { upsert: true }
    );

    res.json({ ok: true, lat: latNum, lng: lngNum, address, updated_at: updatedAt });
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
      const update: UpdateFilter<Document> = { $pull: { expoPushTokens: token } } as any;
      await users.updateOne(
        { _id: new ObjectId(id) },
        update
      );
    } else {
      const update: UpdateFilter<Document> = { $set: { expoPushTokens: [] } } as any;
      await users.updateOne(
        { _id: new ObjectId(id) },
        update
      );
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
