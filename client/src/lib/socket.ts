import { io, Socket } from 'socket.io-client';
import { tokens } from '../auth/tokenStore';
import { resolveApiBaseUrl } from './serverDiscovery';

let socket: Socket | null = null;
let currentUrl: string | null = null;

export async function connectSocket(): Promise<Socket | null> {
  const token = tokens.accessToken || (tokens as any).token || (tokens as any).idToken;
  if (!token) return null;

  const url = await resolveApiBaseUrl();
  if (socket && socket.connected && currentUrl === url) return socket;

  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } catch {}

  currentUrl = url;
  socket = io(url, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
  });

  return socket;
}

export const getSocket = () => socket;

export const disconnectSocket = () => {
  try {
    socket?.removeAllListeners();
    socket?.disconnect();
  } finally {
    socket = null;
    currentUrl = null;
  }
};


