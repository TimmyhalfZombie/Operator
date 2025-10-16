import { io, Socket } from 'socket.io-client';
import { tokens } from '../auth/tokenStore';
import { env } from '../lib/env';

let socket: Socket | null = null;

export function connectSocket() {
  const token = tokens.accessToken || (tokens as any).token || (tokens as any).idToken;
  if (!token) return null;
  const url = env.API_BASE_URL || 'http://localhost:3000';
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
