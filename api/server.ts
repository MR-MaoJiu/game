/**
 * local server entry file, for local development
 */
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { setSocketIO, emitRoomUpdate } from './socket.js';
import { RoomModel } from './models/Room.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Set socket instance for use in other modules
setSocketIO(io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Extend socket type to store our custom properties
  const extSocket = socket as typeof socket & { userId?: number; roomId?: string };

  // Join room
  socket.on('join-room', async (roomId: string, userId: string) => {
    extSocket.roomId = roomId;
    extSocket.userId = parseInt(userId, 10);
    extSocket.join(roomId);
    console.log(`[Socket] User ${userId} joined room ${roomId}`);
    
    // Broadcast room member update
    try {
      const room = await RoomModel.findById(roomId);
      const members = await RoomModel.getMembers(roomId);
      if (room && members) {
        emitRoomUpdate(roomId, 'member-joined', {
          room,
          members,
          newMember: members.find(m => m.user_id.toString() === userId)
        });
      }
    } catch (error) {
      console.error('Failed to broadcast room update:', error);
    }
  });

  // --- NEW CALL FLOW SIGNALING ---
  socket.on('CALL:REQUEST', (data) => {
    console.log(`[Signal] Received CALL:REQUEST from ${data.from} to ${data.to} in room ${data.roomId}`);
    io.to(data.roomId).emit('CALL:REQUEST', data);
  });

  socket.on('CALL:ACCEPT', (data) => {
    console.log(`[Signal] Received CALL:ACCEPT from ${data.from} to ${data.to} in room ${data.roomId}`);
    io.to(data.roomId).emit('CALL:ACCEPT', data);
  });

  socket.on('CALL:REJECT', (data) => {
    console.log(`[Signal] Received CALL:REJECT from ${data.from} to ${data.to} in room ${data.roomId}`);
    io.to(data.roomId).emit('CALL:REJECT', data);
  });

  // --- NEW WEBRTC SIGNALING ---
  socket.on('RTC:OFFER', (data) => {
    console.log(`[Signal] Forwarding RTC:OFFER from ${data.from} to ${data.to} in room ${data.roomId}`);
    io.to(data.roomId).emit('RTC:OFFER', data);
  });

  socket.on('RTC:ANSWER', (data) => {
    console.log(`[Signal] Forwarding RTC:ANSWER from ${data.from} to ${data.to} in room ${data.roomId}`);
    io.to(data.roomId).emit('RTC:ANSWER', data);
  });

  socket.on('RTC:CANDIDATE', (data) => {
    console.log(`[Signal] Forwarding RTC:CANDIDATE from ${data.from} to ${data.to} in room ${data.roomId}`);
    io.to(data.roomId).emit('RTC:CANDIDATE', data);
  });

  // 游戏邀请处理
  socket.on('game-invitation', (data) => {
    console.log(`[Game] Game invitation from ${data.from} for ${data.gameId} in room ${data.roomId}`);
    // 转发游戏邀请给房间内其他成员
    socket.to(data.roomId).emit('game-invitation', data);
  });

  socket.on('game-invitation-response', (data) => {
    console.log(`[Game] Game invitation response from ${data.to} to ${data.from}: ${data.accepted ? 'accepted' : 'rejected'}`);
    // 转发回应给邀请发起者
    socket.to(data.roomId).emit('game-invitation-response', data);
  });

  // 一起看视频邀请处理
  socket.on('watch-together-invitation', (data) => {
    console.log(`[Video] Watch together invitation from ${data.from} in room ${data.roomId}`);
    // 转发一起看视频邀请给房间内其他成员
    socket.to(data.roomId).emit('watch-together-invitation', data);
  });

  socket.on('watch-together-invitation-response', (data) => {
    console.log(`[Video] Watch together invitation response from ${data.to} to ${data.from}: ${data.accepted ? 'accepted' : 'rejected'}`);
    // 转发回应给邀请发起者
    socket.to(data.roomId).emit('watch-together-invitation-response', data);
  });

  // Disconnect handling
  socket.on('disconnect', async () => {
    console.log(`[Socket] User disconnected: ${extSocket.id}`);
    if (extSocket.roomId && extSocket.userId) {
      console.log(`[Socket] User ${extSocket.userId} from room ${extSocket.roomId} is disconnecting. Cleaning up.`);
      try {
        await RoomModel.removeMember(extSocket.roomId, extSocket.userId);
        const updatedRoom = await RoomModel.findById(extSocket.roomId);
        const members = await RoomModel.getMembers(extSocket.roomId);
        emitRoomUpdate(extSocket.roomId, 'member-left', {
          room: updatedRoom,
          members,
          leftUserId: extSocket.userId
        });
      } catch (error) {
        console.error(`[Socket] Failed to remove member on disconnect:`, error);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

// ... (process signal handlers)

export default app;
