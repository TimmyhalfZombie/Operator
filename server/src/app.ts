// server/src/app.ts
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { connectDB } from './db/connect';

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import assistRoutes from './routes/assist';
import geoRoutes from './routes/geo';          // ← add: routing & places proxy

const app = express();

/* ---------- middleware ---------- */
app.use(express.json());
app.use(
  cors({
    origin: config.clientUrl || true,
    credentials: true,
  })
);
app.use(morgan('dev'));

/* ---------- health ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- routes ---------- */
app.use('/api/auth', authRoutes);     // → appdb.users
app.use('/api/users', usersRoutes);   // ← already in your code
app.use('/api/assist', assistRoutes); // → customer.assistrequests
app.use('/api/geo', geoRoutes);       // ← add: /api/geo/route, /api/geo/places

/* ---------- 404 ---------- */
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

/* ---------- error handler ---------- */
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = Number(err?.status) || 500;
    const msg = err?.message || 'Server error';
    if (status >= 500) {
      // log only server errors to avoid noisy logs
      // eslint-disable-next-line no-console
      console.error('[error]', err);
    }
    res.status(status).json({ message: msg });
  }
);

/* ---------- start ---------- */
(async () => {
  await connectDB();
  app.listen(config.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://0.0.0.0:${config.port}`);
  });
})();

export default app;
