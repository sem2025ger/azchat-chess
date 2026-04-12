import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeContext, type BoardTheme, type PieceTheme } from '../context/ThemeContext';
import { Chess, type Square, type Move } from 'chess.js';

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function ChessBoard({
  className,
  showCoordinates = true,
  game,
  onMove,
  orientation = 'w',
  pieceTheme
}: {
  className?: string;
  showCoordinates?: boolean;
  game?: Chess;
  onMove?: (source: string, target: string, promotion?: string) => boolean;
  orientation?: 'w' | 'b';
  pieceTheme?: PieceTheme;
}) {
  const { board, pieces: globalPieces, specialThemesEnabled } = useThemeContext();
  const pieces = pieceTheme || globalPieces;
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
                      <PieceImage piece={piece} theme={pieces} />
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
  piece,
  theme
}: {
  piece: { type: string; color: string };
  theme: PieceTheme;
}) {
  const styleMap: Record<string, { whiteText: string; blackText: string }> = {
    classic: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    neo: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    alpha: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    merida: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    dubrovny: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    governor: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    caliente: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    'pieces-wood': { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    glass: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' },
    cases: { whiteText: '♔♕♖♗♘♙', blackText: '♚♛♜♝♞♟' }
  };

  const _style = styleMap[String(theme)] || styleMap.classic;

  const unicodePieces: Record<string, string> = {
    wK: '♔',
    wQ: '♕',
    wR: '♖',
    wB: '♗',
    wN: '♘',
    wP: '♙',
    bK: '♚',
    bQ: '♛',
    bR: '♜',
    bB: '♝',
    bN: '♞',
    bP: '♟'
  };

  const pieceCode = `${piece.color}${piece.type.toUpperCase()}`;
  const symbol = unicodePieces[pieceCode] || '';

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none select-none">
      <span
        className={cx(
          'leading-none select-none',
          'text-[2rem] sm:text-[2.4rem] md:text-[2.8rem] lg:text-[3.2rem]',
          'drop-shadow-[0px_3px_6px_rgba(0,0,0,0.55)]',
          piece.color === 'w'
            ? 'text-[#f8f8f8] [text-shadow:0_1px_0_rgba(255,255,255,0.35),0_3px_6px_rgba(0,0,0,0.45)]'
            : 'text-[#111111] [text-shadow:0_1px_0_rgba(255,255,255,0.08),0_3px_6px_rgba(0,0,0,0.5)]'
        )}
        style={{
          fontFamily: '"Times New Roman", "Noto Sans Symbols", "Segoe UI Symbol", serif',
          fontWeight: 700,
          lineHeight: 1
        }}
      >
        {symbol}
      </span>
    </div>
  );
}