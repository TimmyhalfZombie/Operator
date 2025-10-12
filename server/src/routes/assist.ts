import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth } from '../middleware/jwt';
import { getCustomerDb } from '../db/connect';

const router = Router();

/* --------------------------------------------------------------------------------
 * Helpers to normalize fields
 * -------------------------------------------------------------------------------*/
function pickClientName(d: any): string {
  return (
    d?.customerName ||
    d?.clientName ||
    d?.location?.contactName ||
    d?.location?.contact?.name ||
    d?.contactName ||
    d?.user?.name ||
    'Customer'
  );
}

function pickPlaceName(d: any): string {
  return d?.placeName || d?.location?.name || d?.vehicle?.model || d?.location?.address || 'Location';
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

/* ---------- coordinate extraction ---------- */
function toNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
function extractCoords(d: any): { lat: number; lng: number } | null {
  // 1) direct { coords: {lat,lng} }
  if (d?.coords && toNum(d.coords.lat) != null && toNum(d.coords.lng) != null) {
    return { lat: toNum(d.coords.lat)!, lng: toNum(d.coords.lng)! };
  }
  // 2) location.coords or location.coordinate
  const lc = d?.location?.coords || d?.location?.coordinate;
  if (lc && toNum(lc.lat) != null && toNum(lc.lng) != null) {
    return { lat: toNum(lc.lat)!, lng: toNum(lc.lng)! };
  }
  // 3) location.{lat,lng|lon|longitude}
  const ll = d?.location || d;
  if (
    toNum(ll?.lat) != null &&
    (toNum(ll?.lng) != null || toNum(ll?.lon) != null || toNum(ll?.longitude) != null)
  ) {
    const lat = toNum(ll.lat)!;
    const lng = toNum(ll.lng) ?? toNum(ll.lon) ?? toNum(ll.longitude)!;
    return { lat, lng };
  }
  // 4) GeoJSON: location.geometry.coordinates [lng, lat]
  const g1 = d?.location?.geometry?.coordinates;
  if (Array.isArray(g1) && toNum(g1[0]) != null && toNum(g1[1]) != null) {
    return { lat: toNum(g1[1])!, lng: toNum(g1[0])! };
  }
  // 5) Plain coordinates array: location.coordinates or coordinates [lng, lat]
  const g2 = d?.location?.coordinates || d?.coordinates;
  if (Array.isArray(g2) && toNum(g2[0]) != null && toNum(g2[1]) != null) {
    return { lat: toNum(g2[1])!, lng: toNum(g2[0])! };
  }
  return null;
}

/* ---------- Geoapify forward geocoding fallback ---------- */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const KEY = process.env.GEOAPIFY_API_KEY;
  if (!KEY || !address.trim()) return null;

  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    address
  )}&limit=1&apiKey=${KEY}`;

  const r = await fetch(url);
  if (!r.ok) {
    console.warn('[geoapify] HTTP', r.status, address);
    return null;
  }
  const j = await r.json();
  const f = j?.features?.[0]?.properties;
  const lat = toNum(f?.lat);
  const lng = toNum(f?.lon ?? f?.lng ?? f?.longitude);
  if (lat != null && lng != null) return { lat, lng };
  return null;
}

/* ================================================================================
 * CLIENT (current user only)
 * GET /api/assist/mine?limit=100&status=pending|accepted|completed
 * ================================================================================*/
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
      createdAt: d.createdAt || (d as any).created_at || null,
      updatedAt: d.updatedAt || (d as any).updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================
 * OPERATOR (see everyone’s requests)
 * GET /api/assist/inbox?status=pending|accepted|completed&limit=100
 * ================================================================================*/
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
      createdAt: d.createdAt || (d as any).created_at || null,
      updatedAt: d.updatedAt || (d as any).updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================
 * /next with geocoding fallback & full details
 * GET /api/assist/next → newest pending request
 * ================================================================================*/
router.get('/next', requireAuth, async (_req, res, next) => {
  try {
    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const doc = await coll.findOne({ status: 'pending' }, { sort: { createdAt: -1 } });

    if (!doc) return res.json({ ok: true, data: null });

    let coords = extractCoords(doc);

    // If missing, try Geoapify geocoding and persist the result
    if (!coords) {
      const address = pickAddress(doc);
      const gc = await geocodeAddress(address);
      if (gc) {
        coords = gc;
        await coll.updateOne(
          { _id: (doc as any)._id },
          {
            $set: {
              coords: gc, // top-level for quick access
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

        // EXTRA FIELDS FOR UI (pulled directly from your DB shape)
        phone: doc.customerPhone ?? null,
        vehicleType: doc.vehicle?.model ?? null,
        plateNumber: doc.vehicle?.plate ?? null,
        otherInfo: doc.vehicle?.notes ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================
 * Accept / Decline
 * ================================================================================*/
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

    // Optionally return normalized payload (client currently doesn’t use it, but it’s handy)
    const d = result.value;
    return res.json({
      ok: true,
      data: {
        id: String(d._id),
        clientName: pickClientName(d),
        placeName: pickPlaceName(d),
        address: pickAddress(d),
        coords: extractCoords(d) || null,
        phone: d.customerPhone ?? null,
        vehicleType: d.vehicle?.model ?? null,
        plateNumber: d.vehicle?.plate ?? null,
        otherInfo: d.vehicle?.notes ?? null,
        status: d.status || 'accepted',
      },
    });
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

export default router;
