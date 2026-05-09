/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Pause, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Types
type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameStatus = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

// Constants
const GRID_SIZE = 20;
const CELL_SIZE = 20; // Will be responsive
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 2;
const MIN_SPEED = 60;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT');
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  
  const lastUpdateRef = useRef<number>(0);
  const gameLoopRef = useRef<number>(0);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('snakeHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Sync high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
    }
  }, [score, highScore]);

  // Generate random food
  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Don't place food on snake
      const onSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!onSnake) break;
    }
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setDirection('RIGHT');
    setNextDirection('RIGHT');
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setStatus('PLAYING');
  };

  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      const newHead = { ...head };

      // Update direction from queue
      const currentDir = nextDirection;
      setDirection(currentDir);

      switch (currentDir) {
        case 'UP': newHead.y -= 1; break;
        case 'DOWN': newHead.y += 1; break;
        case 'LEFT': newHead.x -= 1; break;
        case 'RIGHT': newHead.x += 1; break;
      }

      // Wall collision
      if (
        newHead.x < 0 || 
        newHead.x >= GRID_SIZE || 
        newHead.y < 0 || 
        newHead.y >= GRID_SIZE
      ) {
        setStatus('GAMEOVER');
        return prevSnake;
      }

      // Self collision
      if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        setStatus('GAMEOVER');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore(s => s + 10);
        setFood(generateFood(newSnake));
        setSpeed(prev => Math.max(MIN_SPEED, prev - SPEED_INCREMENT));
        // Don't pop tail if eating
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, nextDirection, generateFood]);

  // Game Loop
  useEffect(() => {
    const loop = (time: number) => {
      if (status === 'PLAYING') {
        const delta = time - lastUpdateRef.current;
        if (delta > speed) {
          moveSnake();
          lastUpdateRef.current = time;
        }
      }
      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [status, speed, moveSnake]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          if (direction !== 'DOWN') setNextDirection('UP');
          break;
        case 'arrowdown':
        case 's':
          if (direction !== 'UP') setNextDirection('DOWN');
          break;
        case 'arrowleft':
        case 'a':
          if (direction !== 'RIGHT') setNextDirection('LEFT');
          break;
        case 'arrowright':
        case 'd':
          if (direction !== 'LEFT') setNextDirection('RIGHT');
          break;
        case ' ': // Space for pause/start
          if (status === 'PLAYING') setStatus('PAUSED');
          else if (status === 'PAUSED') setStatus('PLAYING');
          else if (status === 'START' || status === 'GAMEOVER') resetGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, status]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a fixed size for the canvas grid logic, but scale it in CSS
    const width = canvas.width;
    const height = canvas.height;
    const cellW = width / GRID_SIZE;
    const cellH = height / GRID_SIZE;

    // Clear
    ctx.fillStyle = '#0a0a0c'; // Deep dark background
    ctx.fillRect(0, 0, width, height);

    // Draw Grid (Subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellH);
      ctx.lineTo(width, i * cellH);
      ctx.stroke();
    }

    // Draw Snake
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      
      // Neon Glow
      ctx.shadowBlur = isHead ? 15 : 5;
      ctx.shadowColor = isHead ? '#00ffcc' : '#00ccff';
      
      ctx.fillStyle = isHead ? '#00ffcc' : '#00ccff';
      
      // Rounded snake segments
      const radius = 4;
      const x = segment.x * cellW + 2;
      const y = segment.y * cellH + 2;
      const w = cellW - 4;
      const h = cellH - 4;
      
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
    });

    // Draw Food
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff3366';
    ctx.fillStyle = '#ff3366';
    
    ctx.beginPath();
    ctx.arc(
      food.x * cellW + cellW / 2,
      food.y * cellH + cellH / 2,
      cellW / 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
    
    // Reset shadow
    ctx.shadowBlur = 0;

  }, [snake, food]);

  return (
    <div id="game-root" className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-4 font-mono selection:bg-cyan-500/30">
      {/* Header */}
      <div className="w-full max-w-[440px] flex justify-between items-end mb-8 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter italic text-cyan-400 leading-none">
            NEON<br />SNAKE
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-2 font-bold">
            Grid Protocol v2.0
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 text-rose-500 mb-1">
            <Trophy size={14} />
            <span className="text-sm font-bold">{highScore.toString().padStart(6, '0')}</span>
          </div>
          <div className="text-3xl font-black text-white tabular-nums">
            {score.toString().padStart(6, '0')}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative group">
        {/* Decorative corner accents */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500 z-10" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-500 z-10" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-500 z-10" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500 z-10" />

        <canvas
          id="game-canvas"
          ref={canvasRef}
          width={400}
          height={400}
          className="bg-black/50 border border-white/5 shadow-2xl shadow-cyan-500/5 aspect-square w-full max-w-[400px] block"
        />

        {/* Overlay Screens */}
        <AnimatePresence mode="wait">
          {status !== 'PLAYING' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-20"
            >
              {status === 'START' && (
                <div className="space-y-6">
                  <Play className="w-12 h-12 text-cyan-400 mx-auto animate-pulse" />
                  <div>
                    <h2 className="text-2xl font-black italic mb-2">INITIALIZING...</h2>
                    <p className="text-xs text-white/50 max-w-[200px] mx-auto leading-relaxed">
                      USE ARROW KEYS OR WASD TO NAVIGATE THE PROTOCOL.
                    </p>
                  </div>
                  <button
                    onClick={resetGame}
                    className="w-full py-4 bg-cyan-500 text-black font-black uppercase tracking-widest hover:bg-cyan-400 transition-colors"
                  >
                    START SESSION
                  </button>
                </div>
              )}

              {status === 'PAUSED' && (
                <div className="space-y-6">
                  <Pause className="w-12 h-12 text-yellow-400 mx-auto" />
                  <h2 className="text-2xl font-black italic">PROTOCOL HALTED</h2>
                  <button
                    onClick={() => setStatus('PLAYING')}
                    className="w-full py-4 bg-yellow-500 text-black font-black uppercase tracking-widest hover:bg-yellow-400 transition-colors"
                  >
                    RESUME
                  </button>
                </div>
              )}

              {status === 'GAMEOVER' && (
                <div className="space-y-6">
                  <div className="relative">
                    <RotateCcw className="w-12 h-12 text-rose-500 mx-auto" />
                    <motion.div 
                      key={score}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-4 -right-4 bg-rose-500 text-black px-2 py-1 text-[10px] font-black rounded-sm"
                    >
                      FINAL: {score}
                    </motion.div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic text-rose-500">SYSTEM CRASH</h2>
                    <p className="text-xs text-white/50 mt-2 font-bold">SEGMENTATION FAULT DETECTED</p>
                  </div>
                  <button
                    onClick={resetGame}
                    className="w-full py-4 bg-rose-500 text-white font-black uppercase tracking-widest hover:bg-rose-400 transition-colors"
                  >
                    REBOOT
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls & Footer */}
      <div className="w-full max-w-[400px] mt-8 grid grid-cols-2 gap-8 h-32 items-center">
        {/* Mobile-friendly on-screen controls or just visual feedback */}
        <div className="grid grid-cols-3 grid-rows-2 gap-1 w-32 mx-auto">
          <div />
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'DOWN' && setNextDirection('UP')}
             className={`flex items-center justify-center h-10 border border-white/10 ${direction === 'UP' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronUp size={16} />
          </button>
          <div />
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'RIGHT' && setNextDirection('LEFT')}
             className={`flex items-center justify-center h-10 border border-white/10 ${direction === 'LEFT' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronLeft size={16} />
          </button>
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'UP' && setNextDirection('DOWN')}
             className={`flex items-center justify-center h-10 border border-white/10 ${direction === 'DOWN' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronDown size={16} />
          </button>
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'LEFT' && setNextDirection('RIGHT')}
             className={`flex items-center justify-center h-10 border border-white/10 ${direction === 'RIGHT' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="space-y-2 border-l border-white/10 pl-8">
          <p className="text-[10px] text-white/50 uppercase leading-relaxed">
            <strong className="text-white">SPACE</strong> TO START/PAUSE<br />
            <strong className="text-white">ARROWS</strong> TO CONTROL<br />
            <strong className="text-cyan-400">EAT</strong> PINK NODES
          </p>
          <div className="pt-2">
             <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-cyan-500" 
                  initial={{ width: '100%' }}
                  animate={{ width: `${((speed - MIN_SPEED) / (INITIAL_SPEED - MIN_SPEED)) * 100}%` }}
                />
             </div>
             <p className="text-[8px] text-white/30 mt-1 tracking-widest text-right font-bold uppercase">Clock Speed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

