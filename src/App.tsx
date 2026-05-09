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

// Sound Manager
const sounds = {
  ctx: null as AudioContext | null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  },

  play(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  eat() {
    this.play(880, 'triangle', 0.1);
  },

  gameOver() {
    if (!this.ctx) return;
    this.play(150, 'sawtooth', 0.6, 0.2);
    // Add a quick lower rumble
    setTimeout(() => this.play(70, 'sawtooth', 0.4, 0.15), 100);
  },

  newHighScore() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((note, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.frequency.setValueAtTime(note, now + i * 0.1);
      gain.gain.setValueAtTime(0.1, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }
};

// Constants
const GRID_SIZE = 20;
const CELL_SIZE = 20; // Will be responsive
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 2;
const MIN_SPEED = 60;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT');
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  
  const lastUpdateRef = useRef<number>(0);
  const gameLoopRef = useRef<number>(0);
  const startingHighScoreRef = useRef<number>(0);

  // Handle Canvas Resizing
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Keep it square and respect max size
        const size = Math.min(width, 600); // Max logical size
        setCanvasSize({ width: size, height: size });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Load high score and streak
  useEffect(() => {
    const savedScore = localStorage.getItem('snakeHighScore');
    if (savedScore) setHighScore(parseInt(savedScore, 10));
    
    const savedStreak = localStorage.getItem('snakeHighStreak');
    if (savedStreak) setStreak(parseInt(savedStreak, 10));
  }, []);

  // Sync high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
      if (!isNewHighScore && score > startingHighScoreRef.current) {
        setIsNewHighScore(true);
        sounds.newHighScore();
      }
    }
  }, [score, highScore, isNewHighScore]);

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
    sounds.init();
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setDirection('RIGHT');
    setNextDirection('RIGHT');
    setScore(0);
    setIsNewHighScore(false);
    setSpeed(INITIAL_SPEED);
    startingHighScoreRef.current = highScore;
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
        sounds.eat();
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
    if (status === 'GAMEOVER') {
      sounds.gameOver();
      if (score > startingHighScoreRef.current) {
        setStreak(prev => {
          const newStreak = prev + 1;
          localStorage.setItem('snakeHighStreak', newStreak.toString());
          return newStreak;
        });
      } else {
        setStreak(0);
        localStorage.setItem('snakeHighStreak', '0');
      }
    }
  }, [status]);

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
          else if (status === 'START' || status === 'GAMEOVER') {
            sounds.init();
            resetGame();
          }
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
    <div id="game-root" className="relative min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-4 font-mono selection:bg-cyan-500/30 overflow-hidden">
      {/* Background Animations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Scanning horizontal line */}
        <motion.div 
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 left-0 w-full h-[1px] bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
        />
        
        {/* Floating neon particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + '%', 
              y: Math.random() * 100 + '%',
              opacity: 0.1,
              scale: 0.5
            }}
            animate={{ 
              y: [null, (Math.random() * 100) + '%'],
              opacity: [0.1, 0.3, 0.1],
              scale: [0.5, 0.8, 0.5]
            }}
            transition={{ 
              duration: 10 + Math.random() * 20, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute w-2 h-2 bg-cyan-500/20 blur-sm rounded-full shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          />
        ))}

        {/* Diagonal moving lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <pattern id="diagonal-lines" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
             <line x1="0" y1="40" x2="40" y2="0" stroke="currentColor" strokeWidth="1" className="text-cyan-500" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#diagonal-lines)">
            <animateTransform 
              attributeName="transform" 
              type="translate" 
              from="0 0" 
              to="40 40" 
              dur="10s" 
              repeatCount="indefinite" 
            />
          </rect>
        </svg>

        {/* Radial glows in corners */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-rose-500/5 blur-[120px] translate-x-1/2 translate-y-1/2 rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        {/* Header */}
      <div className="w-full flex justify-between items-end mb-4 md:mb-8 border-b border-white/10 pb-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter italic text-cyan-400 leading-none">
            NEON<br />SNAKE
          </h1>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2">
            <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold whitespace-nowrap">
              Grid Protocol v2.0
            </p>
            {streak > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 bg-cyan-500/10 px-1.5 md:px-2 py-0.5 rounded border border-cyan-500/20"
              >
                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
                <span className="text-[8px] md:text-[9px] font-black text-cyan-400 uppercase tracking-widest whitespace-nowrap">Streak: {streak}</span>
              </motion.div>
            )}
          </div>
        </div>
        <div className="text-right flex-1">
          <div className="flex items-center justify-end gap-2 text-rose-500 mb-1">
            <Trophy size={14} className={isNewHighScore ? "animate-bounce text-cyan-400" : ""} />
            <span className={`text-xs md:text-sm font-bold transition-colors ${isNewHighScore ? 'text-cyan-400' : ''}`}>
              {highScore.toString().padStart(6, '0')}
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-white tabular-nums">
            {score.toString().padStart(6, '0')}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div ref={containerRef} className="relative group w-full aspect-square max-w-[500px]">
        {/* Decorative corner accents */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500 z-10" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-500 z-10" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-500 z-10" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500 z-10" />

        <canvas
          id="game-canvas"
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="bg-black/50 border border-white/5 shadow-2xl shadow-cyan-500/5 aspect-square w-full block rounded-sm"
        />

        {/* Overlay Screens */}
        <AnimatePresence mode="wait">
          {isNewHighScore && status === 'PLAYING' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            >
              <div className="bg-cyan-500 text-black px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                New Record Achieved
              </div>
            </motion.div>
          )}

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
                <div className="space-y-6 w-full">
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
                    <h2 className={`text-2xl font-black italic ${isNewHighScore ? 'text-cyan-400' : 'text-rose-500'}`}>
                      {isNewHighScore ? 'RECORDS BROKEN' : 'SYSTEM CRASH'}
                    </h2>
                    <p className="text-[10px] text-white/50 mt-2 font-bold uppercase tracking-widest">
                      {isNewHighScore ? `HIGH SCORE STREAK: ${streak}` : 'SEGMENTATION FAULT DETECTED'}
                    </p>
                  </div>

                  {isNewHighScore && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded text-[10px] text-cyan-400 font-bold"
                    >
                      CONSECUTIVE UPLOAD SUCCESSFUL
                    </motion.div>
                  )}

                  <button
                    onClick={resetGame}
                    className={`w-full py-4 font-black uppercase tracking-widest transition-colors ${isNewHighScore ? 'bg-cyan-500 hover:bg-cyan-400 text-black' : 'bg-rose-500 hover:bg-rose-400 text-white'}`}
                  >
                    {isNewHighScore ? 'NEXT ATTEMPT' : 'REBOOT'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls & Footer */}
      <div className="w-full max-w-[500px] mt-6 md:mt-8 flex flex-col md:flex-row gap-6 items-center">
        {/* Mobile-friendly on-screen controls */}
        <div className="grid grid-cols-3 grid-rows-2 gap-1 w-full max-w-[160px]">
          <div />
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'DOWN' && setNextDirection('UP')}
             className={`flex items-center justify-center h-12 rounded border border-white/10 active:bg-cyan-500 active:text-black transition-all ${direction === 'UP' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronUp size={20} />
          </button>
          <div />
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'RIGHT' && setNextDirection('LEFT')}
             className={`flex items-center justify-center h-12 rounded border border-white/10 active:bg-cyan-500 active:text-black transition-all ${direction === 'LEFT' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronLeft size={20} />
          </button>
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'UP' && setNextDirection('DOWN')}
             className={`flex items-center justify-center h-12 rounded border border-white/10 active:bg-cyan-500 active:text-black transition-all ${direction === 'DOWN' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronDown size={20} />
          </button>
          <button 
             onClick={() => status === 'PLAYING' && direction !== 'LEFT' && setNextDirection('RIGHT')}
             className={`flex items-center justify-center h-12 rounded border border-white/10 active:bg-cyan-500 active:text-black transition-all ${direction === 'RIGHT' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-white/5'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-3 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8 w-full">
          <p className="text-[10px] text-white/50 uppercase leading-relaxed text-center md:text-left">
            <span className="hidden md:inline"><strong className="text-white">SPACE</strong> TO START/PAUSE | </span>
            <strong className="text-white">ARROWS</strong> TO CONTROL | 
            <strong className="text-cyan-400 ml-1">EAT</strong> PINK NODES
          </p>
          <div className="max-w-[200px] mx-auto md:mx-0">
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
  </div>
  );
}

