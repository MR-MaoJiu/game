# 💗 异地情侣腻歪的平台

一个功能丰富的异地情侣们（也可以是异地好朋友们）腻歪的平台，支持实时视频通话、多种游戏、一起看视频等功能。

## ✨ 主要功能

### 🎯 游戏功能
- **井字棋 (Tic-Tac-Toe)** - 经典的三连棋游戏
- **石头剪刀布 (Rock Paper Scissors)** - 多轮对战模式
- **爱情测试 (Love Quiz)** - 趣味问答游戏
- **接龙游戏 (Word Chain)** - 词语接龙挑战

### 📞 实时通信
- **WebRTC视频通话** - 高质量点对点视频通话
- **可拖拽窗口** - 支持最小化和拖拽的通话窗口
- **音频/视频控制** - 静音、关闭摄像头等功能
- **实时聊天** - 文本消息实时同步

### 🎬 一起看视频
- **视频同步播放** - 双人同步观看视频
- **播放列表管理** - 添加、删除、切换视频
- **弹幕系统** - 实时弹幕互动
- **播放控制同步** - 播放、暂停、进度跳转同步

### 🏠 房间系统
- **创建/加入房间** - 支持公开和私密房间
- **房间管理** - 最大人数限制、密码保护
- **成员管理** - 实时显示在线成员
- **邀请系统** - 游戏邀请和视频邀请机制

## 🛠️ 技术栈

### 前端
- **React 18** - 现代化UI框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **Tailwind CSS** - 原子化CSS框架
- **Lucide React** - 图标库
- **React Router Dom** - 路由管理
- **Zustand** - 状态管理

### 后端
- **Node.js** - 服务器运行时
- **Express** - Web框架
- **Socket.io** - 实时通信
- **MySQL2** - 数据库连接
- **JWT** - 身份验证
- **bcryptjs** - 密码加密

### 实时通信
- **WebRTC** - 点对点视频通话
- **Simple-Peer** - WebRTC封装库
- **Socket.io** - 信令服务器

## 📦 安装和运行

### 环境要求
- Node.js >= 16
- MySQL 8.0+
- pnpm (推荐) 或 npm

### 1. 克隆项目
```bash
git clone <repository-url>
cd game
```

### 2. 安装依赖
```bash
pnpm install
# 或
npm install
```

### 3. 环境配置
创建 `.env` 文件并配置以下环境变量：
```env
# 数据库配置
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=game_db

# JWT密钥
JWT_SECRET=your_jwt_secret_key

# 服务器端口
PORT=3001
```

### 4. 数据库设置
```sql
-- 创建数据库
CREATE DATABASE game_db;

-- 创建用户表
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建房间表
CREATE TABLE rooms (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  creator_id INT NOT NULL,
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE,
  password VARCHAR(255),
  status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 创建房间成员表
CREATE TABLE room_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_user (room_id, user_id)
);

-- 创建游戏记录表
CREATE TABLE game_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(255) NOT NULL,
  game_type ENUM('tic-tac-toe', 'rock-paper-scissors', 'love-quiz', 'word-chain') NOT NULL,
  players JSON NOT NULL,
  winner_id INT,
  game_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### 5. 启动项目
```bash
# 开发模式（同时启动前端和后端）
pnpm dev
# 或
npm run dev

# 单独启动前端
pnpm client:dev

# 单独启动后端
pnpm server:dev
```

### 6. 访问应用
- 前端: http://localhost:5173
- 后端API: http://localhost:3001

## 🎯 使用指南

### 用户注册和登录
1. 访问应用首页
2. 点击"注册"创建新账户
3. 使用用户名和密码登录

### 创建和加入房间
1. 登录后在首页点击"创建房间"
2. 设置房间名称、最大人数等参数
3. 其他用户可以通过房间列表加入

### 开始游戏
1. 在房间内点击"开始游戏"
2. 选择想要玩的游戏类型
3. 等待其他玩家接受邀请
4. 开始游戏对战

### 视频通话
1. 在房间内点击"视频通话"按钮
2. 允许浏览器访问摄像头和麦克风
3. 等待其他用户接受通话邀请
4. 享受高质量视频通话

### 一起看视频
1. 点击"一起看视频"按钮
2. 添加视频URL到播放列表
3. 选择视频开始同步播放
4. 使用弹幕功能互动

## 🚀 部署

### 生产环境构建
```bash
pnpm build
```

### Vercel部署
项目已配置Vercel部署，包含：
- `vercel.json` 配置文件
- API路由自动处理
- 环境变量配置

### Docker部署
```dockerfile
# 可以创建Dockerfile进行容器化部署
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## 🔧 开发

### 项目结构
```
├── api/                 # 后端API
│   ├── config/         # 数据库配置
│   ├── middleware/     # 中间件
│   ├── models/         # 数据模型
│   ├── routes/         # API路由
│   └── server.ts       # 服务器入口
├── src/                # 前端源码
│   ├── components/     # React组件
│   ├── contexts/       # React上下文
│   ├── hooks/          # 自定义Hooks
│   ├── pages/          # 页面组件
│   └── lib/            # 工具函数
├── public/             # 静态资源
└── README.md
```

### 开发规范
- 使用TypeScript进行类型检查
- 遵循ESLint代码规范
- 使用Prettier格式化代码
- 组件采用函数式编程
- 使用自定义Hooks抽离逻辑

## 🐛 问题排查

### 常见问题

1. **视频通话无法连接**
   - 检查浏览器权限设置
   - 确保HTTPS环境（生产环境）
   - 检查防火墙设置

2. **游戏邀请失败**
   - 检查Socket.io连接状态
   - 确认用户在同一房间
   - 检查网络连接

3. **数据库连接失败**
   - 检查数据库服务状态
   - 验证环境变量配置
   - 确认数据库权限

### 调试模式
```bash
# 启用详细日志
DEBUG=socket.io:* pnpm dev
```

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 贡献步骤
1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 创建Issue
- 发送邮件至项目维护者

---

⭐ 如果这个项目对你有帮助，请给它一个星标！