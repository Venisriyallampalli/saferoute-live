import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SocketContext = createContext(null);

const WS_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [shareRequests, setShareRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    let newSocket;

    const connectSocket = async () => {
      const token = await AsyncStorage.getItem('token');

      const socketOptions = {
        transports: ['websocket', 'polling'], // Polling often required on mobile RN 
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      };

      if (token) {
        socketOptions.auth = { token };
      }

      newSocket = io(WS_URL, socketOptions);

      newSocket.on('connect', () => {
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      newSocket.on('share:request', (data) => {
        setShareRequests(prev => {
          if (prev.find(r => r.requestId === data.requestId)) return prev;
          return [...prev, data];
        });
      });

      newSocket.on('share:approved', (data) => {
        setActiveSessions(prev => {
          if (prev.find(s => s.sessionId === data.sessionId)) return prev;
          return [...prev, data];
        });
        setShareRequests(prev => prev.filter(r => r.requestId !== data.requestId));
      });

      newSocket.on('share:direct', (data) => {
        setActiveSessions(prev => {
          if (prev.find(s => s.sessionId === data.sessionId)) return prev;
          return [...prev, data];
        });
      });

      newSocket.on('share:end', (data) => {
        setActiveSessions(prev => prev.filter(s => s.sessionId !== data.sessionId));
      });

      newSocket.on('share:expired', (data) => {
        setActiveSessions(prev => prev.filter(s => s.sessionId !== data.sessionId));
      });

      setSocket(newSocket);
      socketRef.current = newSocket;
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const value = {
    socket,
    isConnected,
    shareRequests,
    setShareRequests,
    activeSessions,
    setActiveSessions
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
