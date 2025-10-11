import { Router } from 'express';
import { getAuthDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';
import { ObjectId } from 'mongodb';

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

export default router;
