import { Router } from 'express';
import { connectDB } from '../db/connect';
import { requireAuth } from '../middleware/requireAuth';
import { ObjectId } from 'mongodb';

const router = Router();

/**
 * GET /api/users/me
 * Requires: Authorization: Bearer <accessToken>
 * Returns: { username, phone, email }
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string };
    const db = await connectDB();
    const users = db.collection('users');

    // project only public fields
    const user = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { username: 1, phone: 1, email: 1 } }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ username: user.username ?? '', phone: user.phone ?? '', email: user.email ?? '' });
  } catch (e) {
    next(e);
  }
});

export default router;
