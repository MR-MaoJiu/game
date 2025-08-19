import React, { useState, useEffect } from 'react';
import { Hand, Scissors, FileText, RotateCcw } from 'lucide-react';

interface RockPaperScissorsProps {
  socket: any;
  roomId: string;
  currentUser: any;
  gameState: any;
  setGameState: (state: any) => void;
}

type Choice = 'rock' | 'paper' | 'scissors';

interface GameRound {
  roundNumber: number;
  choices: Record<string, Choice>;
  results: Record<string, 'win' | 'lose' | 'draw'>;
  roundWinner?: string;
}

interface RPSState {
  currentRound: number;
  maxRounds: number;
  playerChoices: Record<string, Choice | null>;
  scores: Record<string, number>;
  rounds: GameRound[];
  timeLeft: number;
  isRoundActive: boolean;
}

const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({
  socket,
  roomId,
  currentUser,
  gameState,
  setGameState
}) => {
  const [rpsState, setRpsState] = useState<RPSState>({
    currentRound: 1,
    maxRounds: 5,
    playerChoices: {},
    scores: {},
    rounds: [],
    timeLeft: 10,
    isRoundActive: true
  });

  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('rps-round-start', (data: any) => {
      setRpsState(prev => ({
        ...prev,
        currentRound: data.round,
        timeLeft: data.timeLeft,
        isRoundActive: true,
        playerChoices: {}
      }));
      setMyChoice(null);
      setShowResults(false);
    });

    socket.on('rps-choice-made', (data: any) => {
      setRpsState(prev => ({
        ...prev,
        playerChoices: data.choices
      }));
    });

    socket.on('rps-round-end', (data: any) => {
      setRpsState(prev => ({
        ...prev,
        rounds: [...prev.rounds, data.roundResult],
        scores: data.scores,
        isRoundActive: false
      }));
      setShowResults(true);
    });

    socket.on('rps-timer', (data: any) => {
      setRpsState(prev => ({
        ...prev,
        timeLeft: data.timeLeft
      }));
    });

    return () => {
      socket.off('rps-round-start');
      socket.off('rps-choice-made');
      socket.off('rps-round-end');
      socket.off('rps-timer');
    };
  }, [socket]);

  const makeChoice = (choice: Choice) => {
    if (!rpsState.isRoundActive || myChoice || rpsState.timeLeft <= 0) return;

    setMyChoice(choice);
    socket.emit('game-action', {
      roomId,
      gameId: 'rock-paper-scissors',
      action: 'choice',
      data: { choice, userId: currentUser.id }
    });
  };

  const getChoiceIcon = (choice: Choice | null) => {
    switch (choice) {
      case 'rock':
        return <Hand className="w-8 h-8" />;
      case 'paper':
        return <FileText className="w-8 h-8" />;
      case 'scissors':
        return <Scissors className="w-8 h-8" />;
      default:
        return <div className="w-8 h-8 border-2 border-dashed border-gray-400 rounded" />;
    }
  };

  const getChoiceEmoji = (choice: Choice | null) => {
    switch (choice) {
      case 'rock': return '🪨';
      case 'paper': return '📄';
      case 'scissors': return '✂️';
      default: return '❓';
    }
  };

  const getChoiceName = (choice: Choice | null) => {
    switch (choice) {
      case 'rock': return '石头';
      case 'paper': return '布';
      case 'scissors': return '剪刀';
      default: return '未选择';
    }
  };

  const getResultColor = (result: 'win' | 'lose' | 'draw') => {
    switch (result) {
      case 'win': return 'text-green-600 bg-green-100';
      case 'lose': return 'text-red-600 bg-red-100';
      case 'draw': return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getResultText = (result: 'win' | 'lose' | 'draw') => {
    switch (result) {
      case 'win': return '胜利';
      case 'lose': return '失败';
      case 'draw': return '平局';
    }
  };

  const currentRoundResult = rpsState.rounds[rpsState.currentRound - 1];
  const isGameFinished = rpsState.currentRound > rpsState.maxRounds;
  const winner = isGameFinished ? Object.entries(rpsState.scores).reduce((a, b) => 
    rpsState.scores[a[0]] > rpsState.scores[b[0]] ? a : b
  )[0] : null;

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* 游戏状态 */}
      <div className="text-center">
        {isGameFinished ? (
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-green-600">
              🎉 游戏结束!
            </h3>
            {winner && (
              <p className="text-lg">
                获胜者: {gameState.players.find((p: any) => p.id === winner)?.name}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-800">
              第 {rpsState.currentRound} / {rpsState.maxRounds} 轮
            </h3>
            {rpsState.isRoundActive && (
              <div className="flex items-center justify-center space-x-2">
                <div className={`text-2xl font-bold ${
                  rpsState.timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-blue-600'
                }`}>
                  {rpsState.timeLeft}s
                </div>
                <span className="text-gray-600">剩余时间</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 选择按钮 */}
      {rpsState.isRoundActive && !isGameFinished && (
        <div className="space-y-4">
          <p className="text-center text-gray-600">请选择你的出招:</p>
          <div className="flex items-center justify-center space-x-4">
            {(['rock', 'paper', 'scissors'] as Choice[]).map((choice) => (
              <button
                key={choice}
                onClick={() => makeChoice(choice)}
                disabled={!!myChoice || rpsState.timeLeft <= 0}
                className={`flex flex-col items-center space-y-2 p-6 rounded-xl border-2 transition-all duration-200 ${
                  myChoice === choice
                    ? 'border-blue-500 bg-blue-50 scale-110'
                    : myChoice
                    ? 'border-gray-200 bg-gray-50 opacity-50'
                    : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 hover:scale-105 cursor-pointer'
                }`}
              >
                <div className={`text-4xl ${
                  myChoice === choice ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {getChoiceEmoji(choice)}
                </div>
                <span className="font-medium">{getChoiceName(choice)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 当前选择状态 */}
      <div className="w-full max-w-md">
        <h4 className="text-lg font-semibold mb-3 text-center">玩家选择</h4>
        <div className="space-y-2">
          {gameState.players.map((player: any) => {
            const hasChosen = rpsState.playerChoices[player.id] !== undefined;
            const choice = showResults ? rpsState.playerChoices[player.id] : null;
            
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.id === currentUser.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <span className="font-medium">{player.name}</span>
                <div className="flex items-center space-x-2">
                  {showResults && choice ? (
                    <>
                      <span className="text-2xl">{getChoiceEmoji(choice)}</span>
                      <span className="text-sm text-gray-600">{getChoiceName(choice)}</span>
                    </>
                  ) : hasChosen ? (
                    <span className="text-green-600 text-sm font-medium">已选择</span>
                  ) : (
                    <span className="text-gray-400 text-sm">等待中...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 回合结果 */}
      {showResults && currentRoundResult && (
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-lg font-semibold mb-3 text-center">第 {currentRoundResult.roundNumber} 轮结果</h4>
          <div className="space-y-2">
            {Object.entries(currentRoundResult.results).map(([playerId, result]) => {
              const player = gameState.players.find((p: any) => p.id === playerId);
              if (!player) return null;
              
              return (
                <div key={playerId} className="flex items-center justify-between p-2 rounded">
                  <span>{player.name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getResultColor(result)
                  }`}>
                    {getResultText(result)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 总分数 */}
      <div className="w-full max-w-md">
        <h4 className="text-lg font-semibold mb-3 text-center">总分数</h4>
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
          {Object.entries(rpsState.scores).map(([playerId, score]) => {
            const player = gameState.players.find((p: any) => p.id === playerId);
            if (!player) return null;
            
            return (
              <div key={playerId} className="flex items-center justify-between py-2">
                <span className="font-medium">{player.name}</span>
                <span className="text-xl font-bold text-blue-600">{score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 游戏说明 */}
      <div className="text-center text-sm text-gray-500 max-w-md">
        <p>石头胜剪刀，剪刀胜布，布胜石头。{rpsState.maxRounds}轮比赛，得分最高者获胜！</p>
      </div>
    </div>
  );
};

export default RockPaperScissors;