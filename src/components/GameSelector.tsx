import React, { useState } from 'react';
import { Gamepad2, Users, Target, Zap, Heart, X } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  minPlayers: number;
  maxPlayers: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface GameSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGame: (gameId: string) => void;
  currentPlayers: number;
}

const games: Game[] = [
  {
    id: 'tic-tac-toe',
    name: '井字棋',
    description: '经典的三连棋游戏，简单易上手',
    icon: <Target className="w-8 h-8" />,
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: 'easy'
  },
  {
    id: 'rock-paper-scissors',
    name: '石头剪刀布',
    description: '经典猜拳游戏，考验运气和心理战',
    icon: <Zap className="w-8 h-8" />,
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: 'easy'
  },
  {
    id: 'love-quiz',
    name: '情侣问答',
    description: '测试彼此了解程度的趣味问答',
    icon: <Heart className="w-8 h-8" />,
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: 'medium'
  },
  {
    id: 'word-chain',
    name: '成语接龙',
    description: '考验词汇量和反应速度的文字游戏',
    icon: <Users className="w-8 h-8" />,
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: 'medium'
  }
];

const GameSelector: React.FC<GameSelectorProps> = ({
  isOpen,
  onClose,
  onSelectGame,
  currentPlayers
}) => {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  if (!isOpen) return null;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return '未知';
    }
  };

  const canPlayGame = (game: Game) => {
    return currentPlayers >= game.minPlayers && currentPlayers <= game.maxPlayers;
  };

  const handleStartGame = () => {
    if (selectedGame) {
      onSelectGame(selectedGame);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center space-x-3">
            <Gamepad2 className="w-8 h-8 text-purple-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">选择游戏</h2>
              <p className="text-sm text-gray-600">当前房间人数: {currentPlayers}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* 游戏列表 */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game) => {
              const playable = canPlayGame(game);
              const isSelected = selectedGame === game.id;
              
              return (
                <div
                  key={game.id}
                  onClick={() => playable && setSelectedGame(game.id)}
                  className={`p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    !playable
                      ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'border-purple-500 bg-purple-50 shadow-lg transform scale-105'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md hover:transform hover:scale-102'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg ${
                      !playable ? 'bg-gray-200 text-gray-400' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    }`}>
                      {game.icon}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold mb-2 ${
                        !playable ? 'text-gray-400' : 'text-gray-800'
                      }`}>
                        {game.name}
                      </h3>
                      
                      <p className={`text-sm mb-3 ${
                        !playable ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {game.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            !playable ? 'bg-gray-200 text-gray-400' : getDifficultyColor(game.difficulty)
                          }`}>
                            {getDifficultyText(game.difficulty)}
                          </span>
                          
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            !playable ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {game.minPlayers === game.maxPlayers 
                              ? `${game.minPlayers}人`
                              : `${game.minPlayers}-${game.maxPlayers}人`
                            }
                          </span>
                        </div>
                        
                        {!playable && (
                          <span className="text-xs text-red-500 font-medium">
                            人数不符
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          
          <button
            onClick={handleStartGame}
            disabled={!selectedGame}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              selectedGame
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            开始游戏
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameSelector;