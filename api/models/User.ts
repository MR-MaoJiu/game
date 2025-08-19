import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url?: string;
  nickname?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  nickname?: string;
  avatar_url?: string;
}

export interface UserRow extends RowDataPacket, User {}

export class UserModel {
  // 创建用户
  static async create(userData: CreateUserData): Promise<User | null> {
    try {
      const { username, email, password, nickname, avatar_url } = userData;
      
      // 加密密码
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO users (username, email, password_hash, nickname, avatar_url) 
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, password_hash, nickname || username, avatar_url || null]
      );
      
      if (result.insertId) {
        return await this.findById(result.insertId);
      }
      
      return null;
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  }
  
  // 根据ID查找用户
  static async findById(id: number): Promise<User | null> {
    try {
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }
  
  // 根据用户名查找用户
  static async findByUsername(username: string): Promise<User | null> {
    try {
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }
  
  // 根据邮箱查找用户
  static async findByEmail(email: string): Promise<User | null> {
    try {
      const [rows] = await pool.execute<UserRow[]>(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找用户失败:', error);
      throw error;
    }
  }
  
  // 验证密码
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('密码验证失败:', error);
      return false;
    }
  }
  
  // 更新用户信息
  static async update(id: number, updateData: Partial<CreateUserData>): Promise<User | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined && key !== 'password') {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });
      
      if (updateData.password) {
        const password_hash = await bcrypt.hash(updateData.password, 10);
        fields.push('password_hash = ?');
        values.push(password_hash);
      }
      
      if (fields.length === 0) {
        return await this.findById(id);
      }
      
      values.push(id);
      
      await pool.execute(
        `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
      
      return await this.findById(id);
    } catch (error) {
      console.error('更新用户失败:', error);
      throw error;
    }
  }
  
  // 删除用户
  static async delete(id: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }
  
  // 获取用户列表（分页）
  static async getUsers(page: number = 1, limit: number = 10): Promise<{ users: User[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      const [users] = await pool.execute<UserRow[]>(
        'SELECT id, username, email, avatar_url, nickname, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      
      const [countResult] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM users'
      );
      
      const total = countResult[0].total;
      
      return { users, total };
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
  }
}