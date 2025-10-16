import React from 'react';
import { tokens } from '../auth/tokenStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

export const SocketContext = React.createContext<{ socket: ReturnType<typeof getSocket> }>({ socket: null });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [, bump] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await connectSocket();
      if (cancelled || !s) return;
      const ready = () => bump();
      s.on('connect', ready);
      s.on('disconnect', ready);
    })();
    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, [tokens.accessToken]);

  return <SocketContext.Provider value={{ socket: getSocket() }}>{children}</SocketContext.Provider>;
}
