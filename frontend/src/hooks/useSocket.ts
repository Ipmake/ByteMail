import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Connect to the same origin - Vite dev server will proxy to backend in dev mode
// In production, the frontend is served by the backend, so same origin works there too
let socket: Socket | null = null;

export const useSocket = () => {
  // Initialize state with current socket connection status if socket exists
  const [isConnected, setIsConnected] = useState(() => socket?.connected ?? false);

  useEffect(() => {
    if (!socket) {
      console.log('[Socket.IO Client] Creating socket connection to same origin');
      socket = io({
        autoConnect: true,
        reconnection: true,
      });

      socket.on('connect', () => {
        console.log('[Socket.IO Client] ✅ Socket connected successfully. Socket ID:', socket?.id);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('[Socket.IO Client] ❌ Socket disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('[Socket.IO Client] Connection error:', error);
      });
    } else {
      console.log('[Socket.IO Client] Socket already exists. Connected:', socket.connected);
      // If socket already connected but state is false, update it
      if (socket.connected && !isConnected) {
        setIsConnected(true);
      }
    }

    return () => {
      // Don't disconnect on component unmount, keep connection alive
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const joinUserRoom = (userId: string) => {
    if (socket && socket.connected) {
      console.log(`[Socket.IO Client] Joining user room: ${userId}`);
      socket.emit('join:user', userId);
    } else if (socket && !socket.connected) {
      console.warn(`[Socket.IO Client] Socket not connected, will join room after connection`);
      const socketRef = socket;
      socketRef.once('connect', () => {
        console.log(`[Socket.IO Client] Connected, joining user room: ${userId}`);
        socketRef.emit('join:user', userId);
      });
    }
  };

  const joinAccountRoom = (accountId: string) => {
    if (socket && socket.connected) {
      socket.emit('join:account', accountId);
    } else if (socket && !socket.connected) {
      const socketRef = socket;
      socketRef.once('connect', () => {
        socketRef.emit('join:account', accountId);
      });
    }
  };

  const startIdle = (accountId: string) => {
    if (socket) {
      socket.emit('idle:start', accountId);
    }
  };

  const stopIdle = (accountId: string) => {
    if (socket) {
      console.log(`[Socket.IO Client] Stopping IDLE for account: ${accountId}`);
      socket.emit('idle:stop', accountId);
    }
  };

  const onIdleStarted = (callback: (data: { accountId: string; success: boolean }) => void) => {
    if (socket) {
      socket.on('idle:started', callback);
    }
  };

  const onIdleError = (callback: (data: { accountId: string; error: string }) => void) => {
    if (socket) {
      socket.on('idle:error', callback);
    }
  };

  const onSyncProgress = (callback: (data: unknown) => void) => {
    if (socket) {
      socket.on('sync:progress', callback);
    }
  };

  const onNewEmail = (callback: (data: unknown) => void) => {
    if (socket) {
      console.log(`[Socket.IO Client] Registered listener for 'email:new' event`);
      socket.on('email:new', callback);
    }
  };

  const offSyncProgress = (callback: (data: unknown) => void) => {
    if (socket) {
      socket.off('sync:progress', callback);
    }
  };

  const offNewEmail = (callback: (data: unknown) => void) => {
    if (socket) {
      console.log(`[Socket.IO Client] Removing listener for 'email:new' event`);
      socket.off('email:new', callback);
    }
  };

  return {
    socket,
    isConnected,
    joinUserRoom,
    joinAccountRoom,
    startIdle,
    stopIdle,
    onIdleStarted,
    onIdleError,
    onSyncProgress,
    onNewEmail,
    offSyncProgress,
    offNewEmail,
  };
};
