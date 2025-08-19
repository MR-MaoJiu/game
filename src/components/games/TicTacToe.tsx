import React, { useState, useEffect } from 'react';
import { X, Circle } from 'lucide-react';

interface TicTacToeProps {
  socket: any;
  roomId: string;
  currentUser: any;
  gameState: any;
  setGameState: (state: any) => void;
}

type CellValue = 'X' | 'O' | null;
type Board = CellValue[];

interface TicTacToeState {
  board: Board;
  currentPlayer: string;
  playerSymbols: Record<string, 'X' | 'O'>;
  moves: number;
}

const TicTacToe: React.FC<TicTacToeProps> = ({
  socket,
  roomId,
  currentUser,
  gameState,
  setGameState
}) => {
  const [ticTacToeState, setTicTacToeState] = useState<TicTacToeState>({
    board: Array(9).fill(null),
    currentPlayer: '',
    playerSymbols: {},
    moves: 0
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('tic-tac-toe-move', (data: any) => {
      setTicTacToeState(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer,
        moves: data.moves
      }));
    });

    socket.on('tic-tac-toe-init', (data: any) => {
      setTicTacToeState(prev => ({
        ...prev,
        playerSymbols: data.playerSymbols,
        currentPlayer: data.currentPlayer
      }));
    });

    return () => {
      socket.off('tic-tac-toe-move');
      socket.off('tic-tac-toe-init');
    };
  }, [socket]);

  const handleCellClick = (index: number) => {
    if (
      ticTacToeState.board[index] ||
      ticTacToeState.currentPlayer !== currentUser.id ||
      gameState.status !== 'playing'
    ) {
      return;
    }

    socket.emit('game-action', {
      roomId,
      gameId: 'tic-tac-toe',
      action: 'move',
      data: { index, userId: currentUser.id }
    });
  };

  const checkWinner = (board: Board): string | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // 行
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // 列
      [0, 4, 8], [2, 4, 6] // 对角线
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }

    return null;
  };

  const winner = checkWinner(ticTacToeState.board);
  const isDraw = ticTacToeState.moves === 9 && !winner;
  const isGameOver = winner || isDraw;

  const getCurrentPlayerName = () => {
    const player = gameState.players.find((p: any) => p.id === ticTacToeState.currentPlayer);
    return player ? player.name : '';
  };

  const getWinnerName = () => {
    if (!winner) return null;
    const playerEntry = Object.entries(ticTacToeState.playerSymbols).find(
      ([_, symbol]) => symbol === winner
    );
    if (!playerEntry) return null;
    const player = gameState.players.find((p: any) => p.id === playerEntry[0]);
    return player ? player.name : null;
  };

  const renderCell = (index: number) => {
    const value = ticTacToeState.board[index];
    const isClickable = 
      !value && 
      ticTacToeState.currentPlayer === currentUser.id && 
      gameState.status === 'playing' &&
      !isGameOver;

    return (
      <button
        key={index}
        onClick={() => handleCellClick(index)}
        disabled={!isClickable}
        className={`w-20 h-20 border-2 border-gray-300 rounded-lg flex items-center justify-center text-3xl font-bold transition-all duration-200 ${
          isClickable
            ? 'hover:bg-blue-50 hover:border-blue-400 cursor-pointer'
            : 'cursor-not-allowed'
        } ${
          value === 'X' ? 'text-blue-600' : value === 'O' ? 'text-red-600' : 'text-gray-400'
        }`}
      >
        {value === 'X' && <X className="w-8 h-8" />}
        {value === 'O' && <Circle className="w-8 h-8" />}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* 游戏状态 */}
      <div className="text-center">
        {isGameOver ? (
          <div className="space-y-2">
            {winner ? (
              <h3 className="text-2xl font-bold text-green-600">
                🎉 {getWinnerName()} 获胜!
              </h3>
            ) : (
              <h3 className="text-2xl font-bold text-yellow-600">
                🤝 平局!
              </h3>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-800">
              当前回合: {getCurrentPlayerName()}
            </h3>
            <p className="text-sm text-gray-600">
              你的符号: {ticTacToeState.playerSymbols[currentUser.id] || '等待分配'}
            </p>
          </div>
        )}
      </div>

      {/* 游戏棋盘 */}
      <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 rounded-xl">
        {Array.from({ length: 9 }, (_, index) => renderCell(index))}
      </div>

      {/* 玩家信息 */}
      <div className="flex items-center justify-center space-x-8">
        {Object.entries(ticTacToeState.playerSymbols).map(([playerId, symbol]) => {
          const player = gameState.players.find((p: any) => p.id === playerId);
          if (!player) return null;
          
          return (
            <div
              key={playerId}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                ticTacToeState.currentPlayer === playerId
                  ? 'bg-blue-100 border-2 border-blue-400'
                  : 'bg-gray-100'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center ${
                symbol === 'X' ? 'text-blue-600' : 'text-red-600'
              }`}>
                {symbol === 'X' ? <X className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
              </div>
              <span className="font-medium">{player.name}</span>
              {ticTacToeState.currentPlayer === playerId && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                  当前
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 游戏说明 */}
      <div className="text-center text-sm text-gray-500 max-w-md">
        <p>在3×3的棋盘上，率先连成一条直线（横、竖、斜）的玩家获胜！</p>
      </div>
    </div>
  );
};

export default TicTacToe;