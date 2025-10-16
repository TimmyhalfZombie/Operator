import http from 'http';
import app from './app';
import './db/connect';
import { initSocket } from './socket';

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
initSocket(server);

server.listen(port, () => console.log(`API on http://localhost:${port}`));
