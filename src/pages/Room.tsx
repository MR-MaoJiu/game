import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { Users, Video, Gamepad2, Settings, LogOut, ArrowLeft, Crown, Copy, Check } from 'lucide-react';
import VideoCall from '../components/VideoCall';
import GameSelector from '../components/GameSelector';
import GameInterface from '../components/GameInterface';
import WatchTogether from '../components/WatchTogether';

interface RoomMember {
  id: number;
  user_id: number;
  room_id: string;
  joined_at: string;
  username: string;
  nickname: string;
  avatar_url?: string;
}

interface RoomInfo {
  id: string;
  name: string;
  description: string;
  creator_id: number;
  max_players: number;
  current_players: number;
  is_private: boolean;
  status: 'waiting' | 'playing' | 'finished';
  created_at: string;
  updated_at: string;
  creator_username: string;
  creator_nickname: string;
  members: RoomMember[];
}

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, handleApiError: authHandleApiError } = useAuth();

  const handleApiError = (status: number) => {
    if (status === 401 || status === 403) {
      console.log('认证失败，自动登出');
      authHandleApiError({ status } as Response);
      navigate('/login');
    }
  };
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isVideoCallEnabled, setIsVideoCallEnabled] = useState(false);
  const [isVideoCallMinimized, setIsVideoCallMinimized] = useState(false);
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [showWatchTogether, setShowWatchTogether] = useState(false);
  const [isWatchTogetherMinimized, setIsWatchTogetherMinimized] = useState(false);
  const [gameInvitation, setGameInvitation] = useState<{
    from: string;
    fromName: string;
    gameId: string;
    gameName: string;
  } | null>(null);
  const [videoInvitation, setVideoInvitation] = useState<{
    from: string;
    fromName: string;
  } | null>(null);
  const initialized = useRef(false);
  
  // 获取游戏名称
  const getGameName = (gameId: string) => {
    switch (gameId) {
      case 'tic-tac-toe': return '井字棋';
      case 'rock-paper-scissors': return '石头剪刀布';
      case 'love-quiz': return '情侣问答';
      case 'word-chain': return '成语接龙';
      default: return '游戏';
    }
  };
  
  // Socket.io连接
  const { socket, isConnected, joinRoom } = useSocket({
    roomId: roomId || '',
    userId: user?.id ? user.id.toString() : '',
    username: user?.username || ''
  });

  // 移除这个useEffect，因为我们已经在下面的useEffect中处理了房间信息获取

  // Effect for initialization
  useEffect(() => {
    if (isConnected && user && roomId && !initialized.current) {
      const initialize = async () => {
        // Prevent re-initialization
        if (initialized.current) return;
        initialized.current = true;
        
        setIsInitializing(true);
        try {
          const currentRoom = await fetchRoomInfo();
          if (currentRoom) {
            await handleJoinRoom(currentRoom);
          }
          console.log('✅ 房间初始化完成');
        } catch (error) {
          console.error('❌ 房间初始化失败:', error);
          setError(error instanceof Error ? error.message : '房间初始化失败');
          // On failure, allow re-initialization if user navigates away and back
          initialized.current = false; 
        } finally {
          setIsInitializing(false);
        }
      };
      initialize();
    }
  }, [isConnected, user, roomId]); // Effect runs when connection or context changes

  // Effect for handling socket events
  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = (data: any) => {
      console.log('Room member update:', data);
      // When the room is updated, just refetch the data
      fetchRoomInfo();
    };

    // The backend sends 'room-member-update'
    socket.on('room-member-update', handleRoomUpdate);
    
    // 监听游戏邀请
    socket.on('game-invitation', (data: any) => {
      console.log('收到游戏邀请:', data);
      if (data.from !== user?.id) { // 不处理自己发送的邀请
        setGameInvitation({
          from: data.from,
          fromName: data.fromName,
          gameId: data.gameId,
          gameName: data.gameName
        });
      }
    });

    // 监听游戏邀请响应
    socket.on('game-invitation-response', (data: any) => {
      console.log('收到游戏邀请响应:', data);
      if (data.to === user?.id && data.accepted) {
        // 邀请被接受，启动游戏
        setCurrentGame(data.gameId);
        setGameState({ status: 'playing', players: [user?.id, data.from] });
      } else if (data.to === user?.id && !data.accepted) {
        // 邀请被拒绝
        console.log('游戏邀请被拒绝');
        setGameState({ status: 'idle', players: [] });
      }
    });

    // 监听一起看视频邀请
    socket.on('watch-together-invitation', (data: any) => {
      console.log('收到一起看视频邀请:', data);
      if (data.from !== user?.id) { // 不处理自己发送的邀请
        setVideoInvitation({
          from: data.from,
          fromName: data.fromName
        });
      }
    });

    return () => {
      socket.off('room-member-update', handleRoomUpdate);
      socket.off('game-invitation');
      socket.off('game-invitation-response');
      socket.off('watch-together-invitation');
    };
  }, [socket]); // Effect runs when the socket instance is available

  const handleJoinRoom = async (currentRoom: RoomInfo) => {
    if (!user || !roomId) return;
    
    // 验证user.id的有效性
    if (!user.id || typeof user.id !== 'number') {
      console.error('用户ID无效:', user.id);
      throw new Error('用户信息不完整，请重新登录');
    }

    try {
      // 检查用户是否已经是房间成员
      const isAlreadyMember = currentRoom.members?.some(member => member.user_id === user.id);
      
      if (isAlreadyMember) {
        console.log('用户已是房间成员，跳过API调用');
        joinRoom(roomId, user.id.toString());
        return;
      }

      console.log('调用后端API加入房间...');
      const token = localStorage.getItem('auth_token');
      console.log('Token存在:', !!token);
      console.log('Token长度:', token?.length || 0);
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        console.log('✅ 成功加入房间');
        joinRoom(roomId, user.id.toString());
      } else if (response.status === 400) {
        // 可能是"您已在房间中"的错误，直接通过Socket加入
        const errorData = await response.json();
        if (errorData.message?.includes('已在房间中')) {
          console.log('用户已在房间中，直接通过Socket加入');
          joinRoom(roomId, user.id.toString());
        } else {
          throw new Error(errorData.message || '加入房间失败');
        }
      } else {
        if (response.status === 401 || response.status === 403) {
          handleApiError(response.status);
          throw new Error('认证失败');
        }
        const errorData = await response.json();
        throw new Error(errorData.message || '加入房间失败');
      }
    } catch (error) {
      console.error('加入房间失败:', error);
      throw error;
    }
  };

  const fetchRoomInfo = async (): Promise<RoomInfo | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/rooms/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRoom(data.data);
        setError(null);
        return data.data;
      } else {
        if (response.status === 401 || response.status === 403) {
          handleApiError(response.status);
          throw new Error('认证失败');
        }
        if (response.status === 404) {
          setError('房间不存在');
          throw new Error('房间不存在');
        } else {
          setError('获取房间信息失败');
          throw new Error('获取房间信息失败');
        }
      }
    } catch (error) {
      console.error('获取房间信息失败:', error);
      if (!error.message?.includes('认证失败') && !error.message?.includes('房间不存在')) {
        setError('网络连接失败');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!roomId || !user) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        navigate('/');
      } else {
        if (response.status === 401 || response.status === 403) {
          handleApiError(response.status);
          return;
        }
        alert('离开房间失败');
      }
    } catch (error) {
      console.error('离开房间失败:', error);
      alert('网络连接失败');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return '等待中';
      case 'playing': return '游戏中';
      case 'finished': return '已结束';
      default: return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-green-600 bg-green-100';
      case 'playing': return 'text-blue-600 bg-blue-100';
      case 'finished': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleCopyRoomId = async () => {
    if (!room?.id) return;
    
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      // 降级方案：创建临时输入框
      const textArea = document.createElement('textarea');
      textArea.value = room.id;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载房间信息...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{error}</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-indigo-100">
      {/* 顶部导航 */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-600 hover:text-purple-600 transition-colors mr-4"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-800">{room.name}</h1>
              <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                {getStatusText(room.status)}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">欢迎, {user?.username}</span>
              <button
                onClick={handleLeaveRoom}
                className="p-2 text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 主要内容区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 房间信息卡片 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">房间信息</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-2">
                    <p className="text-gray-600 mr-2"><strong>房间ID:</strong> {room.id}</p>
                    <button
                      onClick={handleCopyRoomId}
                      className="p-1 text-gray-500 hover:text-purple-600 transition-colors rounded"
                      title="复制房间ID"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    {copied && (
                      <span className="text-sm text-green-600 ml-1">已复制!</span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-2"><strong>房间名称:</strong> {room.name}</p>
                  <p className="text-gray-600 mb-2"><strong>房间描述:</strong> {room.description || '暂无描述'}</p>
                  <p className="text-gray-600 mb-2"><strong>房主:</strong> {room.creator_nickname || room.creator_username}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-2"><strong>人数:</strong> {room.current_players}/{room.max_players}</p>
                  <p className="text-gray-600 mb-2"><strong>房间类型:</strong> {room.is_private ? '私密房间' : '公开房间'}</p>
                  <p className="text-gray-600 mb-2"><strong>创建时间:</strong> {new Date(room.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 功能区域 */}
            <div className="grid md:grid-cols-3 gap-4">
              <button 
                onClick={() => setIsVideoCallEnabled(!isVideoCallEnabled)}
                className={`rounded-2xl p-6 transition-all duration-200 transform hover:scale-105 shadow-lg text-white ${
                  isVideoCallEnabled 
                    ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700' 
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                }`}
              >
                <Video className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">{isVideoCallEnabled ? '结束通话' : '视频通话'}</p>
              </button>
              
              <button 
                onClick={() => setShowGameSelector(!showGameSelector)}
                className={`rounded-2xl p-6 transition-all duration-200 transform hover:scale-105 shadow-lg text-white ${
                  showGameSelector || currentGame
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
                }`}
              >
                <Gamepad2 className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">{currentGame ? '游戏中' : '小游戏'}</p>
              </button>
              
              <button 
                onClick={() => {
                  if (showWatchTogether) {
                    // 如果已经在观看，直接打开
                    setIsWatchTogetherMinimized(false);
                  } else {
                    // 发送一起看视频邀请
                    if (socket && room) {
                      socket.emit('watch-together-invitation', {
                        roomId,
                        from: user?.id,
                        fromName: user?.username
                      });
                    }
                    // 同时为自己打开
                    setShowWatchTogether(true);
                    setIsWatchTogetherMinimized(false);
                  }
                }}
                className={`rounded-2xl p-6 transition-all duration-200 transform hover:scale-105 shadow-lg text-white ${
                  showWatchTogether
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
                    : 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700'
                }`}
              >
                <Video className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">一起看视频</p>
              </button>
            </div>
          </div>

          {/* 侧边栏 - 成员列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                房间成员 ({room.members?.length || 0})
                {isConnected && (
                  <span className="ml-2 w-2 h-2 bg-green-500 rounded-full" title="实时连接已建立"></span>
                )}
              </h3>
              
              <div className="space-y-3">
                {room.members && room.members.length > 0 ? (
                  room.members.map((member) => (
                    <div key={member.id} className="flex items-center p-3 bg-white/50 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-purple-600 rounded-full flex items-center justify-center text-white font-medium mr-3">
                        {(member.nickname || member.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 flex items-center">
                          {member.nickname || member.username}
                          {member.user_id === room.creator_id && (
                            <Crown className="w-4 h-4 text-yellow-500 ml-1" />
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(member.joined_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">暂无成员</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 游戏选择器 */}
      {showGameSelector && !currentGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">选择游戏</h3>
              <button
                onClick={() => setShowGameSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <GameSelector
              isOpen={true}
              onClose={() => setShowGameSelector(false)}
              onSelectGame={(gameId) => {
                setShowGameSelector(false);
                
                // 发送游戏邀请给房间内其他成员
                if (socket && room) {
                  socket.emit('game-invitation', {
                    roomId,
                    gameId,
                    from: user?.id,
                    fromName: user?.username,
                    gameName: getGameName(gameId)
                  });
                }
              }}
              currentPlayers={room?.members?.length || 0}
            />
          </div>
        </div>
      )}

      {/* 游戏界面 */}
      {currentGame && gameState && (
        <GameInterface
          gameId={currentGame}
          isOpen={true}
          onClose={() => {
            setCurrentGame(null);
            setGameState(null);
          }}
          socket={socket}
          roomId={roomId!}
          currentUser={user}
          roomMembers={room?.members || []}
        />
      )}
      
      {/* 一起看视频 */}
      {showWatchTogether && (
        <WatchTogether
           socket={socket}
           roomId={roomId!}
           currentUser={user}
           isMinimized={isWatchTogetherMinimized}
           onMinimize={() => setIsWatchTogetherMinimized(!isWatchTogetherMinimized)}
           onClose={() => {
             setShowWatchTogether(false);
             setIsWatchTogetherMinimized(false);
           }}
         />
      )}

      {/* 视频通话组件 - 始终渲染以接收通话请求 */}
      {room && user && (
        <VideoCall
          socket={socket}
          roomId={roomId!}
          currentUser={user}
          otherMembers={room.members
            .filter(m => m.user_id !== user.id)
            .map(m => ({ 
              id: m.user_id, 
              username: m.nickname || m.username 
            }))}
          onClose={() => {
            setIsVideoCallEnabled(false);
            setIsVideoCallMinimized(false);
          }}
          onMinimize={() => setIsVideoCallMinimized(true)}
          onRestore={() => setIsVideoCallMinimized(false)}
          isMinimized={isVideoCallMinimized}
          shouldStartCall={isVideoCallEnabled}
        />
      )}

      {/* 游戏邀请弹窗 */}
      {gameInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">游戏邀请</h3>
            <p className="text-gray-600 mb-6">
              <span className="font-medium text-blue-600">{gameInvitation.fromName}</span> 
              邀请你一起玩 <span className="font-medium text-green-600">{gameInvitation.gameName}</span>
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // 接受邀请，直接启动游戏
                  setCurrentGame(gameInvitation.gameId);
                  setGameState({ status: 'playing', players: [user?.id, gameInvitation.from] });
                  setGameInvitation(null);
                  
                  // 通知发起者
                  if (socket) {
                    socket.emit('game-invitation-response', {
                      roomId,
                      from: gameInvitation.from,
                      to: user?.id,
                      gameId: gameInvitation.gameId,
                      accepted: true
                    });
                  }
                }}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              >
                接受
              </button>
              <button
                onClick={() => {
                  // 拒绝邀请
                  setGameInvitation(null);
                  
                  // 通知发起者
                  if (socket) {
                    socket.emit('game-invitation-response', {
                      roomId,
                      from: gameInvitation.from,
                      to: user?.id,
                      gameId: gameInvitation.gameId,
                      accepted: false
                    });
                  }
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一起看视频邀请弹窗 */}
      {videoInvitation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">一起看视频邀请</h3>
            <p className="text-gray-600 mb-6">
              <span className="font-medium text-blue-600">{videoInvitation.fromName}</span> 
              邀请你一起看视频
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // 接受邀请
                  setShowWatchTogether(true);
                  setIsWatchTogetherMinimized(false);
                  setVideoInvitation(null);
                  
                  // 通知发起者
                  if (socket) {
                    socket.emit('watch-together-invitation-response', {
                      roomId,
                      from: videoInvitation.from,
                      to: user?.id,
                      accepted: true
                    });
                  }
                }}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              >
                接受
              </button>
              <button
                onClick={() => {
                  // 拒绝邀请
                  setVideoInvitation(null);
                  
                  // 通知发起者
                  if (socket) {
                    socket.emit('watch-together-invitation-response', {
                      roomId,
                      from: videoInvitation.from,
                      to: user?.id,
                      accepted: false
                    });
                  }
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Room;