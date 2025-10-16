import http from 'http';
import app from './app';
import { initSocket } from './socket';
import './db/connect';

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
initSocket(server);

server.listen(port, () => console.log(`API on http://localhost:${port}`));
