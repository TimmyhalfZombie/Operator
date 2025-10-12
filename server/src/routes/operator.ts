import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as DB from '../db/connect';

const router = Router();

// Flexible DB query helper: supports pool.query, client.query, or exported query()
async function sql<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
  const anyDB: any = DB;
  if (anyDB.pool?.query) return anyDB.pool.query(text, params);
  if (anyDB.client?.query) return anyDB.client.query(text, params);
  if (typeof anyDB.query === 'function') return anyDB.query(text, params);
  throw new Error('No query method exported from db/connect');
}

/**
 * GET /api/users/me/location
 * Returns { lat, lng, updated_at }
 * Assumes `users` table has numeric columns `lat` and `lng` for the current operator (req.user.id).
 * If your column names differ, change the SELECT below.
 */
router.get('/users/me/location', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { rows } = await sql(
      `SELECT lat, lng, updated_at
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'location not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /users/me/location failed', err);
    return res.status(500).json({ error: 'failed to read location' });
  }
});

export default router;
