import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Video, Mic, X, PhoneCall, PhoneIncoming, PhoneOff, MicOff, VideoOff, Minimize2 } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Socket } from 'socket.io-client';

// --- Types ---
interface User {
    id: number;
    username: string;
}

interface VideoCallProps {
  socket: Socket | null;
  roomId: string;
  currentUser: User;
  otherMembers: User[];
  onClose: () => void;
  shouldStartCall?: boolean; // 外部触发通话
  onMinimize?: () => void; // 最小化回调
  onRestore?: () => void; // 还原回调
  isMinimized?: boolean; // 是否最小化
}

// --- Main Component ---
const VideoCall: React.FC<VideoCallProps> = ({ socket, roomId, currentUser, otherMembers, onClose, shouldStartCall, onMinimize, onRestore, isMinimized }) => {

  const { 
    callState, incomingCall, localStream, remoteStream, 
    call, answer, hangup, toggleAudio, toggleVideo,
    isAudioMuted, isVideoMuted 
  } = useWebRTC({ socket, roomId, userId: currentUser.id.toString() });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // 拖拽状态
  const [dragState, setDragState] = useState({ 
    isDragging: false, 
    startX: 0, 
    startY: 0, 
    initialX: 16, // 初始right: 16px
    initialY: 16  // 初始bottom: 16px
  });
  const [position, setPosition] = useState({ right: 16, bottom: 16 });

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log('[VideoCall] Setting local stream to video element:', localStream);
      localVideoRef.current.srcObject = localStream;
      // 确保video元素开始播放
      localVideoRef.current.play().catch(e => console.log('Local video play failed:', e));
    }
  }, [localStream, isMinimized]); // 添加isMinimized依赖以在状态切换时重新绑定

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('[VideoCall] Setting remote stream to video element:', remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
      // 确保video元素开始播放
      remoteVideoRef.current.play().catch(e => console.log('Remote video play failed:', e));
    }
  }, [remoteStream, isMinimized]); // 添加isMinimized依赖以在状态切换时重新绑定

  const otherUser = otherMembers.length > 0 ? otherMembers[0] : null;

  const handleCall = useCallback(() => {
    if (otherUser) {
      call(otherUser.id.toString());
    }
  }, [otherUser, call]);

  // 拖拽事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMinimized && callState === 'connected') {
      setDragState({
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        initialX: position.right,
        initialY: position.bottom
      });
    }
  }, [isMinimized, callState, position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState.isDragging) {
      const deltaX = dragState.startX - e.clientX; // 向左移动为正
      const deltaY = e.clientY - dragState.startY; // 向下移动为正
      
      const newRight = Math.max(0, Math.min(window.innerWidth - 320, dragState.initialX + deltaX));
      const newBottom = Math.max(0, Math.min(window.innerHeight - 240, dragState.initialY + deltaY));
      
      setPosition({ right: newRight, bottom: newBottom });
    }
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  }, []);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // 响应外部触发的通话请求
  useEffect(() => {
    if (shouldStartCall && otherMembers.length > 0 && callState === 'idle') {
      console.log('[VideoCall] External call trigger detected, starting call');
      handleCall();
    }
  }, [shouldStartCall, otherMembers, callState, handleCall]);

  // --- Render Logic ---
  // idle状态时渲染一个不可见的容器以保持hook活跃，但不阻挡其他UI交互
  if (callState === 'idle' && !incomingCall) {
    return <div className="hidden" />; // 完全隐藏，不占用空间，不阻挡点击
  }

  const renderContent = () => {
    switch (callState) {
      case 'receiving':
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gray-800 text-white">
            <h3 className="text-2xl font-bold mb-2">Incoming Call</h3>
            <p className="mb-6">from {incomingCall?.from}</p>
            <div className="flex justify-center space-x-6 mt-4">
              <button onClick={answer} className="p-4 bg-green-500 rounded-full hover:bg-green-600 transition-transform transform hover:scale-110">
                <PhoneIncoming size={32} />
              </button>
              <button onClick={hangup} className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition-transform transform hover:scale-110">
                <PhoneOff size={32} />
              </button>
            </div>
          </div>
        );

      case 'requesting':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-xl">Calling {otherUser?.username || 'user'}...</p>
            <div className="animate-pulse mt-4">
                <PhoneCall size={48} className="text-gray-400"/>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-xl text-red-500">Call Rejected</p>
          </div>
        );

      case 'connected':
        return (
          <div className="relative h-full w-full bg-black">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-contain"
              onLoadedMetadata={(e) => {
                console.log('[VideoCall] Remote video metadata loaded');
                e.currentTarget.play().catch(console.error);
              }}
              onCanPlay={(e) => {
                console.log('[VideoCall] Remote video can play');
                e.currentTarget.play().catch(console.error);
              }}
              style={{ backgroundColor: remoteStream ? 'transparent' : '#1f2937' }}
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
                等待对方视频...
              </div>
            )}
            {localStream && (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="absolute bottom-20 right-4 w-48 h-36 object-cover border-2 border-white rounded-lg shadow-lg"
                  onLoadedMetadata={(e) => {
                    // 确保本地视频元素正确播放
                    e.currentTarget.play().catch(console.error);
                  }}
                />
            )}

          </div>
        );

      default: // 'idle'
        return (
          <div className="flex flex-col items-center justify-center h-full">
            {otherUser ? (
              <>
                <p className="text-xl">Start a video call with {otherUser.username}</p>
                <button onClick={handleCall} className="mt-6 p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform transform hover:scale-110">
                  <PhoneCall size={32} />
                </button>
              </>
            ) : (
              <p className="text-xl text-gray-500">Waiting for another user to join...</p>
            )}
          </div>
        );
    }
  };

  const renderControls = () => {
    if (callState !== 'connected') return null;
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-4 flex justify-center space-x-4 z-20">
        <button 
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors hover:scale-110 ${!isVideoMuted ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-red-500 text-white hover:bg-red-400'}`}
          title={isVideoMuted ? "开启摄像头" : "关闭摄像头"}
        >
          {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
        </button>
        <button 
          onClick={toggleAudio}
          className={`p-3 rounded-full transition-colors hover:scale-110 ${!isAudioMuted ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-red-500 text-white hover:bg-red-400'}`}
          title={isAudioMuted ? "取消静音" : "静音"}
        >
          {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        <button 
          onClick={hangup} 
          className="p-3 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors hover:scale-110"
          title="挂断"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    );
  };

  // 最小化状态渲染
  if (isMinimized && callState === 'connected') {
    return (
      <div 
        className="fixed z-50 select-none" 
        style={{ 
          right: `${position.right}px`, 
          bottom: `${position.bottom}px`,
          cursor: dragState.isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl border-2 border-gray-200 w-80 h-60 flex flex-col overflow-hidden"
          onMouseDown={handleMouseDown}
        >
          <div className="flex justify-between items-center p-2 border-b bg-gray-50">
            <h3 className="text-sm font-bold">视频通话</h3>
            <div className="flex items-center space-x-1">
              <button 
                onClick={onRestore} 
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                title="还原"
              >
                <Video size={16} />
              </button>
              <button 
                onClick={onClose} 
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                title="关闭"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-grow relative bg-black">
            {localStream && (
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
                onLoadedMetadata={(e) => {
                  // 确保视频元素正确播放
                  e.currentTarget.play().catch(console.error);
                }}
              />
            )}
            <div className="absolute bottom-2 left-2 right-2 flex justify-center space-x-2">
              <button 
                onClick={toggleAudio}
                className={`p-2 rounded-full transition-colors ${!isAudioMuted ? 'bg-gray-600 text-white' : 'bg-red-500 text-white'}`}
                title={isAudioMuted ? "取消静音" : "静音"}
              >
                {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button 
                onClick={hangup} 
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors"
                title="挂断"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onMouseDown={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[75vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-3 border-b bg-gray-50">
          <h2 className="text-lg font-bold">视频通话</h2>
          <div className="flex items-center space-x-2">
            {onMinimize && callState === 'connected' && (
              <button 
                onClick={onMinimize} 
                className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                title="最小化"
              >
                <Minimize2 size={18} />
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              title="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-grow relative bg-gray-100">
          {renderContent()}
          {renderControls()}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;