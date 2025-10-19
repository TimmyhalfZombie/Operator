import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAuthDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';

const router = Router();

/**
 * GET /api/users/me
 * Returns { username, phone, email } for the authenticated user
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
 * Returns { lat, lng, address, updated_at } for the authenticated user
 */
router.get('/me/location', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    console.log('Getting location for user:', id);
    
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const db = getAuthDb();
    const users = db.collection('users');

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { 
        initial_lat: 1, 
        initial_lng: 1, 
        initial_address: 1, 
        initial_loc_at: 1,
        last_lat: 1,
        last_lng: 1,
        last_address: 1,
        last_seen_at: 1
      } }
    );

    console.log('User found:', user);

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Use last location if available, otherwise fall back to initial location
    const lat = user.last_lat ?? user.initial_lat;
    const lng = user.last_lng ?? user.initial_lng;
    const address = user.last_address ?? user.initial_address;
    const updated_at = user.last_seen_at ?? user.initial_loc_at;

    console.log('Location data:', { lat, lng, address, updated_at });

    if (lat == null || lng == null) {
      console.log('No location data found for user');
      return res.status(404).json({ message: 'Location not found' });
    }

    const response = {
      lat: Number(lat),
      lng: Number(lng),
      address: address ?? null,
      updated_at: updated_at ?? null,
    };
    
    console.log('Returning location:', response);
    res.json(response);
  } catch (e) {
    console.error('Error in /me/location:', e);
    next(e);
  }
});

export default router;
