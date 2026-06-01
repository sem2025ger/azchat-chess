import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeContext } from '../context/ThemeContext';
import { BOARD_THEMES, type BoardTheme } from '../lib/chessThemes';
import { Chess, type Square, type Move, type PieceSymbol, type Color } from 'chess.js';

interface PieceData {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
}

function getBoardPieces(game: Chess): PieceData[] {
  const pieces: PieceData[] = [];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (let r = 1; r <= 8; r++) {
    for (const f of files) {
      const sq = `${f}${r}` as Square;
      const p = game.get(sq);
      if (p) pieces.push({ id: '', type: p.type, color: p.color, square: sq });
    }
  }
  return pieces;
}

function cx(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function ChessBoard({
  className,
  showCoordinates = true,
  game,
  onMove,
  orientation = 'w',
  overrideBoardTheme,
  readOnly = false,
}: {
  className?: string;
  showCoordinates?: boolean;
  game?: Chess;
  onMove?: (source: string, target: string, promotion?: string) => boolean;
  orientation?: 'w' | 'b';
  overrideBoardTheme?: BoardTheme;
  readOnly?: boolean;
}) {
  const { boardTheme, pieceTheme, specialThemesEnabled } = useThemeContext();
  const [localGame, setLocalGame] = useState(new Chess());

  const activeGame = game || localGame;
  const [trigger, setTrigger] = useState(0);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const [visualPieces, setVisualPieces] = useState<PieceData[]>([]);

  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [activeGame.fen(), orientation, readOnly]);

  useEffect(() => {
    const history = activeGame.history({ verbose: true }) as Move[];
    if (history.length > 0) {
      const last = history[history.length - 1];
      setLastMove({ from: last.from, to: last.to });
    } else {
      setLastMove(null);
    }

    const current = getBoardPieces(activeGame);
    setVisualPieces(
      current.map((p) => ({
        ...p,
        id: `${p.color}${p.type}-${p.square}`,
      }))
    );
  }, [activeGame, activeGame.fen(), trigger]);

  const activeBoardThemeName: BoardTheme = overrideBoardTheme || boardTheme || 'Classic Green';
  const activeBoardTheme = specialThemesEnabled
    ? BOARD_THEMES[activeBoardThemeName as BoardTheme] || BOARD_THEMES['Classic Green']
    : BOARD_THEMES['Classic Green'];

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files =
    orientation === 'w'
      ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const handleMove = (source: string, target: string) => {
    let promotion = 'q';
    const piece = activeGame.get(source as Square);
    if (piece?.type === 'p' && (target[1] === '8' || target[1] === '1')) {
      const p = prompt('Promote to? (q, r, b, n)', 'q');
      promotion = p && ['q','r','b','n'].includes(p.toLowerCase()) ? p.toLowerCase() : 'q';
    }

    const moveObj = { from: source, to: target, promotion };

    if (onMove) {
      if (onMove(source, target, promotion)) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      }
    } else {
      try {
        const move = activeGame.move(moveObj);
        if (move) {
          const nextGame = new Chess(activeGame.fen());
          setLocalGame(nextGame);
          setTrigger((t) => t + 1);
          setSelectedSquare(null);
          setLegalMoves([]);
          if (nextGame.isGameOver()) {
            setTimeout(() => {
              if (nextGame.isCheckmate()) alert('Checkmate! Game Over.');
              else if (nextGame.isDraw()) alert('Draw! Game Over.');
              else alert('Game Over!');
            }, 300);
          }
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  };

  const onSquareClick = (square: string) => {
    if (readOnly) {
      return;
    }

    const clickedPiece = activeGame.get(square as Square);

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const selectedPiece = activeGame.get(selectedSquare as Square);
      if (!selectedPiece || selectedPiece.color !== activeGame.turn()) {
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        const validMoves = activeGame.moves({ square: selectedSquare as Square, verbose: true }) as Move[];
        const isLegal = validMoves.some(m => m.to === square);

        if (isLegal) {
          setSelectedSquare(null);
          setLegalMoves([]);
          handleMove(selectedSquare, square);
          return;
        } else {
          if (clickedPiece && clickedPiece.color === activeGame.turn()) {
            setSelectedSquare(square);
            const newMoves = activeGame.moves({ square: square as Square, verbose: true }) as Move[];
            setLegalMoves(newMoves.map((m) => m.to));
            return;
          } else {
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }
        }
      }
    }

    if (clickedPiece && clickedPiece.color === activeGame.turn()) {
      setSelectedSquare(square);
      const moves = activeGame.moves({ square: square as Square, verbose: true }) as Move[];
      setLegalMoves(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleDragStart = (e: React.DragEvent, square: string) => {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    const piece = activeGame.get(square as Square);
    if (piece && piece.color === activeGame.turn()) {
      e.dataTransfer.setData('text/plain', square);
    } else {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent, square: string) => {
    e.preventDefault();
    if (readOnly) return;
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
        'w-full rounded-lg relative overflow-hidden transition-all duration-500 touch-manipulation',
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
                      {activeGame.get(squareRef as Square) ? (
                        <div className="w-full h-full border-[5px] border-black/20 rounded-full scale-[0.85]" />
                      ) : (
                        <div className="w-[30%] h-[30%] rounded-full bg-black/20 backdrop-blur-[2px]" />
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

                </div>
              );
            })
          )}
          
          {/* Absolute Piece Layer for Smooth Animation */}
          <div className="absolute inset-0 pointer-events-none z-30">
            {visualPieces.map((p) => {
              const fileIdx = files.indexOf(p.square[0]);
              const rankIdx = ranks.indexOf(parseInt(p.square[1]));
              if (fileIdx === -1 || rankIdx === -1) return null;
              
              const isSelected = selectedSquare === p.square;

              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.square)}
                  onClick={() => onSquareClick(p.square)}
                  className={cx(
                    'absolute w-[12.5%] h-[12.5%] transition-all duration-[150ms] ease-out pointer-events-none md:pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-[1.05]',
                    isSelected ? 'scale-[1.1] drop-shadow-2xl z-40' : 'z-30'
                  )}
                  style={{ left: `${fileIdx * 12.5}%`, top: `${rankIdx * 12.5}%` }}
                >
                  <PieceImage piece={p} theme={pieceTheme} />
                </div>
              );
            })}
          </div>
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
  theme: string;
}) {
  const pieceSetName = theme || 'classic'; // Fallback only to classic if undefined
  const pieceCode = `${piece.color}${piece.type.toUpperCase()}`;
  const src = pieceSetName === 'cburnett-classic'
    ? `/chess-assets/pieces/cburnett/${pieceCode}.svg`
    : `/pieces/${pieceSetName}/${pieceCode}.svg`;

  return (
    <div className="w-full h-full flex items-center justify-center p-[8%] pointer-events-none select-none">
      <img
        src={src}
        alt={pieceCode}
        className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform-gpu"
        onError={(e) => {
          // Fallback if asset is missing (though we shouldn't have missing assets)
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}