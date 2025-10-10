import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { connectDB } from './db/connect';
import authRoutes from './routes/auth';
import assistRoutes from './routes/assist';

const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(cors({
  origin: config.clientUrl || true,
  credentials: true,
}));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);     // → appdb.users
app.use('/api/assist', assistRoutes); // → customer.assistrequests

(async () => {
  await connectDB();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${config.port}`);
  });
})();

export default app;
