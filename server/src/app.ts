import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { connectDB, ping } from './db/connect';
import authRoutes from './routes/auth';

const app = express();

app.use(express.json());
app.use(morgan('dev'));

const allowedOrigins = [config.clientUrl].filter(Boolean) as string[];
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/health/db', async (_req, res, next) => {
  try { res.json({ db: (await ping()) ? 'up' : 'down' }); } catch (e) { next(e); }
});

app.use('/api/auth', authRoutes); // ✅ includes /register, /login, /me

// error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode || err.status || 500;
  console.error(`💥 ${req.method} ${req.originalUrl}`);
  console.error(err && err.stack ? err.stack : err);
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
});

async function bootstrap() {
  await connectDB();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Auth API on http://0.0.0.0:${config.port}`);
  });
}
bootstrap().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});

export default app;
