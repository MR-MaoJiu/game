import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Send, MessageCircle, X, SkipBack, SkipForward, Video, Plus, Trash2, List } from 'lucide-react';

interface WatchTogetherProps {
  socket: any;
  roomId: string;
  currentUser: any;
  isMinimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

interface VideoState {
  url: string;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  duration: number;
}

interface DanmakuMessage {
  id: string;
  text: string;
  user: string;
  timestamp: number;
  color: string;
  position: number;
}

interface ChatMessage {
  id: string;
  text: string;
  user: string;
  username: string;
  timestamp: number;
}

interface VideoItem {
  id: string;
  title: string;
  url: string;
  duration?: number;
  addedBy: string;
  addedAt: number;
}

const WatchTogether: React.FC<WatchTogetherProps> = ({
  socket,
  roomId,
  currentUser,
  isMinimized,
  onMinimize,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState<VideoState>({
    url: '',
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
    duration: 0
  });
  
  const [videoUrl, setVideoUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [danmakuMessages, setDanmakuMessages] = useState<DanmakuMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [danmakuInput, setDanmakuInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoPlaylist, setVideoPlaylist] = useState<VideoItem[]>([]);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('video-sync', (data: any) => {
      setIsSyncing(true);
      
      if (data.action === 'update-playlist') {
        setVideoPlaylist(data.playlist || []);
      } else {
        setVideoState(prev => ({
          ...prev,
          url: data.url,
          currentTime: data.currentTime,
          isPlaying: data.isPlaying
        }));
        
        if (videoRef.current) {
          videoRef.current.currentTime = data.currentTime;
          if (data.isPlaying) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
      }
      
      setTimeout(() => setIsSyncing(false), 1000);
    });

    socket.on('danmaku-message', (data: DanmakuMessage) => {
      setDanmakuMessages(prev => [...prev, data]);
      // 5秒后移除弹幕
      setTimeout(() => {
        setDanmakuMessages(prev => prev.filter(msg => msg.id !== data.id));
      }, 5000);
    });

    socket.on('chat-message', (data: ChatMessage) => {
      setChatMessages(prev => [...prev, data]);
    });

    return () => {
      socket.off('video-sync');
      socket.off('danmaku-message');
      socket.off('chat-message');
    };
  }, [socket]);

  const syncVideo = (action: string, data: any) => {
    if (socket) {
      socket.emit('video-sync', {
        roomId,
        action,
        ...data,
        timestamp: Date.now()
      });
    }
  };

  const handlePlayPause = () => {
    const newIsPlaying = !videoState.isPlaying;
    setVideoState(prev => ({ ...prev, isPlaying: newIsPlaying }));
    
    if (videoRef.current) {
      if (newIsPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
    
    syncVideo('play-pause', {
      isPlaying: newIsPlaying,
      currentTime: videoRef.current?.currentTime || 0
    });
  };

  const handleSeek = (time: number) => {
    setVideoState(prev => ({ ...prev, currentTime: time }));
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    
    syncVideo('seek', {
      currentTime: time,
      isPlaying: videoState.isPlaying
    });
  };

  const handleVolumeChange = (volume: number) => {
    setVideoState(prev => ({ ...prev, volume, isMuted: volume === 0 }));
    
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = volume === 0;
    }
  };

  const handleLoadVideo = () => {
    if (!videoUrl.trim()) return;
    
    const videoItem: VideoItem = {
      id: Date.now().toString(),
      title: newVideoTitle || videoUrl,
      url: videoUrl,
      addedBy: currentUser.username,
      addedAt: Date.now()
    };

    // 添加到播放列表
    const newPlaylist = [...videoPlaylist, videoItem];
    setVideoPlaylist(newPlaylist);
    
    // 同步播放列表
    syncVideo('update-playlist', { playlist: newPlaylist });
    
    // 如果当前没有播放视频，自动播放新添加的视频
    if (!videoState.url) {
      loadVideoFromPlaylist(videoItem);
    }
    
    setShowUrlInput(false);
    setVideoUrl('');
    setNewVideoTitle('');
  };

  const loadVideoFromPlaylist = (videoItem: VideoItem) => {
    setVideoState(prev => ({
      ...prev,
      url: videoItem.url,
      currentTime: 0,
      isPlaying: false
    }));
    
    syncVideo('load-video', {
      url: videoItem.url,
      currentTime: 0,
      isPlaying: false,
      videoTitle: videoItem.title
    });
  };

  const removeFromPlaylist = (videoId: string) => {
    const newPlaylist = videoPlaylist.filter(item => item.id !== videoId);
    setVideoPlaylist(newPlaylist);
    syncVideo('update-playlist', { playlist: newPlaylist });
  };

  const sendDanmaku = () => {
    if (!danmakuInput.trim() || !socket) return;
    
    const danmaku: DanmakuMessage = {
      id: Date.now().toString(),
      text: danmakuInput,
      user: currentUser.username,
      timestamp: Date.now(),
      color: '#ffffff',
      position: Math.random() * 80 + 10 // 10-90% 的位置
    };
    
    socket.emit('danmaku-message', {
      roomId,
      ...danmaku
    });
    
    setDanmakuInput('');
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socket) return;
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput,
      user: currentUser.id,
      username: currentUser.username,
      timestamp: Date.now()
    };
    
    socket.emit('chat-message', {
      roomId,
      ...message
    });
    
    setChatInput('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-black rounded-lg overflow-hidden shadow-2xl w-64 h-36">
          <div className="relative h-full">
            {videoState.url && (
              <video
                ref={videoRef}
                src={videoState.url}
                className="w-full h-full object-cover"
                muted
              />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <button
                onClick={onMinimize}
                className="text-white hover:text-blue-400 transition-colors"
              >
                <Maximize className="w-6 h-6" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-white hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-40 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">一起看视频</h3>
          {isSyncing && (
            <span className="text-yellow-400 text-sm">同步中...</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            添加视频
          </button>
          
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
          >
            <List className="w-4 h-4 mr-1 inline" />
            播放列表 ({videoPlaylist.length})
          </button>
          
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded transition-colors ${
              showChat ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          
          <button
            onClick={onMinimize}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <Minimize className="w-5 h-5" />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* URL 输入框 */}
      {showUrlInput && (
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <div className="space-y-2">
            <input
              type="text"
              value={newVideoTitle}
              onChange={(e) => setNewVideoTitle(e.target.value)}
              placeholder="视频标题 (可选)"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex space-x-2">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="输入视频URL (支持 mp4, webm 等格式)"
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && handleLoadVideo()}
              />
              <button
                onClick={handleLoadVideo}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                加载
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 播放列表 */}
      {showPlaylist && (
        <div className="bg-gray-800 border-b border-gray-700 max-h-60 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-white font-semibold mb-3">播放列表</h3>
            {videoPlaylist.length === 0 ? (
              <p className="text-gray-400 text-center py-4">播放列表为空</p>
            ) : (
              <div className="space-y-2">
                {videoPlaylist.map((video) => (
                  <div 
                    key={video.id} 
                    className={`flex items-center justify-between p-3 rounded border transition-colors ${
                      videoState.url === video.url 
                        ? 'bg-blue-600 border-blue-500' 
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{video.title}</h4>
                      <p className="text-gray-300 text-sm">添加者: {video.addedBy}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      {videoState.url !== video.url && (
                        <button
                          onClick={() => loadVideoFromPlaylist(video)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                        >
                          播放
                        </button>
                      )}
                      <button
                        onClick={() => removeFromPlaylist(video.id)}
                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* 视频播放区域 */}
        <div className="flex-1 relative">
          {videoState.url ? (
            <>
              <video
                ref={videoRef}
                src={videoState.url}
                className="w-full h-full object-contain"
                onTimeUpdate={(e) => {
                  const currentTime = (e.target as HTMLVideoElement).currentTime;
                  setVideoState(prev => ({ ...prev, currentTime }));
                }}
                onLoadedMetadata={(e) => {
                  const duration = (e.target as HTMLVideoElement).duration;
                  setVideoState(prev => ({ ...prev, duration }));
                }}
                onPlay={() => setVideoState(prev => ({ ...prev, isPlaying: true }))}
                onPause={() => setVideoState(prev => ({ ...prev, isPlaying: false }))}
              />
              
              {/* 弹幕层 */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {danmakuMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="absolute text-white text-lg font-bold animate-pulse"
                    style={{
                      top: `${msg.position}%`,
                      right: '100%',
                      transform: 'translateX(0)',
                      animation: 'none',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      color: msg.color
                    }}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
              
              {/* 视频控制栏 */}
              {showControls && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                  {/* 进度条 */}
                  <div className="mb-4">
                    <input
                      type="range"
                      min={0}
                      max={videoState.duration || 0}
                      value={videoState.currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-300 mt-1">
                      <span>{formatTime(videoState.currentTime)}</span>
                      <span>{formatTime(videoState.duration)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleSeek(Math.max(0, videoState.currentTime - 10))}
                        className="text-white hover:text-blue-400 transition-colors"
                      >
                        <SkipBack className="w-6 h-6" />
                      </button>
                      
                      <button
                        onClick={handlePlayPause}
                        className="text-white hover:text-blue-400 transition-colors"
                      >
                        {videoState.isPlaying ? (
                          <Pause className="w-8 h-8" />
                        ) : (
                          <Play className="w-8 h-8" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleSeek(Math.min(videoState.duration, videoState.currentTime + 10))}
                        className="text-white hover:text-blue-400 transition-colors"
                      >
                        <SkipForward className="w-6 h-6" />
                      </button>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleVolumeChange(videoState.isMuted ? 1 : 0)}
                          className="text-white hover:text-blue-400 transition-colors"
                        >
                          {videoState.isMuted ? (
                            <VolumeX className="w-6 h-6" />
                          ) : (
                            <Volume2 className="w-6 h-6" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.1}
                          value={videoState.volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={toggleFullscreen}
                      className="text-white hover:text-blue-400 transition-colors"
                    >
                      <Maximize className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* 弹幕输入 */}
              <div className="absolute bottom-20 left-4 right-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={danmakuInput}
                    onChange={(e) => setDanmakuInput(e.target.value)}
                    placeholder="发送弹幕..."
                    className="flex-1 px-3 py-2 bg-black bg-opacity-50 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && sendDanmaku()}
                  />
                  <button
                    onClick={sendDanmaku}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <Video className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-xl mb-2">还没有加载视频</p>
                <p className="text-gray-400">点击"添加视频"开始观看</p>
              </div>
            </div>
          )}
        </div>

        {/* 聊天侧边栏 */}
        {showChat && (
          <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-white font-semibold">聊天室</h4>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-white">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-blue-400">{msg.username}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{msg.text}</p>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="输入消息..."
                  className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <button
                  onClick={sendChatMessage}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchTogether;