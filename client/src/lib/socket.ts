import { io, Socket } from 'socket.io-client';
import { tokens } from '../auth/tokenStore';
import { resolveApiBaseUrl } from './serverDiscovery';

let socket: Socket | null = null;

export async function connectSocket() {
  const token = tokens.accessToken || (tokens as any).token || (tokens as any).idToken;
  if (!token) return null;

  const url = await resolveApiBaseUrl(); // same base (port 3000)
  socket?.disconnect();
  socket = io(url, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
  });
  return socket;
}

export const getSocket = () => socket;
export const disconnectSocket = () => { socket?.disconnect(); socket = null; };
