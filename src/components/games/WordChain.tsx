import React, { useState, useEffect } from 'react';
import { Send, Clock, Trophy, AlertCircle } from 'lucide-react';

interface WordChainProps {
  socket: any;
  roomId: string;
  currentUser: any;
  gameState: any;
  setGameState: (state: any) => void;
}

interface WordEntry {
  id: string;
  word: string;
  player: string;
  playerName: string;
  timestamp: number;
  isValid: boolean;
}

interface WordChainState {
  words: WordEntry[];
  currentPlayer: string;
  timeLeft: number;
  roundTimeLimit: number;
  scores: Record<string, number>;
  gameStatus: 'playing' | 'paused' | 'ended';
  lastCharacter: string;
  usedWords: Set<string>;
  eliminatedPlayers: string[];
}

const WordChain: React.FC<WordChainProps> = ({
  socket,
  roomId,
  currentUser,
  gameState,
  setGameState
}) => {
  const [wordChainState, setWordChainState] = useState<WordChainState>({
    words: [],
    currentPlayer: '',
    timeLeft: 30,
    roundTimeLimit: 30,
    scores: {},
    gameStatus: 'playing',
    lastCharacter: '',
    usedWords: new Set(),
    eliminatedPlayers: []
  });

  const [inputWord, setInputWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!socket) return;

    socket.on('word-chain-update', (data: any) => {
      setWordChainState(prev => ({
        ...prev,
        words: data.words,
        currentPlayer: data.currentPlayer,
        lastCharacter: data.lastCharacter,
        usedWords: new Set(data.usedWords),
        scores: data.scores
      }));
      setInputWord('');
      setErrorMessage('');
      setIsSubmitting(false);
    });

    socket.on('word-chain-timer', (data: any) => {
      setWordChainState(prev => ({
        ...prev,
        timeLeft: data.timeLeft
      }));
    });

    socket.on('word-chain-error', (data: any) => {
      setErrorMessage(data.message);
      setIsSubmitting(false);
    });

    socket.on('word-chain-elimination', (data: any) => {
      setWordChainState(prev => ({
        ...prev,
        eliminatedPlayers: data.eliminatedPlayers,
        currentPlayer: data.nextPlayer
      }));
    });

    socket.on('word-chain-end', (data: any) => {
      setWordChainState(prev => ({
        ...prev,
        gameStatus: 'ended',
        scores: data.finalScores
      }));
    });

    return () => {
      socket.off('word-chain-update');
      socket.off('word-chain-timer');
      socket.off('word-chain-error');
      socket.off('word-chain-elimination');
      socket.off('word-chain-end');
    };
  }, [socket]);

  const submitWord = () => {
    if (!inputWord.trim() || isSubmitting || wordChainState.currentPlayer !== currentUser.id) {
      return;
    }

    const word = inputWord.trim();
    
    // 基本验证
    if (word.length < 2) {
      setErrorMessage('成语至少需要2个字');
      return;
    }

    if (wordChainState.usedWords.has(word)) {
      setErrorMessage('这个成语已经被使用过了');
      return;
    }

    if (wordChainState.lastCharacter && !word.startsWith(wordChainState.lastCharacter)) {
      setErrorMessage(`成语必须以"${wordChainState.lastCharacter}"开头`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    socket.emit('game-action', {
      roomId,
      gameId: 'word-chain',
      action: 'submit-word',
      data: {
        word,
        userId: currentUser.id
      }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitWord();
    }
  };

  const getCurrentPlayerName = () => {
    const player = gameState.players.find((p: any) => p.id === wordChainState.currentPlayer);
    return player ? player.name : '';
  };

  const isMyTurn = wordChainState.currentPlayer === currentUser.id;
  const isEliminated = wordChainState.eliminatedPlayers.includes(currentUser.id);
  const activePlayers = gameState.players.filter((p: any) => 
    !wordChainState.eliminatedPlayers.includes(p.id)
  );

  if (wordChainState.gameStatus === 'ended') {
    const sortedScores = Object.entries(wordChainState.scores).sort(([,a], [,b]) => b - a);
    const winner = sortedScores[0];
    
    return (
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-green-600 mb-2">
            🎉 游戏结束！
          </h3>
          {winner && (
            <p className="text-lg">
              获胜者: {gameState.players.find((p: any) => p.id === winner[0])?.name}
            </p>
          )}
        </div>

        <div className="w-full max-w-md space-y-3">
          <h4 className="text-lg font-semibold text-center">最终排名</h4>
          {sortedScores.map(([playerId, score], index) => {
            const player = gameState.players.find((p: any) => p.id === playerId);
            if (!player) return null;
            
            return (
              <div key={playerId} className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0 ? 'bg-yellow-50 border border-yellow-300' : 'bg-gray-50'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <span className="font-medium">{player.name}</span>
                </div>
                <span className="text-xl font-bold text-blue-600">{score}</span>
              </div>
            );
          })}
        </div>

        <div className="w-full max-w-md bg-blue-50 rounded-xl p-4">
          <h4 className="font-semibold mb-2 text-center">游戏统计</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>总共接龙: {wordChainState.words.length} 个成语</p>
            <p>参与玩家: {gameState.players.length} 人</p>
            <p>游戏时长: {Math.floor((Date.now() - (wordChainState.words[0]?.timestamp || Date.now())) / 60000)} 分钟</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* 游戏状态 */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-4 mb-4">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
            isMyTurn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-medium">
              {isMyTurn ? '轮到你了！' : `${getCurrentPlayerName()}的回合`}
            </span>
          </div>
          
          <div className={`text-2xl font-bold px-3 py-1 rounded-full ${
            wordChainState.timeLeft <= 5 ? 'text-red-500 bg-red-100 animate-pulse' : 'text-blue-600 bg-blue-100'
          }`}>
            {wordChainState.timeLeft}s
          </div>
        </div>

        {wordChainState.lastCharacter && (
          <div className="text-lg">
            <span className="text-gray-600">下一个成语需要以</span>
            <span className="mx-2 text-2xl font-bold text-red-600 bg-red-100 px-3 py-1 rounded-lg">
              {wordChainState.lastCharacter}
            </span>
            <span className="text-gray-600">开头</span>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      {!isEliminated && (
        <div className="w-full max-w-md mx-auto">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isMyTurn ? '输入成语...' : '等待其他玩家...'}
              disabled={!isMyTurn || isSubmitting}
              className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors ${
                isMyTurn 
                  ? 'border-blue-300 focus:border-blue-500' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            />
            <button
              onClick={submitWord}
              disabled={!isMyTurn || !inputWord.trim() || isSubmitting}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                isMyTurn && inputWord.trim() && !isSubmitting
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {errorMessage && (
            <div className="flex items-center space-x-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {isEliminated && (
        <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-medium">你已被淘汰，继续观战吧！</p>
        </div>
      )}

      {/* 成语链 */}
      <div className="w-full max-w-2xl mx-auto">
        <h4 className="text-lg font-semibold mb-3 text-center">成语接龙</h4>
        <div className="bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
          {wordChainState.words.length === 0 ? (
            <p className="text-center text-gray-500">等待第一个成语...</p>
          ) : (
            <div className="space-y-2">
              {wordChainState.words.map((entry, index) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500 font-mono">
                      {index + 1}.
                    </span>
                    <span className={`text-lg font-bold ${
                      entry.isValid ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {entry.word}
                    </span>
                    {!entry.isValid && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                        无效
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    {entry.playerName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 玩家状态 */}
      <div className="w-full max-w-md mx-auto">
        <h4 className="text-lg font-semibold mb-3 text-center">玩家状态</h4>
        <div className="space-y-2">
          {gameState.players.map((player: any) => {
            const isActive = !wordChainState.eliminatedPlayers.includes(player.id);
            const isCurrent = wordChainState.currentPlayer === player.id;
            const score = wordChainState.scores[player.id] || 0;
            
            return (
              <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg ${
                isCurrent ? 'bg-blue-50 border border-blue-300' :
                isActive ? 'bg-white border border-gray-200' :
                'bg-red-50 border border-red-200 opacity-60'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full ${
                    isActive ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="font-medium">{player.name}</span>
                  {isCurrent && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                      当前
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                      淘汰
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold">{score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 游戏说明 */}
      <div className="text-center text-sm text-gray-500 max-w-md mx-auto">
        <p>用成语接龙，后一个成语的第一个字要与前一个成语的最后一个字相同。超时或重复使用成语将被淘汰！</p>
      </div>
    </div>
  );
};

export default WordChain;