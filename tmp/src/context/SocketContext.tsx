import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

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
  const liveSocketRef = useRef<Socket | null>(null);
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
      transports: ['websocket'],
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

    let recoveryAttempted = false;
    newSocket.on('connect_error', async (err: Error) => {
      setIsConnected(false);
      if (err.message === 'unauthorized') {
        // A browser may still show a signed-in user after its socket token expired.
        // Refresh once and retry with the new token; never bypass server validation.
        if (!recoveryAttempted && sessionRef.current) {
          recoveryAttempted = true;
          newSocket.disconnect();
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data.session && newSocket === liveSocketRef.current) {
              sessionRef.current = data.session;
              setAuthError(null);
              newSocket.connect();
              return;
            }
          } catch { /* A failed refresh still requires a normal sign-in. */ }
        }
        if (newSocket === liveSocketRef.current) setAuthError('unauthorized');
        newSocket.disconnect();
      } else {
        setAuthError(err.message);
      }
    });

    liveSocketRef.current = newSocket;
    setSocket(newSocket);
    newSocket.connect();

    return () => {
      if (liveSocketRef.current === newSocket) liveSocketRef.current = null;
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
