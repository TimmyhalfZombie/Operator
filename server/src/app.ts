// server/src/app.ts
import cors from 'cors';
import express from 'express';
import { config } from './config';

import assistRoutes from './routes/assist';
import authRoutes from './routes/auth';
import geoRoutes from './routes/geo';
import operatorRoutes from './routes/operator';
import usersRoutes from './routes/users';
import messagesRoutes from './routes/messages';          // (optional/legacy)
import conversationsRoutes from './routes/conversations'; // 👈 MESSAGES API USED BY CLIENT

const app = express();

/* ---------- middleware ---------- */
app.use(express.json());
app.use(
  cors({
    origin: config.clientUrl || true, // allow your client (or all, if not set)
    credentials: true,
  })
);

/* ---------- health ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- routes ---------- */
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/assist', assistRoutes);
app.use('/api/geo', geoRoutes);

// Conversations API (this is what your client calls)
app.use('/api/conversations', conversationsRoutes);

// Other operator routes
app.use('/api', operatorRoutes);

// Optional/legacy in-memory messages (not used by client below)
app.use('/api/messages', messagesRoutes);

/* ---------- 404 ---------- */
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

/* ---------- error handler ---------- */
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = Number(err?.status) || 500;
    const msg = err?.message || 'Server error';
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error('[error]', err);
    }
    res.status(status).json({ message: msg });
  }
);

export default app;
