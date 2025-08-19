import { Router, Request, Response } from 'express';
import { RoomModel, CreateRoomData } from '../models/Room';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { emitRoomUpdate } from '../socket.js';

const router = Router();

// 创建房间
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, maxPlayers = 2, isPrivate = false, password } = req.body;
    const creatorId = req.userId!;
    
    console.log('创建房间API - 请求体:', { name, maxPlayers, isPrivate, password: password ? '***' : undefined });
    console.log('创建房间API - 创建者ID:', creatorId);
    
    // 验证必填字段
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '房间名称不能为空'
      });
    }
    
    // 验证最大玩家数
    if (maxPlayers < 2 || maxPlayers > 10) {
      return res.status(400).json({
        success: false,
        message: '房间最大玩家数应在2-10之间'
      });
    }
    
    // 如果是私有房间，验证密码
    if (isPrivate && (!password || password.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: '私有房间必须设置密码'
      });
    }
    
    const roomData: CreateRoomData = {
      name: name.trim(),
      creator_id: creatorId,
      max_players: maxPlayers,
      is_private: isPrivate,
      password: isPrivate ? password.trim() : null
    };
    
    console.log('创建房间API - 房间数据:', { ...roomData, password: roomData.password ? '***' : null });
    
    const room = await RoomModel.create(roomData);
    console.log('创建房间API - 创建结果:', room ? '成功' : '失败');
    
    if (!room) {
      console.log('创建房间API - 房间创建失败');
      return res.status(500).json({
        success: false,
        message: '房间创建失败'
      });
    }
    
    // 不返回密码
    const { password: _, ...roomInfo } = room;
    
    console.log('创建房间API - 房间创建成功，房间ID:', room.id);
    res.status(201).json({
      success: true,
      message: '房间创建成功',
      data: roomInfo
    });
    
  } catch (error) {
    console.error('创建房间失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取房间列表
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const { rooms, total } = await RoomModel.getRooms(page, limit);
    
    // 不返回密码
    const roomList = rooms.map(room => {
      const { password, ...roomInfo } = room;
      return roomInfo;
    });
    
    res.json({
      success: true,
      data: {
        rooms: roomList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取房间列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取房间详情
router.get('/:id', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const room = await RoomModel.findById(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: '房间不存在'
      });
    }
    
    // 获取房间成员
    const members = await RoomModel.getMembers(id);
    
    // 不返回密码
    const { password, ...roomInfo } = room;
    
    res.json({
      success: true,
      data: {
        ...roomInfo,
        members
      }
    });
    
  } catch (error) {
    console.error('获取房间详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 加入房间
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.userId!;
    
    console.log(`[JOIN ATTEMPT] User ${userId} is attempting to join room ${id}`);

    // 检查房间是否存在
    const room = await RoomModel.findById(id);
    
    // --- START DEBUG LOGGING ---
    console.log('[JOIN DEBUG] Fetched room data:', JSON.stringify(room, null, 2));
    // --- END DEBUG LOGGING ---

    if (!room) {
      console.log('[JOIN REJECT] Room not found.');
      return res.status(404).json({
        success: false,
        message: '房间不存在'
      });
    }
    
    // --- START DEBUG LOGGING ---
    console.log(`[JOIN DEBUG] Checking room capacity. current_players: ${room.current_players}, max_players: ${room.max_players}`);
    // --- END DEBUG LOGGING ---

    // 检查房间是否已满
    if (room.current_players >= room.max_players) {
      console.log(`[JOIN REJECT] Room is full. ${room.current_players} >= ${room.max_players}`);
      return res.status(400).json({
        success: false,
        message: '房间已满'
      });
    }

    // 检查用户是否已在房间中
    const isAlreadyMember = await RoomModel.isMember(id, userId);
    console.log('[JOIN DEBUG] Is user already a member:', isAlreadyMember);
    if (isAlreadyMember) {
      console.log('[JOIN REJECT] User is already a member.');
      return res.status(400).json({
        success: false,
        message: '您已在房间中'
      });
    }

    // 如果是私有房间，验证密码
    console.log('[JOIN DEBUG] Is room private:', room.is_private);
    if (room.is_private) {
      if (!password) {
        console.log('[JOIN REJECT] Private room requires a password.');
        return res.status(400).json({
          success: false,
          message: '私有房间需要密码'
        });
      }
      
      const isPasswordValid = await RoomModel.verifyPassword(id, password);
      console.log('[JOIN DEBUG] Password validation result:', isPasswordValid);
      if (!isPasswordValid) {
        console.log('[JOIN REJECT] Incorrect password.');
        return res.status(401).json({
          success: false,
          message: '房间密码错误'
        });
      }
    }
    
    // 加入房间
    console.log('[JOIN ACTION] Adding member to room...');
    const success = await RoomModel.addMember(id, userId);
    console.log('[JOIN ACTION] Add member result:', success);
    if (!success) {
      console.log('[JOIN REJECT] addMember returned false/threw error.');
      return res.status(500).json({
        success: false,
        message: '加入房间失败'
      });
    }
    
    // 获取更新后的房间信息
    const updatedRoom = await RoomModel.findById(id);
    const members = await RoomModel.getMembers(id);
    
    // 发送Socket.io通知
    console.log('[JOIN SUCCESS] Emitting room update.');
    emitRoomUpdate(id, 'member-joined', {
      room: updatedRoom,
      members,
      newMember: members.find(m => m.user_id === userId)
    });
    
    res.json({
      success: true,
      message: '成功加入房间',
      data: {
        room: updatedRoom,
        members
      }
    });
    
  } catch (error) {
    console.error('加入房间失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 离开房间
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    
    const room = await RoomModel.findById(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: '房间不存在'
      });
    }
    
    // 检查用户是否在房间中
    const isMember = await RoomModel.isMember(id, userId);
    if (!isMember) {
      return res.status(400).json({
        success: false,
        message: '您不在此房间中'
      });
    }
    
    // 离开房间
    const success = await RoomModel.removeMember(id, userId);
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '离开房间失败'
      });
    }
    
    // 获取更新后的房间信息
    const updatedRoom = await RoomModel.findById(id);
    const members = await RoomModel.getMembers(id);
    
    // 发送Socket.io通知
    emitRoomUpdate(id, 'member-left', {
      room: updatedRoom,
      members,
      leftUserId: userId
    });
    
    res.json({
      success: true,
      message: '成功离开房间'
    });
    
  } catch (error) {
    console.error('离开房间失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取房间成员
router.get('/:id/members', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const room = await RoomModel.findById(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: '房间不存在'
      });
    }
    
    const members = await RoomModel.getMembers(id);
    
    res.json({
      success: true,
      data: { members }
    });
    
  } catch (error) {
    console.error('获取房间成员失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;