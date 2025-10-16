import React from 'react';
import { tokens } from '../auth/tokenStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

export const SocketContext = React.createContext<{ socket: ReturnType<typeof getSocket> }>({ socket: null });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [rev, bump] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const s = connectSocket();
    const ready = () => bump();
    s?.on('connect', ready);
    s?.on('disconnect', ready);
    return () => {
      s?.off('connect', ready);
      s?.off('disconnect', ready);
      disconnectSocket();
    };
  }, [tokens.accessToken]);

  return <SocketContext.Provider value={{ socket: getSocket() }}>{children}</SocketContext.Provider>;
}
