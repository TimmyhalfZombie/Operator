import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';

const router = Router();

/* --------------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------------*/
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
function toNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
/** Try to get {lat,lng} from several shapes */
function extractCoords(d: any): { lat: number; lng: number } | null {
  if (d?.coords && toNum(d.coords.lat) != null && toNum(d.coords.lng) != null) {
    return { lat: toNum(d.coords.lat)!, lng: toNum(d.coords.lng)! };
  }
  const lc = d?.location?.coords || d?.location?.coordinate;
  if (lc && toNum(lc.lat) != null && toNum(lc.lng) != null) {
    return { lat: toNum(lc.lat)!, lng: toNum(lc.lng)! };
  }
  const ll = d?.location || d;
  if (
    toNum(ll?.lat) != null &&
    (toNum(ll?.lng) != null || toNum(ll?.lon) != null || toNum(ll?.longitude) != null)
  ) {
    const lat = toNum(ll.lat)!;
    const lng = toNum(ll.lng) ?? toNum(ll.lon) ?? toNum(ll.longitude)!;
    return { lat, lng };
  }
  const g1 = d?.location?.geometry?.coordinates;
  if (Array.isArray(g1) && toNum(g1[0]) != null && toNum(g1[1]) != null) {
    return { lat: toNum(g1[1])!, lng: toNum(g1[0])! };
  }
  const g2 = d?.location?.coordinates || d?.coordinates;
  if (Array.isArray(g2) && toNum(g2[0]) != null && toNum(g2[1]) != null) {
    return { lat: toNum(g2[1])!, lng: toNum(g2[0])! };
  }
  return null;
}

