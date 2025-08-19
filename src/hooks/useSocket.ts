import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  roomId?: string;
  userId?: string;
  username?: string;
}

interface RoomMember {
  id: number;
  user_id: number;
  room_id: string;
  joined_at: string;
  username: string;
  nickname: string;
  avatar_url?: string;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { roomId, userId, username } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  useEffect(() => {
    // 创建Socket连接
    const serverUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3001';
    
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    // 连接事件
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      
      // 触发连接就绪事件，让Room组件知道可以开始初始化
      window.dispatchEvent(new CustomEvent('socket-ready', {
        detail: { socketId: socket.id, roomId, userId }
      }));
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // 用户连接事件
    socket.on('user-connected', (connectedUserId: string) => {
      console.log('User connected to room:', connectedUserId);
      // 这里可以触发重新获取房间成员列表
      if (window.location.pathname.includes('/room/')) {
        window.dispatchEvent(new CustomEvent('room-member-update'));
      }
    });

    // Listen for room member updates
    socket.on('room-member-update', (data: any) => {
      console.log('Room member update:', data);
      // Dispatch custom event for components to listen
      window.dispatchEvent(new CustomEvent('room-member-update', {
        detail: data
      }));
    });

    // 聊天消息
    socket.on('chat-message', (data: any) => {
      setChatMessages(prev => [...prev, data]);
    });

    // WebRTC信令事件
    socket.on('offer', (data: { offer: any, userId: string }) => {
      window.dispatchEvent(new CustomEvent('webrtc-offer', { detail: data }));
    });

    socket.on('answer', (data: { answer: any, userId: string }) => {
      window.dispatchEvent(new CustomEvent('webrtc-answer', { detail: data }));
    });

    socket.on('ice-candidate', (data: { candidate: any, userId: string }) => {
      window.dispatchEvent(new CustomEvent('webrtc-ice-candidate', { detail: data }));
    });

    // 视频同步事件
    socket.on('video-play', (data: { currentTime: number }) => {
      window.dispatchEvent(new CustomEvent('video-sync-play', { detail: data }));
    });

    socket.on('video-pause', (data: { currentTime: number }) => {
      window.dispatchEvent(new CustomEvent('video-sync-pause', { detail: data }));
    });

    socket.on('video-seek', (data: { currentTime: number }) => {
      window.dispatchEvent(new CustomEvent('video-sync-seek', { detail: data }));
    });

    // 游戏事件
    socket.on('game-start', (data: { gameType: string }) => {
      window.dispatchEvent(new CustomEvent('game-start', { detail: data }));
    });

    socket.on('game-action', (data: { action: any }) => {
      window.dispatchEvent(new CustomEvent('game-action', { detail: data }));
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, userId]);

  // Socket方法
  const joinRoom = (roomId: string, userId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', roomId, userId);
    }
  };

  const sendChatMessage = (message: string, roomId: string, userId: string, username: string) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', { message, roomId, userId, username });
    }
  };

  const sendWebRTCOffer = (offer: any, roomId: string, userId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('offer', { offer, roomId, userId });
    }
  };

  const sendWebRTCAnswer = (answer: any, roomId: string, userId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('answer', { answer, roomId, userId });
    }
  };

  const sendICECandidate = (candidate: any, roomId: string, userId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('ice-candidate', { candidate, roomId, userId });
    }
  };

  const syncVideoPlay = (roomId: string, currentTime: number) => {
    if (socketRef.current) {
      socketRef.current.emit('video-play', { roomId, currentTime });
    }
  };

  const syncVideoPause = (roomId: string, currentTime: number) => {
    if (socketRef.current) {
      socketRef.current.emit('video-pause', { roomId, currentTime });
    }
  };

  const syncVideoSeek = (roomId: string, currentTime: number) => {
    if (socketRef.current) {
      socketRef.current.emit('video-seek', { roomId, currentTime });
    }
  };

  const startGame = (roomId: string, gameType: string) => {
    if (socketRef.current) {
      socketRef.current.emit('game-start', { roomId, gameType });
    }
  };

  const sendGameAction = (roomId: string, action: any) => {
    if (socketRef.current) {
      socketRef.current.emit('game-action', { roomId, action });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    roomMembers,
    chatMessages,
    joinRoom,
    sendChatMessage,
    sendWebRTCOffer,
    sendWebRTCAnswer,
    sendICECandidate,
    syncVideoPlay,
    syncVideoPause,
    syncVideoSeek,
    startGame,
    sendGameAction
  };
};