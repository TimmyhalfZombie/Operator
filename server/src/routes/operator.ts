import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAuthDb } from '../db/connect';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * GET /api/users/me/location
 * Source of truth: appdb.users
 * Returns { lat, lng, address, updated_at }
 */
router.get('/users/me/location', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const db = getAuthDb(); // <-- appdb
    const users = db.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          // prefer last_* then fall back to initial_*, tolerate common variants
          last_lat: 1,
          last_lng: 1,
          last_long: 1,
          last_address: 1,
          last_seen_at: 1,
          initial_lat: 1,
          initial_lng: 1,
          initial_long: 1,
          inital_lat: 1,
          inital_long: 1,
          initial_address: 1,
          initial_loc_at: 1,
        },
      }
    );

    if (!user) return res.status(404).json({ error: 'user not found' });

    const lat =
      user.last_lat ??
      user.initial_lat ??
      user.inital_lat ??
      null;

    const lng =
      user.last_lng ??
      user.last_long ??
      user.initial_lng ??
      user.initial_long ??
      user.inital_long ??
      null;

    if (lat == null || lng == null) {
      return res.status(404).json({ error: 'location not found' });
    }

    return res.json({
      lat: Number(lat),
      lng: Number(lng),
      address: user.last_address ?? user.initial_address ?? null,
      updated_at: user.last_seen_at ?? user.initial_loc_at ?? null,
    });
  } catch (err) {
    console.error('GET /users/me/location failed', err);
    return res.status(500).json({ error: 'failed to read location' });
  }
});

/**
 * POST /api/users/me/location
 * Updates operator location in appdb.users with { lat, lng, address? }
 */
router.post('/users/me/location', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { lat, lng, address } = req.body || {};

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }

    const updatedAt = new Date();

    // Optionally reverse geocode if address missing (best-effort)
    let resolvedAddress: string | null = address || null;
    if (!resolvedAddress) {
      try {
        const { reverseGeocode } = await import('./geo');
        const out = await reverseGeocode(latNum, lngNum);
        if (out) resolvedAddress = out;
      } catch {
        // swallow; address stays null
      }
    }

    // Write to appdb.users
    const db = getAuthDb();
    const users = db.collection('users');

    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          last_lat: latNum,
          last_lng: lngNum,
          last_address: resolvedAddress ?? null,
          last_seen_at: updatedAt,
        },
        $setOnInsert: {
          // ensure document has the base shape even if created here
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    return res.json({
      success: true,
      lat: latNum,
      lng: lngNum,
      address: resolvedAddress ?? null,
      updated_at: updatedAt,
    });
  } catch (err) {
    console.error('POST /users/me/location failed', err);
    return res.status(500).json({ error: 'failed to update location' });
  }
});

/**
 * (Optional maintenance)
 * POST /api/operator/update-initial-from-last
 * If a user has only initial_* fields missing but has last_*, copy them over once.
 */
router.post('/operator/update-initial-from-last', requireAuth, async (_req: any, res) => {
  try {
    const db = getAuthDb();
    const users = db.collection('users');

    const cur = users.find({
      last_lat: { $exists: true },
      last_lng: { $exists: true },
      $or: [{ initial_lat: { $exists: false } }, { initial_lng: { $exists: false } }],
    });

    let updated = 0;
    for await (const u of cur) {
      await users.updateOne(
        { _id: u._id },
        {
          $set: {
            initial_lat: u.initial_lat ?? u.last_lat,
            initial_lng: u.initial_lng ?? u.last_lng ?? u.last_long,
            initial_address: u.initial_address ?? u.last_address ?? null,
            initial_loc_at: u.initial_loc_at ?? u.last_seen_at ?? new Date(),
          },
        }
      );
      updated++;
    }

    return res.json({ success: true, updated });
  } catch (err) {
    console.error('POST /operator/update-initial-from-last failed', err);
    return res.status(500).json({ error: 'failed to update initial fields' });
  }
});

export default router;
