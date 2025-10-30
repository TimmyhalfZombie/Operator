import { Router } from 'express';
import { Types } from 'mongoose';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/** Normalize/whitelist outgoing user fields. Returns both snake_case and camelCase so the client never misses. */
function toPublicUser(u: any) {
  if (!u) return null;

  // prefer explicit initial_* fields; fall back to nested location.*
  const initial_lat =
    u.initial_lat ?? u.initialLat ?? u.location?.initial_lat ?? u.location?.initialLat ?? u.lat ?? u.location?.lat ?? null;

  const initial_long =
    u.initial_long ??
    u.initialLong ??
    u.initial_lng ??
    u.initialLng ??
    u.location?.initial_long ??
    u.location?.initialLong ??
    u.location?.initial_lng ??
    u.location?.initialLng ??
    u.lng ??
    u.location?.lng ??
    null;

  const initial_address =
    u.initial_address ??
    u.initialAddress ??
    u.location?.initial_address ??
    u.location?.initialAddress ??
    u.address ??
    u.location?.address ??
    null;

  const base = {
    _id: String(u._id ?? u.id ?? ''),
    name: u.name ?? null,
    email: u.email ?? null,
    phone: u.phone ?? null,
    avatar: u.avatar ?? null,

    // canonical (snake_case)
    initial_lat,
    initial_long,
    initial_address,

    // mirrors (camelCase)
    initialLat: initial_lat,
    initialLong: initial_long,
    initialAddress: initial_address,

    // last known current coords if you keep them
    lat: u.lat ?? u.location?.lat ?? null,
    lng: u.lng ?? u.location?.lng ?? null,
    address: u.address ?? u.location?.address ?? null,

    updated_at: u.updated_at ?? u.updatedAt ?? u.location?.updated_at ?? u.location?.updatedAt ?? null,
  };

  return base;
}

async function findUserDocById(userId: string) {
  const db = await getCustomerDb();
  const coll = db.collection('users');

  // Support ObjectId or string id
  const filter = Types.ObjectId.isValid(userId)
    ? { _id: new Types.ObjectId(userId) }
    : { _id: userId };

  return coll.findOne(filter);
}

/** GET /api/users/me – return my profile with initial_* */
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const meId = String(req.user?.id ?? req.user?._id ?? '');
    if (!meId) return res.status(401).json({ message: 'Unauthorized' });

    const doc = await findUserDocById(meId);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json(toPublicUser(doc));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load profile' });
  }
});

/** GET /api/users/:id – return a user's public profile with initial_* */
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const doc = await findUserDocById(id);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json(toPublicUser(doc));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load user' });
  }
});

/** GET /api/users/me/location – normalized lat/lng/address (prefers initial_* if present) */
router.get('/me/location', requireAuth, async (req: any, res) => {
  try {
    const meId = String(req.user?.id ?? req.user?._id ?? '');
    if (!meId) return res.status(401).json({ message: 'Unauthorized' });

    const doc = await findUserDocById(meId);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    const u = toPublicUser(doc);
    return res.json({
      lat: (u.initial_lat ?? u.lat) ?? null,
      lng: (u.initial_long ?? u.lng) ?? null,
      address: (u.initial_address ?? u.address) ?? null,

      // include both spellings (helps older clients)
      initial_lat: u.initial_lat ?? null,
      initial_long: u.initial_long ?? null,
      initial_address: u.initial_address ?? null,
      updated_at: u.updated_at ?? null,
    });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load location' });
  }
});

/** POST /api/users/me/location – update my current/initial location */
router.post('/me/location', requireAuth, async (req: any, res) => {
  try {
    const meId = String(req.user?.id ?? req.user?._id ?? '');
    if (!meId) return res.status(401).json({ message: 'Unauthorized' });

    // incoming from device
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const address =
      req.body?.address ??
      req.body?.initial_address ??
      req.body?.initialAddress ??
      null;

    const db = await getCustomerDb();
    const coll = db.collection('users');

    const filter = Types.ObjectId.isValid(meId)
      ? { _id: new Types.ObjectId(meId) }
      : { _id: meId };

    // Read current doc to only set initial_* once
    const existing = await coll.findOne(filter);

    const $set: any = {
      'location.updated_at': new Date(),
    };
    if (Number.isFinite(lat)) $set['location.lat'] = lat;
    if (Number.isFinite(lng)) $set['location.lng'] = lng;
    if (typeof address === 'string') $set['location.address'] = address;

    // Only set initial_* if missing
    if (!existing) {
      if (Number.isFinite(lat)) $set.initial_lat = lat;
      if (Number.isFinite(lng)) $set.initial_long = lng;
      if (typeof address === 'string' && address.trim()) $set.initial_address = address.trim();
    } else {
      if (existing.initial_lat == null && Number.isFinite(lat)) $set.initial_lat = lat;
      if (existing.initial_long == null && Number.isFinite(lng)) $set.initial_long = lng;
      if (existing.initial_address == null && typeof address === 'string' && address.trim()) {
        $set.initial_address = address.trim();
      }
    }

    await coll.updateOne(filter, { $set }, { upsert: true });
    const fresh = await coll.findOne(filter);
    return res.json(toPublicUser(fresh));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to update location' });
  }
});

export default router;
