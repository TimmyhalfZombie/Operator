import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';

const app = express();

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/operator';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => {
  res.json({ ok: true, mongo: mongoose.connection.readyState });
});

// Example schema/model
const MessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    preview: { type: String, default: '' },
    time: { type: String, default: '' },
    unread: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// Example route
app.get('/api/messages', async (_req, res) => {
  const items = await Message.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items });
});

async function start() {
  await mongoose.connect(MONGODB_URI);
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});


