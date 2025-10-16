import http from 'http';
import app from './app';
import { connectDB } from './db/connect';
import { initSocket } from './socket';

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
initSocket(server);

(async () => {
  try {
    await connectDB();
    server.listen(port, '0.0.0.0', () => console.log(`API listening on 0.0.0.0:${port}`));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to MongoDB. Check MONGODB_URI and network.', err);
    process.exit(1);
  }
})();
