import React, { useState, useEffect } from 'react';
import { Heart, Check, X, Star } from 'lucide-react';

interface LoveQuizProps {
  socket: any;
  roomId: string;
  currentUser: any;
  gameState: any;
  setGameState: (state: any) => void;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  category: 'preference' | 'memory' | 'future' | 'personality';
}

interface QuizState {
  currentQuestion: number;
  questions: Question[];
  answers: Record<string, Record<string, string>>; // userId -> questionId -> answer
  scores: Record<string, number>;
  phase: 'answering' | 'comparing' | 'results';
  timeLeft: number;
}

const loveQuestions: Question[] = [
  {
    id: 'q1',
    text: '你最喜欢的约会地点是？',
    options: ['电影院', '餐厅', '公园', '家里'],
    category: 'preference'
  },
  {
    id: 'q2', 
    text: '你认为对方最喜欢的颜色是？',
    options: ['红色', '蓝色', '粉色', '黑色'],
    category: 'preference'
  },
  {
    id: 'q3',
    text: '你们第一次见面是在哪里？',
    options: ['学校', '工作场所', '朋友介绍', '网上'],
    category: 'memory'
  },
  {
    id: 'q4',
    text: '对方最害怕什么？',
    options: ['蜘蛛', '高处', '黑暗', '孤独'],
    category: 'personality'
  },
  {
    id: 'q5',
    text: '你们理想的度假地点是？',
    options: ['海边', '山区', '城市', '乡村'],
    category: 'future'
  },
  {
    id: 'q6',
    text: '对方最喜欢的食物类型是？',
    options: ['中餐', '西餐', '日料', '韩料'],
    category: 'preference'
  },
  {
    id: 'q7',
    text: '你认为对方的理想职业是？',
    options: ['艺术家', '医生', '教师', '企业家'],
    category: 'future'
  },
  {
    id: 'q8',
    text: '对方在压力大时会怎么做？',
    options: ['运动', '听音乐', '睡觉', '找朋友聊天'],
    category: 'personality'
  }
];

