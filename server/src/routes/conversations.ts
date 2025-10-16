// server/src/routes/conversations.ts
import { Router } from 'express';
// IMPORTANT: import the middleware that actually exports `requireAuth`
import { requireAuth } from '../middleware/requireAuth';
import { getMemMessages } from '../socket';

const router = Router();

/**
 * GET /api/messages/:requestId
 * Returns initial chat history for a request.
 * Uses in-memory store from socket.ts (swap to DB when ready).
 */
router.get('/:requestId', requireAuth, (req, res) => {
  const { requestId } = req.params;
  if (!requestId) return res.status(400).json({ message: 'Missing requestId' });

  const items = getMemMessages(requestId);
  return res.json({ items });
});

export default router;
