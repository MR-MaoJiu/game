import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Trophy, Users } from 'lucide-react';
import TicTacToe from './games/TicTacToe';
import RockPaperScissors from './games/RockPaperScissors';
import LoveQuiz from './games/LoveQuiz';
import WordChain from './games/WordChain';

interface GameInterfaceProps {
  gameId: string;
  isOpen: boolean;
  onClose: () => void;
  socket: any;
  roomId: string;
  currentUser: any;
  roomMembers: any[];
}

interface GameState {
  status: 'waiting' | 'playing' | 'finished';
  players: string[];
  currentPlayer?: string;
  winner?: string;
  scores?: Record<string, number>;
}

const GameInterface: React.FC<GameInterfaceProps> = ({
  gameId,
  isOpen,
  onClose,
  socket,
  roomId,
  currentUser,
  roomMembers
}) => {
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    players: [],
    scores: {}
  });

  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!socket || !isOpen) return;

    // 监听游戏事件
    socket.on('game-started', (data: any) => {
      setGameState(prev => ({
        ...prev,
        status: 'playing',
        players: data.players,
        currentPlayer: data.currentPlayer
      }));
    });

    socket.on('game-action', (data: any) => {
      // 游戏动作处理将在具体游戏组件中实现
    });

    socket.on('game-ended', (data: any) => {
      setGameState(prev => ({
        ...prev,
        status: 'finished',
        winner: data.winner,
        scores: data.scores
      }));
    });

    // 加入游戏
    socket.emit('join-game', {
      roomId,
      gameId,
      userId: currentUser.id,
      userName: currentUser.name
    });

    return () => {
      socket.off('game-started');
      socket.off('game-action');
      socket.off('game-ended');
    };
  }, [socket, isOpen, gameId, roomId, currentUser]);

  if (!isOpen) return null;

  const getGameTitle = () => {
    switch (gameId) {
      case 'tic-tac-toe': return '井字棋';
      case 'rock-paper-scissors': return '石头剪刀布';
      case 'love-quiz': return '情侣问答';
      case 'word-chain': return '成语接龙';
      default: return '游戏';
    }
  };

  const handleRestart = () => {
    if (socket) {
      socket.emit('restart-game', { roomId, gameId });
    }
  };

  const handleLeaveGame = () => {
    if (socket) {
      socket.emit('leave-game', { roomId, gameId, userId: currentUser.id });
    }
    onClose();
  };

  const renderGameComponent = () => {
    const commonProps = {
      socket,
      roomId,
      currentUser,
      gameState,
      setGameState
    };

    switch (gameId) {
      case 'tic-tac-toe':
        return <TicTacToe {...commonProps} />;
      case 'rock-paper-scissors':
        return <RockPaperScissors {...commonProps} />;
      case 'love-quiz':
        return <LoveQuiz {...commonProps} />;
      case 'word-chain':
        return <WordChain {...commonProps} />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">游戏组件开发中...</p>
          </div>
        );
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4 ${
      isMinimized ? 'pointer-events-none' : ''
    }`}>
      <div className={`bg-white rounded-2xl shadow-2xl transition-all duration-300 ${
        isMinimized 
          ? 'w-80 h-20 fixed bottom-4 right-4 pointer-events-auto'
          : 'max-w-4xl w-full max-h-[90vh]'
      }`}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">{getGameTitle()}</h2>
              {!isMinimized && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>玩家: {gameState.players.length}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    gameState.status === 'waiting' ? 'bg-yellow-100 text-yellow-600' :
                    gameState.status === 'playing' ? 'bg-green-100 text-green-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {gameState.status === 'waiting' ? '等待中' :
                     gameState.status === 'playing' ? '游戏中' : '已结束'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isMinimized && gameState.status === 'finished' && (
              <button
                onClick={handleRestart}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                title="重新开始"
              >
                <RotateCcw className="w-5 h-5 text-gray-600" />
              </button>
            )}
            
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title={isMinimized ? '展开' : '最小化'}
            >
              <div className={`w-5 h-5 border-2 border-gray-600 rounded transition-transform ${
                isMinimized ? 'rotate-45' : ''
              }`} />
            </button>
            
            <button
              onClick={handleLeaveGame}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="退出游戏"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 游戏内容 */}
        {!isMinimized && (
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {gameState.status === 'waiting' ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="text-gray-600">等待其他玩家加入...</p>
                <div className="text-sm text-gray-500">
                  已加入玩家: {gameState.players.map(p => p).join(', ')}
                </div>
              </div>
            ) : (
              renderGameComponent()
            )}
          </div>
        )}

        {/* 游戏结果 */}
        {!isMinimized && gameState.status === 'finished' && (
          <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                🎉 游戏结束!
              </h3>
              {gameState.winner && (
                <p className="text-lg text-green-600 mb-4">
                  获胜者: {gameState.winner}
                </p>
              )}
              {gameState.scores && Object.keys(gameState.scores).length > 0 && (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="font-semibold mb-2">得分榜</h4>
                  {Object.entries(gameState.scores).map(([player, score]) => (
                    <div key={player} className="flex justify-between items-center py-1">
                      <span>{player}</span>
                      <span className="font-bold">{score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameInterface;