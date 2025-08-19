import { Router, Request, Response } from 'express';
import { GameRecordModel, CreateGameRecordData } from '../models/GameRecord';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { RoomModel } from '../models/Room';

const router = Router();

// 创建游戏记录
router.post('/records', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      room_id,
      game_type,
      players,
      winner_id,
      game_data,
      duration
    } = req.body;
    const userId = req.userId!;
    
    // 验证必填字段
    if (!room_id || !game_type || !players || !Array.isArray(players) || duration === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }
    
    // 验证房间存在
    const room = await RoomModel.findById(room_id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: '房间不存在'
      });
    }
    
    // 验证用户是否在房间中
    const isMember = await RoomModel.isMember(room_id, userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: '您不在此房间中'
      });
    }
    
    // 验证玩家列表
    if (!players.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: '玩家列表必须包含当前用户'
      });
    }
    
    const recordData: CreateGameRecordData = {
      room_id,
      game_type,
      players,
      winner_id,
      game_data,
      duration
    };
    
    const record = await GameRecordModel.create(recordData);
    
    if (!record) {
      return res.status(500).json({
        success: false,
        message: '创建游戏记录失败'
      });
    }
    
    res.status(201).json({
      success: true,
      message: '游戏记录创建成功',
      data: record
    });
    
  } catch (error) {
    console.error('创建游戏记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取游戏记录详情
router.get('/records/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id);
    
    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        message: '无效的记录ID'
      });
    }
    
    const record = await GameRecordModel.findById(recordId);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '游戏记录不存在'
      });
    }
    
    // 验证用户是否有权限查看此记录
    const players = JSON.parse(record.players);
    if (!players.includes(req.userId)) {
      return res.status(403).json({
        success: false,
        message: '无权限查看此记录'
      });
    }
    
    res.json({
      success: true,
      data: record
    });
    
  } catch (error) {
    console.error('获取游戏记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取房间游戏记录
router.get('/rooms/:roomId/records', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.userId!;
    
    // 验证房间存在
    const room = await RoomModel.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: '房间不存在'
      });
    }
    
    // 验证用户是否在房间中
    const isMember = await RoomModel.isMember(roomId, userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: '您不在此房间中'
      });
    }
    
    const { records, total } = await GameRecordModel.getByRoomId(roomId, page, limit);
    
    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取房间游戏记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取用户游戏记录
router.get('/users/me/records', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.userId!;
    
    const { records, total } = await GameRecordModel.getByUserId(userId, page, limit);
    
    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取用户游戏记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 获取用户游戏统计
router.get('/users/me/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    const stats = await GameRecordModel.getUserStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('获取用户游戏统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 更新游戏记录
router.put('/records/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id);
    const { winner_id, game_data, duration } = req.body;
    const userId = req.userId!;
    
    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        message: '无效的记录ID'
      });
    }
    
    // 验证记录存在
    const record = await GameRecordModel.findById(recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '游戏记录不存在'
      });
    }
    
    // 验证用户是否有权限更新此记录
    const players = JSON.parse(record.players);
    if (!players.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: '无权限更新此记录'
      });
    }
    
    const updateData: any = {};
    if (winner_id !== undefined) updateData.winner_id = winner_id;
    if (game_data !== undefined) updateData.game_data = game_data;
    if (duration !== undefined) updateData.duration = duration;
    
    const success = await GameRecordModel.update(recordId, updateData);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新游戏记录失败'
      });
    }
    
    // 获取更新后的记录
    const updatedRecord = await GameRecordModel.findById(recordId);
    
    res.json({
      success: true,
      message: '游戏记录更新成功',
      data: updatedRecord
    });
    
  } catch (error) {
    console.error('更新游戏记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

// 删除游戏记录
router.delete('/records/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const recordId = parseInt(id);
    const userId = req.userId!;
    
    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        message: '无效的记录ID'
      });
    }
    
    // 验证记录存在
    const record = await GameRecordModel.findById(recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '游戏记录不存在'
      });
    }
    
    // 验证用户是否有权限删除此记录
    const players = JSON.parse(record.players);
    if (!players.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: '无权限删除此记录'
      });
    }
    
    const success = await GameRecordModel.delete(recordId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除游戏记录失败'
      });
    }
    
    res.json({
      success: true,
      message: '游戏记录删除成功'
    });
    
  } catch (error) {
    console.error('删除游戏记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;