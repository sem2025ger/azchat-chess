import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeContext, type BoardTheme } from '../context/ThemeContext';
import { Chess, type Square, type Move } from 'chess.js';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function ChessBoard({
  className,
  showCoordinates = true,
  game,
  onMove,
  orientation = 'w'
}: {
  className?: string;
  showCoordinates?: boolean;
  game?: Chess;
  onMove?: (source: string, target: string, promotion?: string) => boolean;
  orientation?: 'w' | 'b';
}) {
  const { board, specialThemesEnabled } = useThemeContext();
  const [localGame, setLocalGame] = useState(new Chess());

  const activeGame = game || localGame;
  const [trigger, setTrigger] = useState(0);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const history = activeGame.history({ verbose: true }) as Move[];
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });
    } else {
      setLastMove(null);
    }
  }, [activeGame, activeGame.fen(), trigger]);

  const boardThemeClasses: Record<BoardTheme, { light: string; dark: string }> = {
    Green: { light: 'bg-[#ebecd0]', dark: 'bg-[#779556]' },
    Wood: { light: 'bg-[#debc8d]', dark: 'bg-[#8b4a1c]' },
    Glass: { light: 'bg-white/20 backdrop-blur-sm', dark: 'bg-black/30 backdrop-blur-md' },
    Brown: { light: 'bg-[#f0d9b5]', dark: 'bg-[#b58863]' },
    'Ice Sea': { light: 'bg-[#dee3e6]', dark: 'bg-[#8ca2ad]' },
    Newspaper: { light: 'bg-[#ffffff]', dark: 'bg-[#d1d1d1]' },
    Walnut: { light: 'bg-[#e3c16f]', dark: 'bg-[#b88b4a]' },
    Sky: { light: 'bg-[#8ebad9]', dark: 'bg-[#4b7399]' },
    Lolz: { light: 'bg-[#ffffcf]', dark: 'bg-[#ffcf62]' },
    Stone: { light: 'bg-[#e0e0e0]', dark: 'bg-[#a0a0a0]' },
    'Warm Gold': { light: 'bg-[#f0d192]', dark: 'bg-[#a67c37]' },
    'Muted Gold': { light: 'bg-[#d9c5a0]', dark: 'bg-[#7d6b41]' },
    'Obsidian Gold': { light: 'bg-[#c4a671]', dark: 'bg-[#1a1a1a]' },
    'Charcoal Gold': { light: 'bg-[#b09b7c]', dark: 'bg-[#2b2b2b]' },
    Champagne: { light: 'bg-[#f2e1c2]', dark: 'bg-[#c5ad85]' },
    'Luxury Beige': { light: 'bg-[#e5d5b3]', dark: 'bg-[#a68d60]' }
  };

  const activeBoardTheme = specialThemesEnabled
    ? boardThemeClasses[board] || boardThemeClasses.Green
    : boardThemeClasses.Green;

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files =
    orientation === 'w'
      ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const handleMove = (source: string, target: string) => {
    const moveObj = { from: source, to: target, promotion: 'q' };

    if (onMove) {
      if (onMove(source, target, 'q')) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      }
    } else {
      try {
        const move = activeGame.move(moveObj);
        if (move) {
          setLocalGame(new Chess(activeGame.fen()));
          setTrigger((t) => t + 1);
          setSelectedSquare(null);
          setLegalMoves([]);
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  };

  const onSquareClick = (square: string) => {
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (selectedSquare) {
      const moved = handleMove(selectedSquare, square);
      if (moved) return;
    }

    try {
      const piece = activeGame.get(square as Square);
      if (piece && piece.color === activeGame.turn()) {
        setSelectedSquare(square);
        const moves = activeGame.moves({ square: square as Square, verbose: true }) as Move[];
        setLegalMoves(moves.map((m) => m.to));
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    } catch {
      // ignore invalid state
    }
  };

  const handleDragStart = (e: React.DragEvent, square: string) => {
    const piece = activeGame.get(square as Square);
    if (piece && piece.color === activeGame.turn()) {
      e.dataTransfer.setData('text/plain', square);
    } else {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent, square: string) => {
    e.preventDefault();
    const source = e.dataTransfer.getData('text/plain');
    if (source && source !== square) {
      handleMove(source, square);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className={cx(
        'w-full rounded-lg relative overflow-hidden transition-all duration-500',
        'p-2 md:p-3 bg-[#262421] border-[6px] border-[#312e2b] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.4)]',
        className
      )}
    >
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />

      <div className="aspect-square w-full rounded-sm overflow-hidden relative shadow-2xl border border-black/40">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full relative z-0">
          {ranks.map((rank, rIndex) =>
            files.map((file, fIndex) => {
              const squareRef = `${file}${rank}`;
              const isDark =
                orientation === 'w'
                  ? (rIndex + fIndex) % 2 !== 0
                  : (rIndex + fIndex) % 2 === 0;

              const tileBg = isDark ? activeBoardTheme.dark : activeBoardTheme.light;
              const isSelected = selectedSquare === squareRef;
              const isLastMove = lastMove?.from === squareRef || lastMove?.to === squareRef;
              const isLegalMove = legalMoves.includes(squareRef);
              const piece = activeGame.get(squareRef as Square);

              return (
                <div
                  key={squareRef}
                  className={cx(
                    'w-full h-full relative group transition-colors duration-150 flex items-center justify-center',
                    tileBg
                  )}
                  onClick={() => onSquareClick(squareRef)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, squareRef)}
                >
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

                  {isLastMove && <div className="absolute inset-0 bg-yellow-400/30 pointer-events-none" />}
                  {isSelected && (
                    <div className="absolute inset-0 bg-white/20 border-2 border-white/50 pointer-events-none" />
                  )}

                  {isLegalMove && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      {piece ? (
                        <div className="w-full h-full border-4 border-black/20 rounded-full scale-[0.85]" />
                      ) : (
                        <div className="w-1/4 h-1/4 rounded-full bg-black/20 backdrop-blur-[2px]" />
                      )}
                    </div>
                  )}

                  {showCoordinates && fIndex === 0 && (
                    <span
                      className={cx(
                        'absolute top-0.5 left-1 text-[0.55rem] md:text-[0.7rem] font-bold select-none z-10 pointer-events-none',
                        isDark ? 'text-white/50' : 'text-black/40'
                      )}
                    >
                      {rank}
                    </span>
                  )}

                  {showCoordinates && rIndex === 7 && (
                    <span
                      className={cx(
                        'absolute bottom-0.5 right-1 text-[0.55rem] md:text-[0.7rem] font-bold select-none z-10 pointer-events-none',
                        isDark ? 'text-white/50' : 'text-black/40'
                      )}
                    >
                      {file}
                    </span>
                  )}

                  {piece && (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, squareRef)}
                      className={cx(
                        'absolute inset-0 z-30 cursor-grab active:cursor-grabbing hover:scale-[1.05] transition-transform duration-150',
                        isSelected ? 'scale-[1.1]' : ''
                      )}
                    >
                      <PieceImage piece={piece} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function PieceImage({
  piece
}: {
  piece: { type: string; color: string };
}) {
  const piecePaths: Record<string, string[]> = {
    wK: ["M22.5,11.63V6M20,8h5", "M22.5,25s4.5-7.5,3-10c-1.5-2.5-6-2.5-6-2.5s-4.5,0-6,2.5c-1.5,2.5,3,10,3,10", "M11.5,37c5.5,3.5,15.5,3.5,21,0v-7s9,0,9-7c0-2-1-4-3-4h-2.5s2.5-3,2.5-5.5c0-3-2.5-5.5-5.5-5.5s-5.5,2.5-5.5,5.5c0,2.5,2.5,5.5,2.5,5.5H24.5V11.63c2-0.5,3-2.5,3-4.13c0-2.5-2-4.5-4.5-4.5s-4.5,2-4.5,4.5c0,1.63,1,3.63,3,4.13V13.5H18.5s2.5-3,2.5-5.5c0-3-2.5-5.5-5.5-5.5s-5.5,2.5-5.5,5.5c0,2.5,2.5,5.5,2.5,5.5H10c-2,0-3,2-3,4c0,7,9,7,9,7v7", "M11.5,30c5.5-3,15.5-3,21,0", "M11.5,33.5c5.5-3,15.5-3,21,0", "M11.5,37c5.5-3,15.5-3,21,0"],
    wQ: ["M9,26c8.5-1.5,21-1.5,27,0l2-12c0,0,1,0,1,1s-1.5,1-1.5,1.5c0,1,1.5,1,1.5,2s-1.5,1-1.5,1.5c0,1,1.5,1,1.5,2s-1.5,1-1.5,2c0,1,1.5,1,1.5,1s-1.5,1-1.5,1.5c0,1,1.5,1,1.5,1", "M9,26c0,0,1.5-4,3-4s2,4,2,4", "M14,26c0,0,1.5-4,3-4s2,4,2,4", "M19,26c0,0,1.5-4,3-4s2,4,2,4", "M24,26c0,0,1.5-4,3-4s2,4,2,4", "M29,26c0,0,1.5-4,3-4s2,4,2,4", "M11.5,30c5.5-3,15.5-3,21,0", "M11.5,33.5c5.5-3,15.5-3,21,0", "M11.5,37c5.5-3,15.5-3,21,0"],
    wR: ["M9,39h27v-3H9V39z", "M12,36v-4h21v4H12z", "M11,14V9h4v2h5V9h5v2h5V9h4v5", "M34,14l-3,3H14l-3-3", "M31,17v12.5H14V17", "M31,29.5l1.5,2.5h-20l1.5-2.5", "M11,14h23"],
    wB: ["M9,36c3.39,0,6.78,0,10.17,0,3.39,0,6.78,0,10.17,0V33H9v3z", "M15,32c2.5,2.5,12.5,2.5,15,0,0.5-1.5,0-2,0-2,0-2.5-2.5-4-2.5-4,5.5-1.5,6-11.5-5-15.5-11,4-10.5,14-5,15.5,0,0,2.5,1.5,2.5,4,0,0,0.5,0.5,0,2z", "M25,8a2.5,2.5 0 1,1 -5,0 2.5,2.5 0 1,1 5,0z", "M17.5,26h10", "M15,30c2.5-3,12.5-3,15,0", "M15,33c2.5-3,12.5-3,15,0"],
    wN: ["M22,10s4,4,4,8c0,5-1,5-1,5l1,1,1,3c0,3-1,4-2,4l-4-4-5,1s-1,2-5,2c-4,0-5-2-5-2,1-1,1-2,1-2,0-3-1-3-1-3s1-2,4-3c3-1,1-3,1-3,0-3,4-7,4-7l2-2,2,2", "M24,18c0.5,0,1,0.5,1,1s-0.5,1-1,1-1-0.5-1-1,0.5-1,1-1z", "M9,26c0,0,2,0,10,0"],
    wP: ["M22,9c-2.21,0-4,1.79-4,4c0,0.89,0.29,1.71,0.78,2.38C17.33,16.5,16,18.59,16,21c0,2.03,0.94,3.84,2.41,5.03C15.41,27.09,11,31.58,11,37h23c0-5.42-4.41-9.91-7.41-10.97C28.06,24.84,29,23.03,29,21c0-2.41-1.33-4.5-2.78-5.62c0.49-0.67,0.78-1.49,0.78-2.38c0-2.21-1.79-4-4-4z", "M11,37c5.5-3,15.5-3,21,0"],
    bK: ["M22.5,11.63V6M20,8h5", "M22.5,25s4.5-7.5,3-10c-1.5-2.5-6-2.5-6-2.5s-4.5,0-6,2.5c-1.5,2.5,3,10,3,10", "M11.5,37c5.5,3.5,15.5,3.5,21,0v-7s9,0,9-7c0-2-1-4-3-4h-2.5s2.5-3,2.5-5.5c0-3-2.5-5.5-5.5-5.5s-5.5,2.5-5.5,5.5c0,2.5,2.5,5.5,2.5,5.5H24.5V11.63c2-0.5,3-2.5,3-4.13c0-2.5-2-4.5-4.5-4.5s-4.5,2-4.5,4.5c0,1.63,1,3.63,3,4.13V13.5H18.5s2.5-3,2.5-5.5c0-3-2.5-5.5-5.5-5.5s-5.5,2.5-5.5,5.5c0,2.5,2.5,5.5,2.5,5.5H10c-2,0-3,2-3,4c0,7,9,7,9,7v7", "M11.5,30c5.5-3,15.5-3,21,0", "M11.5,33.5c5.5-3,15.5-3,21,0", "M11.5,37c5.5-3,15.5-3,21,0"],
    bQ: ["M9,26c8.5-1.5,21-1.5,27,0l2-12c0,0,1,0,1,1s-1.5,1-1.5,1.5c0,1,1.5,1,1.5,2s-1.5,1-1.5,1.5c0,1,1.5,1,1.5,2s-1.5,1-1.5,2c0,1,1.5,1,1.5,1s-1.5,1-1.5,1.5c0,1,1.5,1,1.5,1", "M9,26c0,0,1.5-4,3-4s2,4,2,4", "M14,26c0,0,1.5-4,3-4s2,4,2,4", "M19,26c0,0,1.5-4,3-4s2,4,2,4", "M24,26c0,0,1.5-4,3-4s2,4,2,4", "M29,26c0,0,1.5-4,3-4s2,4,2,4", "M11.5,30c5.5-3,15.5-3,21,0", "M11.5,33.5c5.5-3,15.5-3,21,0", "M11.5,37c5.5-3,15.5-3,21,0"],
    bR: ["M9,39h27v-3H9V39z", "M12,36v-4h21v4H12z", "M11,14V9h4v2h5V9h5v2h5V9h4v5", "M34,14l-3,3H14l-3-3", "M31,17v12.5H14V17", "M31,29.5l1.5,2.5h-20l1.5-2.5", "M11,14h23"],
    bB: ["M9,36c3.39,0,6.78,0,10.17,0,3.39,0,6.78,0,10.17,0V33H9v3z", "M15,32c2.5,2.5,12.5,2.5,15,0,0.5-1.5,0-2,0-2,0-2.5-2.5-4-2.5-4,5.5-1.5,6-11.5-5-15.5-11,4-10.5,14-5,15.5,0,0,2.5,1.5,2.5,4,0,0,0.5,0.5,0,2z", "M25,8a2.5,2.5 0 1,1 -5,0 2.5,2.5 0 1,1 5,0z", "M17.5,26h10", "M15,30c2.5-3,12.5-3,15,0", "M15,33c2.5-3,12.5-3,15,0"],
    bN: ["M22,10s4,4,4,8c0,5-1,5-1,5l1,1,1,3c0,3-1,4-2,4l-4-4-5,1s-1,2-5,2c-4,0-5-2-5-2,1-1,1-2,1-2,0-3-1-3-1-3s1-2,4-3c3-1,1-3,1-3,0-3,4-7,4-7l2-2,2,2", "M24,18c0.5,0,1,0.5,1,1s-0.5,1-1,1-1-0.5-1-1,0.5-1,1-1z", "M9,26c0,0,2,0,10,0"],
    bP: ["M22,9c-2.21,0-4,1.79-4,4c0,0.89,0.29,1.71,0.78,2.38C17.33,16.5,16,18.59,16,21c0,2.03,0.94,3.84,2.41,5.03C15.41,27.09,11,31.58,11,37h23c0-5.42-4.41-9.91-7.41-10.97C28.06,24.84,29,23.03,29,21c0-2.41-1.33-4.5-2.78-5.62c0.49-0.67,0.78-1.49,0.78-2.38c0-2.21-1.79-4-4-4z", "M11,37c5.5-3,15.5-3,21,0"],
  };

  const code = `${piece.color}${piece.type.toUpperCase()}`;
  const paths = piecePaths[code] || [];
  const isWhite = piece.color === 'w';

  return (
    <div className="w-full h-full flex items-center justify-center p-[8%] pointer-events-none select-none">
      <svg
        viewBox="0 0 45 45"
        className={cx(
          "w-full h-full transform-gpu transition-transform overflow-visible",
          isWhite 
            ? "drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]" 
            : "drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]"
        )}
      >
        <g
          fill={isWhite ? "#ffffff" : "#262421"}
          stroke={isWhite ? "#262421" : "#ffffff"}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
    </div>
  );
}