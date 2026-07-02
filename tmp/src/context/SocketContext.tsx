import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  authError: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  authError: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Keep session in a ref so the auth callback reads the freshest access_token
  // without triggering a socket reconnect on every token refresh.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (isLoading) return;

    const serverUrl = import.meta.env.VITE_SERVER_URL;
    if (!serverUrl) {
      console.warn('Multiplayer disabled: VITE_SERVER_URL is not configured.');
      return;
    }

    if (!session) {
      setSocket(null);
      setIsConnected(false);
      setAuthError(null);
      return;
    }

    const newSocket = io(serverUrl, {
      autoConnect: false,
      auth: (cb) => {
        cb({ accessToken: sessionRef.current?.access_token ?? '' });
      },
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setAuthError(null);
      console.log('Connected to Multiplayer Server', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('connect_error', (err: Error) => {
      setIsConnected(false);
      if (err.message === 'unauthorized') {
        setAuthError('unauthorized');
        // Do not auto-retry on auth failure to avoid spamming the server.
        newSocket.disconnect();
      } else {
        setAuthError(err.message);
      }
    });

    setSocket(newSocket);
    newSocket.connect();

    return () => {
      newSocket.disconnect();
      newSocket.close();
      setSocket(null);
      setIsConnected(false);
    };
    // Recreate socket only on identity change (login/logout), not on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, session?.user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, authError }}>
      {children}
    </SocketContext.Provider>
  );
};
