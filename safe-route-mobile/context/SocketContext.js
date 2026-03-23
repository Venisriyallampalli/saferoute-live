import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/config';
import { AUTH_TOKEN_KEY } from '../utils/storageKeys';

const SocketContext = createContext(null);

const WS_URL = API_BASE_URL;

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [shareRequests, setShareRequests] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [fusionStats, setFusionStats] = useState({ crowdDensity: 55, trafficFlow: 65 });
  const socketRef = useRef(null);

  useEffect(() => {
    let newSocket;

    const connectSocket = async () => {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

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

      newSocket.on('fusion_stats_update', (data) => {
        setFusionStats(data);
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
    setActiveSessions,
    fusionStats
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
