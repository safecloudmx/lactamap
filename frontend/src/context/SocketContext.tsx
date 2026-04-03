import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const WS_URL = BASE_URL.replace(/\/api\/v1\/?$/, '');

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Connect/disconnect when user changes (login/logout)
  useEffect(() => {
    // If no user, disconnect existing socket
    if (!user || user.isGuest) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    let mounted = true;

    async function connect() {
      const token = await AsyncStorage.getItem('@Auth:token');
      if (!token || !mounted) return;

      // Don't create duplicate connections
      if (socketRef.current?.connected) return;
      if (socketRef.current) socketRef.current.disconnect();

      const s = io(WS_URL, {
        path: '/ws',
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
      });

      s.on('connect', () => {
        if (mounted) setConnected(true);
      });
      s.on('disconnect', () => {
        if (mounted) setConnected(false);
      });

      socketRef.current = s;
      if (mounted) setSocket(s);
    }

    connect();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
    };
  }, [user?.id]);

  // Reconnect when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
