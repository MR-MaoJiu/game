import { Server } from 'socket.io';

let io: Server | null = null;

export const setSocketIO = (socketInstance: Server) => {
  io = socketInstance;
};

export const getSocketIO = (): Server | null => {
  return io;
};

export const emitRoomUpdate = (roomId: string, eventType: 'member-joined' | 'member-left', data: any) => {
  if (io) {
    io.to(roomId).emit('room-member-update', {
      type: eventType,
      roomId,
      data,
      timestamp: new Date().toISOString()
    });
  }
};