/* ---------- optional: Geoapify geocode fallback ---------- */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const KEY = process.env.GEOAPIFY_API_KEY;
  if (!KEY || !address?.trim()) return null;

  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    address
  )}&limit=1&apiKey=${KEY}`;

  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j?.features?.[0]?.properties;
  const lat = toNum(f?.lat);
  const lng = toNum(f?.lon ?? f?.lng ?? f?.longitude);
  if (lat != null && lng != null) return { lat, lng };
  return null;
}

/* ================================================================================ */
/* CLIENT (current user) */
/* GET /api/assist/mine?limit=100&status=pending|accepted|completed                 */
/* ================================================================================ */
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
          rating: 1,
          completedAt: 1,
        },
      })
      .toArray();

    const items = docs.map((d) => ({
      id: String(d._id),
      status: d.status || 'pending',
      vehicle: d.vehicle || null,
      location: d.location || null,
      createdAt: d.createdAt || (d as any).created_at || null,
      updatedAt: d.updatedAt || (d as any).updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
      rating: d.rating ?? null,
      completedAt: d.completedAt ?? null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* OPERATOR inbox */
/* GET /api/assist/inbox?status=pending|accepted|completed&limit=100               */
/* ================================================================================ */
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
          rating: 1,
          completedAt: 1,
          customerName: 1,
          clientName: 1,
          contactName: 1,
          customerPhone: 1,
        },
      })
      .toArray();

    const items = docs.map((d) => ({
      id: String(d._id),
      status: d.status || 'pending',
      vehicle: d.vehicle || null,
      location: d.location || null,
      createdAt: d.createdAt || (d as any).created_at || null,
      updatedAt: d.updatedAt || (d as any).updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
      rating: d.rating ?? null,
      completedAt: d.completedAt ?? null,
      customerName: d.customerName || null,
      clientName: d.clientName || null,
      contactName: d.contactName || null,
      customerPhone: d.customerPhone || null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* GET /api/assist/next – newest pending; geocode & persist coords if missing      */
/* ================================================================================ */
router.get('/next', requireAuth, async (_req, res, next) => {
  try {
    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const doc = await coll.findOne({ status: 'pending' }, { sort: { createdAt: -1 } });
    if (!doc) return res.json({ ok: true, data: null });

    let coords = extractCoords(doc);
    if (!coords) {
      const address = pickAddress(doc);
      const gc = await geocodeAddress(address);
      if (gc) {
        coords = gc;
        await coll.updateOne(
          { _id: (doc as any)._id },
          {
            $set: {
              coords: gc,
              'location.coords': gc,
              updatedAt: new Date(),
            },
          }
        );
      }
    }

    return res.json({
      ok: true,
      data: {
        id: String((doc as any)._id),
        clientName: pickClientName(doc),
        placeName: pickPlaceName(doc),
        address: pickAddress(doc),
        coords: coords || null,
        vehicleType: doc?.vehicle?.model ?? null,
        plateNumber: doc?.vehicle?.plate ?? null,
        phone: doc?.customerPhone ?? null,
        otherInfo: doc?.vehicle?.notes ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* Single request (detail) – GET /api/assist/:id                                    */
/* ================================================================================ */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const doc = await coll.findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ message: 'Request not found' });

    const coords = extractCoords(doc);
    res.json({
      id: String(doc._id),
      status: doc.status,
      clientName: pickClientName(doc),
      placeName: pickPlaceName(doc),
      address: pickAddress(doc),
      coords: coords || null,
      vehicleType: doc?.vehicle?.model ?? null,
      plateNumber: doc?.vehicle?.plate ?? null,
      phone: doc?.customerPhone ?? null,
      otherInfo: doc?.vehicle?.notes ?? null,
      rating: doc?.rating ?? null,
      completedAt: doc?.completedAt ?? null,
      createdAt: doc?.createdAt ?? null,
      updatedAt: doc?.updatedAt ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* Accept / Decline                                                                 */
/* ================================================================================ */
router.post('/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const result = await coll.findOneAndUpdate(
      { _id: new ObjectId(id), status: 'pending' },
      {
        $set: {
          status: 'accepted',
          acceptedBy: new ObjectId((req as any).user.id),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) return res.status(404).json({ message: 'Request not found or not pending' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const result = await coll.findOneAndUpdate(
      { _id: new ObjectId(id), status: { $in: ['pending', 'accepted'] } },
      { $set: { status: 'declined', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) return res.status(404).json({ message: 'Request not found' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* Complete (Repaired) – POST /api/assist/:id/complete { rating?: number }          */
/* ================================================================================ */
router.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const ratingRaw = req.body?.rating;
    const rating =
      ratingRaw === undefined || ratingRaw === null
        ? undefined
        : Math.max(0, Math.min(5, Number(ratingRaw)));

    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    // Relaxed filter: complete by id (unless hard-deleted)
    const set: any = {
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      completedBy: new ObjectId((req as any).user.id),
    };
    if (rating !== undefined && Number.isFinite(rating)) set.rating = rating;

    const result = await coll.findOneAndUpdate(
      { _id: new ObjectId(id), status: { $ne: 'deleted' } },
      { $set: set },
      { returnDocument: 'after' }
    );

    if (!result.value) return res.status(404).json({ message: 'Request not found' });

    const doc: any = result.value;

    // Build a rich payload for the Activity detail screen
    const endName = pickPlaceName(doc);
    const endAddr = pickAddress(doc);

    res.json({
      ok: true,
      data: {
        id: String(doc._id),
        status: doc.status,
        completedAt: doc.completedAt ?? new Date(),

        clientName: pickClientName(doc),
        phone: doc?.customerPhone ?? doc?.phone ?? null,

        placeName: endName,
        address: endAddr,

        vehicleType: doc?.vehicle?.model ?? null,
        plateNumber: doc?.vehicle?.plate ?? null,
        otherInfo: doc?.vehicle?.notes ?? null,

        // optional summary fields for the detail screen:
        startName: doc.startName ?? 'Start',
        startAddr: doc.startAddr ?? '',
        endName,
        endAddr,

        rating: doc.rating ?? (rating ?? null),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
