// client/src/contexts/SocketProvider.tsx
import React from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { tokens } from '../auth/tokenStore';

type Ctx = { socket: ReturnType<typeof getSocket> };
export const SocketContext = React.createContext<Ctx>({ socket: null });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [_, force] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await connectSocket();
      if (!mounted || !s) return;
      const rerender = () => force();
      s.on('connect', rerender);
      s.on('disconnect', rerender);
    })();

    return () => {
      mounted = false;
      disconnectSocket();
    };
    // re-connect whenever the access token changes
  }, [tokens.getAccess()]); // note: if you have an event emitter, use that instead

  return (
    <SocketContext.Provider value={{ socket: getSocket() }}>
      {children}
    </SocketContext.Provider>
  );
}
