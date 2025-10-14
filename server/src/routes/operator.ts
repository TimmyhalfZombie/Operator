import { Router } from 'express';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * GET /api/users/me/location
 * Returns { lat, lng, address, updated_at }
 * Gets operator location from operators collection
 */
router.get('/users/me/location', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const db = getCustomerDb();
    const operator = await db.collection('operators').findOne({ user_id: String(userId) });

    if (!operator) return res.status(404).json({ error: 'location not found' });
    
    return res.json({
      lat: operator.last_lat || null,
      lng: operator.last_lng || null,
      address: operator.last_address || null,
      updated_at: operator.last_seen_at || null
    });
  } catch (err) {
    console.error('GET /users/me/location failed', err);
    return res.status(500).json({ error: 'failed to read location' });
  }
});

/**
 * POST /api/users/me/location
 * Updates operator location with lat, lng, and full address
 */
router.post('/users/me/location', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { lat, lng, address } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: 'Invalid lat/lng values' });
    }

    const updatedAt = new Date();

    // Geocode coordinates to get real address if not provided
    let realAddress = address;
    if (!address) {
      try {
        const { reverseGeocode } = await import('./geo');
        const geocodedAddress = await reverseGeocode(latNum, lngNum);
        if (geocodedAddress) {
          realAddress = geocodedAddress;
        }
      } catch (e) {
        console.log('Reverse geocoding failed:', e);
      }
    }

    // Update operators collection in customer DB
    const db = getCustomerDb();
    await db.collection('operators').updateOne(
      { user_id: String(userId) },
      {
        $set: {
          user_id: String(userId),
          last_lat: latNum,
          last_lng: lngNum,
          last_address: realAddress || null,
          last_seen_at: updatedAt,
          accuracy_m: 50,
          source: 'device',
        },
      },
      { upsert: true }
    );

    res.json({ 
      success: true, 
      lat: latNum, 
      lng: lngNum, 
      address: realAddress || null,
      updated_at: updatedAt 
    });
  } catch (err) {
    console.error('POST /users/me/location failed', err);
    return res.status(500).json({ error: 'failed to update location' });
  }
});

/**
 * Utility endpoint to update existing operators with addresses
 */
router.post('/update-addresses', requireAuth, async (req: any, res) => {
  try {
    const db = getCustomerDb();
    const operators = await db.collection('operators').find({
      $or: [
        { last_address: null },
        { last_address: { $exists: false } }
      ],
      last_lat: { $exists: true, $ne: null },
      last_lng: { $exists: true, $ne: null }
    }).toArray();

    let updated = 0;
    
    for (const operator of operators) {
      try {
        const { reverseGeocode } = await import('./geo');
        const address = await reverseGeocode(operator.last_lat, operator.last_lng);
        
        if (address) {
          await db.collection('operators').updateOne(
            { _id: operator._id },
            { $set: { last_address: address } }
          );
          updated++;
        }
      } catch (e) {
        console.log(`Failed to geocode operator ${operator._id}:`, e);
      }
    }

    res.json({ 
      success: true, 
      total: operators.length, 
      updated,
      message: `Updated ${updated} out of ${operators.length} operators with addresses`
    });
  } catch (err) {
    console.error('POST /update-addresses failed', err);
    return res.status(500).json({ error: 'failed to update addresses' });
  }
});

export default router;
