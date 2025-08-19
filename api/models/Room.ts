import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

export interface Room {
  id: string;
  name: string;
  creator_id: number;
  max_players: number;
  current_players: number;
  is_private: boolean;
  password?: string;
  status: 'waiting' | 'playing' | 'finished';
  created_at: Date;
  updated_at: Date;
}

export interface CreateRoomData {
  name: string;
  creator_id: number;
  max_players?: number;
  is_private?: boolean;
  password?: string | null;
}

export interface RoomRow extends RowDataPacket, Room {}

export interface RoomMember {
  id: number;
  room_id: string;
  user_id: number;
  joined_at: Date;
  username?: string;
  nickname?: string;
  avatar_url?: string;
}

export interface RoomMemberRow extends RowDataPacket, RoomMember {}

export class RoomModel {
  // 创建房间
  static async create(roomData: CreateRoomData): Promise<Room | null> {
    try {
      const { name, creator_id, max_players = 2, is_private = false, password } = roomData;
      const roomId = uuidv4();
      
      // 确保所有参数都不是undefined，MySQL不接受undefined值
      const safePassword = password === undefined ? null : password;
      const safeMaxPlayers = max_players === undefined ? 2 : max_players;
      const safeIsPrivate = is_private === undefined ? false : is_private;
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO rooms (id, name, creator_id, max_players, current_players, is_private, password) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [roomId, name, creator_id, safeMaxPlayers, safeIsPrivate, safePassword]
      );
      
      if (result.affectedRows > 0) {
        // 创建者自动加入房间
        await this.addMember(roomId, creator_id);
        return await this.findById(roomId);
      }
      
      return null;
    } catch (error) {
      console.error('创建房间失败:', error);
      throw error;
    }
  }
  
  // 根据ID查找房间
  static async findById(id: string): Promise<Room | null> {
    try {
      const [rows] = await pool.execute<RoomRow[]>(
        'SELECT * FROM rooms WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找房间失败:', error);
      throw error;
    }
  }
  
  // 获取房间列表
  static async getRooms(page: number = 1, limit: number = 10): Promise<{ rooms: Room[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // 确保limit和offset是安全的数字
      const safeLimit = Math.max(1, Math.min(100, Number(limit)));
      const safeOffset = Math.max(0, Number(offset));
      
      const [rooms] = await pool.execute<RoomRow[]>(
        `SELECT r.*, u.username as creator_username, u.nickname as creator_nickname 
         FROM rooms r 
         LEFT JOIN users u ON r.creator_id = u.id 
         WHERE r.status != 'finished' 
         ORDER BY r.created_at DESC 
         LIMIT ${safeLimit} OFFSET ${safeOffset}`
      );
      
      const [countResult] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM rooms WHERE status != "finished"'
      );
      
      const total = countResult[0].total;
      
      return { rooms, total };
    } catch (error) {
      console.error('获取房间列表失败:', error);
      throw error;
    }
  }
  
  // 添加房间成员
  static async addMember(roomId: string, userId: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 检查房间是否存在且未满
      const [roomRows] = await connection.execute<RoomRow[]>(
        'SELECT * FROM rooms WHERE id = ? AND current_players < max_players',
        [roomId]
      );
      
      if (roomRows.length === 0) {
        throw new Error('房间不存在或已满');
      }
      
      // 检查用户是否已在房间中
      const [memberRows] = await connection.execute<RoomMemberRow[]>(
        'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
      );
      
      if (memberRows.length > 0) {
        throw new Error('用户已在房间中');
      }
      
      // 添加成员
      await connection.execute<ResultSetHeader>(
        'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
        [roomId, userId]
      );
      
      // 更新房间人数
      await connection.execute<ResultSetHeader>(
        'UPDATE rooms SET current_players = current_players + 1 WHERE id = ?',
        [roomId]
      );
      
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('添加房间成员失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // 移除房间成员
  static async removeMember(roomId: string, userId: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 移除成员
      const [result] = await connection.execute<ResultSetHeader>(
        'DELETE FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
      );
      
      if (result.affectedRows > 0) {
        // 更新房间人数
        await connection.execute<ResultSetHeader>(
          'UPDATE rooms SET current_players = current_players - 1 WHERE id = ?',
          [roomId]
        );
        
        // 检查房间是否为空，如果为空则删除房间
        const [roomRows] = await connection.execute<RoomRow[]>(
          'SELECT current_players FROM rooms WHERE id = ?',
          [roomId]
        );
        
        if (roomRows.length > 0 && roomRows[0].current_players <= 0) {
          await connection.execute<ResultSetHeader>(
            'DELETE FROM rooms WHERE id = ?',
            [roomId]
          );
        }
      }
      
      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      console.error('移除房间成员失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // 获取房间成员
  static async getMembers(roomId: string): Promise<RoomMember[]> {
    try {
      const [rows] = await pool.execute<RoomMemberRow[]>(
        `SELECT rm.*, u.username, u.nickname, u.avatar_url 
         FROM room_members rm 
         LEFT JOIN users u ON rm.user_id = u.id 
         WHERE rm.room_id = ? 
         ORDER BY rm.joined_at ASC`,
        [roomId]
      );
      
      return rows;
    } catch (error) {
      console.error('获取房间成员失败:', error);
      throw error;
    }
  }
  
  // 更新房间状态
  static async updateStatus(roomId: string, status: 'waiting' | 'playing' | 'finished'): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE rooms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, roomId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('更新房间状态失败:', error);
      throw error;
    }
  }
  
  // 验证房间密码
  static async verifyPassword(roomId: string, password: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RoomRow[]>(
        'SELECT password FROM rooms WHERE id = ? AND is_private = true',
        [roomId]
      );
      
      if (rows.length === 0) {
        return false;
      }
      
      return rows[0].password === password;
    } catch (error) {
      console.error('验证房间密码失败:', error);
      return false;
    }
  }
  
  // 检查用户是否在房间中
  static async isMember(roomId: string, userId: number): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RoomMemberRow[]>(
        'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('检查房间成员失败:', error);
      return false;
    }
  }
}