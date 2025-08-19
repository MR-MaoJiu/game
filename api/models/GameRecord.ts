import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database';

export interface GameRecord {
  id: number;
  room_id: string;
  game_type: string;
  players: string; // JSON string of player IDs
  winner_id?: number;
  game_data: string; // JSON string of game-specific data
  duration: number; // in seconds
  created_at: Date;
  updated_at: Date;
}

export interface CreateGameRecordData {
  room_id: string;
  game_type: string;
  players: number[];
  winner_id?: number;
  game_data?: any;
  duration: number;
}

export class GameRecordModel {
  // 创建游戏记录
  static async create(data: CreateGameRecordData): Promise<GameRecord | null> {
    try {
      const {
        room_id,
        game_type,
        players,
        winner_id,
        game_data = {},
        duration
      } = data;
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO game_records (room_id, game_type, players, winner_id, game_data, duration)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          room_id,
          game_type,
          JSON.stringify(players),
          winner_id || null,
          JSON.stringify(game_data),
          duration
        ]
      );
      
      if (result.insertId) {
        return await this.findById(result.insertId);
      }
      
      return null;
    } catch (error) {
      console.error('创建游戏记录失败:', error);
      return null;
    }
  }
  
  // 根据ID查找游戏记录
  static async findById(id: number): Promise<GameRecord | null> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM game_records WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      const record = rows[0] as GameRecord;
      return record;
    } catch (error) {
      console.error('查找游戏记录失败:', error);
      return null;
    }
  }
  
  // 获取房间的游戏记录
  static async getByRoomId(roomId: string, page: number = 1, limit: number = 10): Promise<{
    records: GameRecord[];
    total: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      
      // 获取总数
      const [countRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM game_records WHERE room_id = ?',
        [roomId]
      );
      const total = countRows[0].total;
      
      // 获取记录
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT gr.*, u.username as winner_username
         FROM game_records gr
         LEFT JOIN users u ON gr.winner_id = u.id
         WHERE gr.room_id = ?
         ORDER BY gr.created_at DESC
         LIMIT ? OFFSET ?`,
        [roomId, limit, offset]
      );
      
      return {
        records: rows as GameRecord[],
        total
      };
    } catch (error) {
      console.error('获取房间游戏记录失败:', error);
      return { records: [], total: 0 };
    }
  }
  
  // 获取用户的游戏记录
  static async getByUserId(userId: number, page: number = 1, limit: number = 10): Promise<{
    records: GameRecord[];
    total: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      
      // 获取总数
      const [countRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM game_records WHERE JSON_CONTAINS(players, ?)',
        [JSON.stringify(userId)]
      );
      const total = countRows[0].total;
      
      // 获取记录
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT gr.*, u.username as winner_username, r.name as room_name
         FROM game_records gr
         LEFT JOIN users u ON gr.winner_id = u.id
         LEFT JOIN rooms r ON gr.room_id = r.id
         WHERE JSON_CONTAINS(gr.players, ?)
         ORDER BY gr.created_at DESC
         LIMIT ? OFFSET ?`,
        [JSON.stringify(userId), limit, offset]
      );
      
      return {
        records: rows as GameRecord[],
        total
      };
    } catch (error) {
      console.error('获取用户游戏记录失败:', error);
      return { records: [], total: 0 };
    }
  }
  
  // 获取用户游戏统计
  static async getUserStats(userId: number): Promise<{
    totalGames: number;
    totalWins: number;
    winRate: number;
    gameTypes: { [key: string]: { total: number; wins: number } };
  }> {
    try {
      // 获取总游戏数
      const [totalRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM game_records WHERE JSON_CONTAINS(players, ?)',
        [JSON.stringify(userId)]
      );
      const totalGames = totalRows[0].total;
      
      // 获取胜利数
      const [winRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as wins FROM game_records WHERE winner_id = ?',
        [userId]
      );
      const totalWins = winRows[0].wins;
      
      // 获取各游戏类型统计
      const [typeRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 
           game_type,
           COUNT(*) as total,
           SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins
         FROM game_records 
         WHERE JSON_CONTAINS(players, ?)
         GROUP BY game_type`,
        [userId, JSON.stringify(userId)]
      );
      
      const gameTypes: { [key: string]: { total: number; wins: number } } = {};
      typeRows.forEach((row: any) => {
        gameTypes[row.game_type] = {
          total: row.total,
          wins: row.wins
        };
      });
      
      const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
      
      return {
        totalGames,
        totalWins,
        winRate: Math.round(winRate * 100) / 100,
        gameTypes
      };
    } catch (error) {
      console.error('获取用户游戏统计失败:', error);
      return {
        totalGames: 0,
        totalWins: 0,
        winRate: 0,
        gameTypes: {}
      };
    }
  }
  
  // 更新游戏记录
  static async update(id: number, data: Partial<CreateGameRecordData>): Promise<boolean> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      
      if (data.winner_id !== undefined) {
        fields.push('winner_id = ?');
        values.push(data.winner_id);
      }
      
      if (data.game_data !== undefined) {
        fields.push('game_data = ?');
        values.push(JSON.stringify(data.game_data));
      }
      
      if (data.duration !== undefined) {
        fields.push('duration = ?');
        values.push(data.duration);
      }
      
      if (fields.length === 0) {
        return false;
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE game_records SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('更新游戏记录失败:', error);
      return false;
    }
  }
  
  // 删除游戏记录
  static async delete(id: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM game_records WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('删除游戏记录失败:', error);
      return false;
    }
  }
}