const LoveQuiz: React.FC<LoveQuizProps> = ({
  socket,
  roomId,
  currentUser,
  gameState,
  setGameState
}) => {
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: 0,
    questions: loveQuestions.slice(0, 5), // 随机选择5个问题
    answers: {},
    scores: {},
    phase: 'answering',
    timeLeft: 30
  });

  const [myAnswer, setMyAnswer] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('quiz-question', (data: any) => {
      setQuizState(prev => ({
        ...prev,
        currentQuestion: data.questionIndex,
        phase: 'answering',
        timeLeft: data.timeLeft
      }));
      setMyAnswer('');
      setShowComparison(false);
    });

    socket.on('quiz-answer', (data: any) => {
      setQuizState(prev => ({
        ...prev,
        answers: data.answers
      }));
    });

    socket.on('quiz-comparison', (data: any) => {
      setQuizState(prev => ({
        ...prev,
        phase: 'comparing',
        scores: data.scores
      }));
      setShowComparison(true);
    });

    socket.on('quiz-timer', (data: any) => {
      setQuizState(prev => ({
        ...prev,
        timeLeft: data.timeLeft
      }));
    });

    socket.on('quiz-end', (data: any) => {
      setQuizState(prev => ({
        ...prev,
        phase: 'results',
        scores: data.finalScores
      }));
    });

    return () => {
      socket.off('quiz-question');
      socket.off('quiz-answer');
      socket.off('quiz-comparison');
      socket.off('quiz-timer');
      socket.off('quiz-end');
    };
  }, [socket]);

  const submitAnswer = (answer: string) => {
    if (myAnswer || quizState.phase !== 'answering') return;

    setMyAnswer(answer);
    socket.emit('game-action', {
      roomId,
      gameId: 'love-quiz',
      action: 'answer',
      data: {
        questionId: quizState.questions[quizState.currentQuestion].id,
        answer,
        userId: currentUser.id
      }
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'preference': return '💝';
      case 'memory': return '💭';
      case 'future': return '🌟';
      case 'personality': return '💖';
      default: return '❤️';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'preference': return '喜好偏向';
      case 'memory': return '美好回忆';
      case 'future': return '未来憧憬';
      case 'personality': return '性格特点';
      default: return '情侣问答';
    }
  };

  const currentQ = quizState.questions[quizState.currentQuestion];
  const isLastQuestion = quizState.currentQuestion >= quizState.questions.length - 1;
  const totalQuestions = quizState.questions.length;
  const progress = ((quizState.currentQuestion + 1) / totalQuestions) * 100;

  if (quizState.phase === 'results') {
    const sortedScores = Object.entries(quizState.scores).sort(([,a], [,b]) => b - a);
    const maxScore = Math.max(...Object.values(quizState.scores));
    
    return (
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-pink-600 mb-2">
            💕 问答结束！
          </h3>
          <p className="text-gray-600">看看你们对彼此的了解程度吧~</p>
        </div>

        <div className="w-full max-w-md space-y-4">
          {sortedScores.map(([playerId, score], index) => {
            const player = gameState.players.find((p: any) => p.id === playerId);
            if (!player) return null;
            
            const percentage = (score / totalQuestions) * 100;
            const isWinner = score === maxScore;
            
            return (
              <div key={playerId} className={`p-4 rounded-xl border-2 ${
                isWinner ? 'border-pink-400 bg-pink-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {isWinner && <Star className="w-5 h-5 text-yellow-500" />}
                    <span className="font-semibold">{player.name}</span>
                  </div>
                  <span className="text-xl font-bold text-pink-600">
                    {score}/{totalQuestions}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isWinner ? 'bg-pink-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                
                <div className="text-center text-sm">
                  <span className={`font-medium ${
                    percentage >= 80 ? 'text-green-600' :
                    percentage >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {percentage >= 80 ? '💖 心有灵犀' :
                     percentage >= 60 ? '💕 还不错哦' :
                     '💔 需要多了解'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center text-sm text-gray-500 max-w-md">
          <p>爱情需要时间来培养，多沟通多了解，感情会越来越好的！</p>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* 进度条 */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">
            问题 {quizState.currentQuestion + 1} / {totalQuestions}
          </span>
          <span className={`text-sm font-medium ${
            quizState.timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-600'
          }`}>
            {quizState.timeLeft}s
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 问题分类 */}
      <div className="flex items-center space-x-2 px-4 py-2 bg-pink-50 rounded-full">
        <span className="text-lg">{getCategoryIcon(currentQ.category)}</span>
        <span className="text-sm font-medium text-pink-700">
          {getCategoryName(currentQ.category)}
        </span>
      </div>

      {/* 问题 */}
      <div className="text-center max-w-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          {currentQ.text}
        </h3>
      </div>

      {/* 选项 */}
      {quizState.phase === 'answering' && (
        <div className="grid grid-cols-1 gap-3 w-full max-w-md">
          {currentQ.options.map((option, index) => (
            <button
              key={index}
              onClick={() => submitAnswer(option)}
              disabled={!!myAnswer}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                myAnswer === option
                  ? 'border-pink-500 bg-pink-50 scale-105'
                  : myAnswer
                  ? 'border-gray-200 bg-gray-50 opacity-50'
                  : 'border-gray-300 bg-white hover:border-pink-400 hover:bg-pink-50 hover:scale-102 cursor-pointer'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  myAnswer === option
                    ? 'border-pink-500 bg-pink-500'
                    : 'border-gray-300'
                }`}>
                  {myAnswer === option && <Check className="w-4 h-4 text-white" />}
                </div>
                <span className="font-medium">{option}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 答案对比 */}
      {showComparison && (
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-lg font-semibold mb-3 text-center text-pink-600">
            💕 答案揭晓
          </h4>
          <div className="space-y-3">
            {gameState.players.map((player: any) => {
              const answer = quizState.answers[player.id]?.[currentQ.id];
              return (
                <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{player.name}</span>
                  <span className="text-pink-600">{answer || '未回答'}</span>
                </div>
              );
            })}
          </div>
          
          {/* 显示匹配情况 */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-center">
              {Object.values(quizState.answers).every(playerAnswers => 
                playerAnswers[currentQ.id] === Object.values(quizState.answers)[0][currentQ.id]
              ) ? (
                <div className="flex items-center justify-center space-x-2 text-green-600">
                  <Heart className="w-5 h-5" />
                  <span className="font-medium">答案一致！+1分</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                  <X className="w-5 h-5" />
                  <span>答案不同，继续加油！</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 当前分数 */}
      <div className="w-full max-w-md">
        <h4 className="text-lg font-semibold mb-3 text-center">当前得分</h4>
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4">
          {Object.entries(quizState.scores).map(([playerId, score]) => {
            const player = gameState.players.find((p: any) => p.id === playerId);
            if (!player) return null;
            
            return (
              <div key={playerId} className="flex items-center justify-between py-2">
                <span className="font-medium">{player.name}</span>
                <span className="text-xl font-bold text-pink-600">{score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 游戏说明 */}
      <div className="text-center text-sm text-gray-500 max-w-md">
        <p>回答关于彼此的问题，答案一致就能得分。看看你们有多了解对方吧！</p>
      </div>
    </div>
  );
};

export default LoveQuiz;