import React from 'react';
import { tokens } from '../auth/tokenStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

type Ctx = {
  socket: ReturnType<typeof getSocket>;
  connected: boolean;
};

export const SocketContext = React.createContext<Ctx>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = React.useState(false);
  const [socketState, setSocketState] = React.useState(getSocket());

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const s = await connectSocket();
      if (cancelled || !s) return;

      setSocketState(s);
      setConnected(s.connected);

      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      const onError = () => setConnected(false);

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      s.on('connect_error', onError);

      return () => {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        s.off('connect_error', onError);
      };
    })();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
    // Reconnect when token changes
  }, [tokens.accessToken]);

  return (
    <SocketContext.Provider value={{ socket: socketState, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
