import { Router, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { UserModel, CreateUserData } from '../models/User';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, nickname } = req.body;
    
    // 验证必填字段
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名、邮箱和密码为必填项' 
      });
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱格式不正确' 
      });
    }
    
    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: '密码长度至少为6位' 
      });
    }
    
    // 检查用户名是否已存在
    const existingUserByUsername = await UserModel.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名已存在' 
      });
    }
    
    // 检查邮箱是否已存在
    const existingUserByEmail = await UserModel.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱已被注册' 
      });
    }
    
    // 创建用户
    const userData: CreateUserData = {
      username,
      email,
      password,
      nickname: nickname || username
    };
    
    const user = await UserModel.create(userData);
    
    if (!user) {
      return res.status(500).json({ 
        success: false, 
        message: '用户创建失败' 
      });
    }
    
    // 生成JWT token
    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue
    };
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET!,
      signOptions
    );
    
    // 返回用户信息（不包含密码）
    const { password_hash, ...userInfo } = user;
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: userInfo,
        token
      }
    });
    
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    
    // 验证必填字段
    if ((!username && !email) || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或邮箱以及密码为必填项' 
      });
    }
    
    // 查找用户（支持用户名或邮箱登录）
    let user;
    if (email) {
      user = await UserModel.findByEmail(email);
    } else if (username) {
      user = await UserModel.findByUsername(username);
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }
    
    // 验证密码
    const isPasswordValid = await UserModel.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }
    
    // 生成JWT token
    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue
    };
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET!,
      signOptions
    );
    
    // 返回用户信息（不包含密码）
    const { password_hash, ...userInfo } = user;
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: userInfo,
        token
      }
    });
    
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }
    
    // 返回用户信息（不包含密码）
    const { password_hash, ...userInfo } = user;
    
    res.json({
      success: true,
      data: { user: userInfo }
    });
    
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 更新用户信息
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { nickname, avatar_url } = req.body;
    
    const updatedUser = await UserModel.update(userId, {
      nickname,
      avatar_url
    });
    
    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }
    
    // 返回用户信息（不包含密码）
    const { password_hash, ...userInfo } = updatedUser;
    
    res.json({
      success: true,
      message: '用户信息更新成功',
      data: { user: userInfo }
    });
    
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

export default router;