// client/src/lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { tokens } from '../auth/tokenStore';
import { resolveApiBaseUrl } from './serverDiscovery';

let socket: Socket | null = null;

/** Create (or recreate) a connected Socket.IO client */
export async function connectSocket() {
  const token =
    (tokens as any).accessToken ||
    (tokens as any).token ||
    (tokens as any).idToken;

  if (!token) return null;

  const url = await resolveApiBaseUrl();

  // tear down existing
  if (socket) socket.disconnect();

  socket = io(url, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    withCredentials: true,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
