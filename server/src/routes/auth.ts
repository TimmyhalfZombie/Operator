import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { connectDB } from '../db/connect';
import { signToken } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    let { username, email, phone, password } = req.body;

    // basic normalization
    username = String(username || '').trim();
    email = String(email || '').trim().toLowerCase();
    phone = typeof phone === 'string' ? phone.trim() : '';

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Only include phone when it's a non-empty string
    const phoneNorm = phone ? phone : undefined;

    const db = await connectDB();
    const users = db.collection('users');

    // Check conflicts (email OR phone when provided)
    const conflict = await users.findOne({
      $or: [{ email }, ...(phoneNorm ? [{ phone: phoneNorm }] : [])],
    });
    if (conflict) return res.status(409).json({ message: 'Email or phone already in use' });

    const password_hash = await bcrypt.hash(password, 10);
    const doc = await users.insertOne({
      username,
      email,
      ...(phoneNorm ? { phone: phoneNorm } : {}),
      password_hash,
      created_at: new Date(),
    });

    const token = signToken({
      _id: String(doc.insertedId),
      username,
      email,
      phone: phoneNorm || '',
    });

    res.status(201).json({
      token,
      user: {
        _id: doc.insertedId,
        username,
        email,
        ...(phoneNorm ? { phone: phoneNorm } : {}),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
