// server/src/routes/messages.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth'; // uses your existing JWT middleware
import { getMemMessages } from '../socket';

const r = Router();

// GET /api/messages/:requestId  → initial history (from memory store for now)
r.get('/:requestId', requireAuth, async (req, res) => {
  const { requestId } = req.params;
  const items = getMemMessages(requestId);
  res.json({ items });
});

export default r;
