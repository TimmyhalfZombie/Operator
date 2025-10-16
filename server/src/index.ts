// server/src/index.ts
import http from 'http';
import app from './app';
import { initSocket } from './socket';
import './db/connect';

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
initSocket(server);

server.listen(port, '0.0.0.0', () => console.log(`API on http://0.0.0.0:${port}`));
