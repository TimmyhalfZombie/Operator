// server/src/app.ts
import cors from 'cors';
import express from 'express';
import { config } from './config';

import assistRoutes from './routes/assist';
import authRoutes from './routes/auth';
import geoRoutes from './routes/geo';
import operatorRoutes from './routes/operator';          // <- unified users/operator router
// import usersRoutes from './routes/users';              // <- not needed when operatorRoutes is used for users
import messagesRoutes from './routes/messages';          // optional/legacy
import conversationsRoutes from './routes/conversations'; // used by client

const app = express();

/* ---------- middleware ---------- */

// trust proxy so cookies/sessions work behind reverse proxies (and for proper HTTPS redirects)
app.set('trust proxy', 1);

// JSON/body parsers (raise if you need bigger payloads for images, etc.)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// CORS: allow your Expo client URL if provided; otherwise reflect any origin (dev-friendly)
const corsOrigin = config.clientUrl || true;
const corsOptions: cors.CorsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes

/* ---------- health ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- routes ---------- */
app.use('/api/auth', authRoutes);

// Use the same router for both paths so the client can call either:
// /api/users/me, /api/users/me/location, /api/users/:id
// /api/operator/me, /api/operator/me/location, /api/operator/update-initial-from-last
app.use('/api/users', operatorRoutes);
app.use('/api/operator', operatorRoutes);

app.use('/api/assist', assistRoutes);
app.use('/api/geo', geoRoutes); // Map/routing proxy (OSRM) used by client helpers

// Conversations API (this is what your client calls)
app.use('/api/conversations', conversationsRoutes);

// Optional/legacy in-memory messages (not used by current client)
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
