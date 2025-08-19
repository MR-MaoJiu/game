import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Heart, 
  Plus, 
  Users, 
  Video, 
  Gamepad2, 
  LogOut, 
  Settings,
  Search,
  Lock,
  Globe,
  Copy,
  Check
} from 'lucide-react';

interface Room {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
}

const Home: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleApiError = (status: number) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('auth_token');
      navigate('/login');
    }
  };
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);
  
  // 创建房间表单
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  
  // 加入房间表单
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('获取房间列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    console.log('🚀 handleCreateRoom 函数被调用');
    e.preventDefault();
    
    // 验证表单数据
    console.log('📝 表单数据:', {
      roomName,
      roomDescription,
      isPrivate,
      roomPassword: isPrivate ? roomPassword : 'N/A'
    });
    
    // 检查必填字段
    if (!roomName.trim()) {
      console.error('❌ 房间名称不能为空');
      alert('请输入房间名称');
      return;
    }
    
    if (isPrivate && !roomPassword.trim()) {
      console.error('❌ 私密房间必须设置密码');
      alert('私密房间必须设置密码');
      return;
    }
    
    try {
      console.log('🌐 开始发送网络请求...');
      const token = localStorage.getItem('auth_token');
      console.log('🔑 Token:', token ? '存在' : '不存在');
      
      const requestBody = {
        name: roomName,
        description: roomDescription,
        isPrivate,
        password: isPrivate ? roomPassword : undefined
      };
      console.log('📦 请求体:', requestBody);
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 响应状态:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 房间创建成功:', data);
        setShowCreateModal(false);
        
        // 给Socket连接一些时间建立，然后跳转到房间页面
        console.log('🎯 准备跳转到房间页面:', `/room/${data.data.id}`);
        setTimeout(() => {
          console.log('🚀 执行跳转到房间页面:', `/room/${data.data.id}`);
          navigate(`/room/${data.data.id}`);
        }, 500); // 延迟500ms确保Socket连接建立
      } else {
        // 处理401/403错误，自动登出
        if (response.status === 401 || response.status === 403) {
          handleApiError(response.status);
          return;
        }
        
        const errorData = await response.text();
        console.error('❌ 服务器响应错误:', response.status, errorData);
        alert(`创建房间失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ 网络请求失败:', error);
      alert('网络请求失败，请检查网络连接');
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/rooms/${joinRoomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          password: joinPassword || undefined
        })
      });
      
      if (response.ok) {
        setShowJoinModal(false);
        
        // 给Socket连接一些时间建立，然后跳转到房间页面
        setTimeout(() => {
          navigate(`/room/${joinRoomId}`);
        }, 500); // 延迟500ms确保Socket连接建立
      } else {
        // 处理401/403错误，自动登出
        if (response.status === 401 || response.status === 403) {
          handleApiError(response.status);
          return;
        }
        
        const errorData = await response.text();
        console.error('加入房间失败:', response.status, errorData);
        alert(`加入房间失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('加入房间失败:', error);
      alert('网络请求失败，请检查网络连接');
    }
  };

  const handleRoomClick = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  const handleCopyRoomId = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发房间点击事件
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedRoomId(roomId);
      setTimeout(() => setCopiedRoomId(null), 2000); // 2秒后重置复制状态
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100">
      {/* 顶部导航 */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <Heart className="w-8 h-8 text-purple-600 mr-2" />
                <h1 className="text-xl font-bold text-gray-800">情侣小游戏</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">欢迎, {user?.username}</span>
              <button
                onClick={() => navigate('/profile')}
                className="p-2 text-gray-600 hover:text-purple-600 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 欢迎区域 */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">
            开始你们的甜蜜时光 💕
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            创建或加入房间，与你的另一半一起游戏、看视频、聊天
          </p>
          
          {/* 快速操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-medium hover:from-pink-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              创建房间
            </button>
            
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center px-8 py-4 bg-white/80 text-purple-600 border-2 border-purple-200 rounded-2xl font-medium hover:bg-purple-50 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <Users className="w-5 h-5 mr-2" />
              加入房间
            </button>
          </div>
        </div>

        {/* 功能介绍 */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">一起游戏</h3>
            <p className="text-gray-600">多种情侣小游戏，增进感情，创造美好回忆</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">同步观影</h3>
            <p className="text-gray-600">实时同步视频播放，就像坐在一起看电影</p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">视频通话</h3>
            <p className="text-gray-600">高清音视频通话，随时随地面对面交流</p>
          </div>
        </div>

        {/* 房间列表 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 sm:mb-0">活跃房间</h3>
            
            {/* 搜索框 */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索房间..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 w-full sm:w-64"
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">加载中...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">暂无活跃房间</p>
              <p className="text-gray-500">创建第一个房间开始游戏吧！</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleRoomClick(room.id)}
                  className="bg-gradient-to-br from-white to-purple-50 rounded-xl p-4 border border-purple-100 hover:border-purple-300 cursor-pointer transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 truncate">{room.name}</h4>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <span className="mr-2">ID: {room.id}</span>
                        <button
                          onClick={(e) => handleCopyRoomId(room.id, e)}
                          className="flex items-center hover:text-purple-600 transition-colors"
                          title="复制房间ID"
                        >
                          {copiedRoomId === room.id ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    {room.isPrivate ? (
                      <Lock className="w-4 h-4 text-gray-500 ml-2" />
                    ) : (
                      <Globe className="w-4 h-4 text-gray-500 ml-2" />
                    )}
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{room.description}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center text-gray-500">
                      <Users className="w-4 h-4 mr-1" />
                      {room.memberCount}/{room.maxMembers}
                    </span>
                    <span className="text-purple-600 font-medium">加入房间</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 创建房间模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">创建新房间</h3>
            
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  房间名称
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="给房间起个名字"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  房间描述
                </label>
                <textarea
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  placeholder="描述一下这个房间"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="isPrivate" className="text-sm text-gray-700">
                  私密房间
                </label>
              </div>
              
              {isPrivate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    房间密码
                  </label>
                  <input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    required={isPrivate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="设置房间密码"
                  />
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
                >创建</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 加入房间模态框 */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">加入房间</h3>
            
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  房间ID
                </label>
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="输入房间ID"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  密码（如果需要）
                </label>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="输入房间密码"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
                >
                  加入
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
    </div>
  );
};

export default Home;