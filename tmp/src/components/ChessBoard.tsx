import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useThemeContext } from '../context/ThemeContext';
import { BOARD_THEMES, type BoardTheme } from '../lib/chessThemes';
import { Chess, type Square, type Move, type PieceSymbol, type Color } from 'chess.js';
import { squareAtPoint, type BoardRect } from '../utils/boardCoordinates';

interface PointerDrag {
  pointerId: number;
  source: Square;
  fen: string;
  orientation: 'w' | 'b';
  bounds: BoardRect;
  board: HTMLDivElement;
  element: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  moved: boolean;
  wasSelected: boolean;
}

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

function ChessBoard({
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
  const [localGame, setLocalGame] = useState(() => new Chess());

  const activeGame = game || localGame;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const pointerDrag = useRef<PointerDrag | null>(null);
  const dragFrame = useRef<number | null>(null);

  const [pendingPromotion, setPendingPromotion] = useState<{ source: string; target: string; color: Color } | null>(null);

  const activeFen = activeGame.fen();

  const cancelDrag = useCallback(() => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    const drag = pointerDrag.current;
    pointerDrag.current = null;
    if (!drag) return;
    drag.element.style.removeProperty('transform');
    drag.element.style.removeProperty('transition');
    drag.element.style.removeProperty('z-index');
    if (drag.board.hasPointerCapture(drag.pointerId)) {
      drag.board.releasePointerCapture(drag.pointerId);
    }
  }, []);

  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    cancelDrag();
    return cancelDrag;
  }, [activeFen, orientation, readOnly, cancelDrag]);

  // The new position is rendered in the same commit, without an effect/state round trip.
  const visualPieces = useMemo(() => getBoardPieces(activeGame).map(p => ({
    ...p,
    id: `${p.color}${p.type}-${p.square}`,
  })), [activeGame]);

  const lastMove = useMemo(() => {
    const history = activeGame.history({ verbose: true }) as Move[];
    const last = history.at(-1);
    return last ? { from: last.from, to: last.to } : null;
  }, [activeGame]);

  const activeBoardThemeName: BoardTheme = overrideBoardTheme || boardTheme || 'Classic Green';
  const activeBoardTheme = specialThemesEnabled
    ? BOARD_THEMES[activeBoardThemeName as BoardTheme] || BOARD_THEMES['Classic Green']
    : BOARD_THEMES['Classic Green'];

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files =
    orientation === 'w'
      ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const handleMove = (source: string, target: string, chosenPromotion?: string) => {
    const piece = activeGame.get(source as Square);
    const isPawnPromotion =
      piece?.type === 'p' &&
      ((piece.color === 'w' && target[1] === '8') || (piece.color === 'b' && target[1] === '1'));

    if (isPawnPromotion && !chosenPromotion) {
      setPendingPromotion({ source, target, color: piece.color });
      return false;
    }

    const promotion = chosenPromotion || 'q';
    const moveObj = { from: source, to: target, promotion };

    if (onMove) {
      if (onMove(source, target, promotion)) {
        setSelectedSquare(null);
        setLegalMoves([]);
        setPendingPromotion(null);
        return true;
      }
    } else {
      try {
        const nextGame = new Chess(activeFen);
        const move = nextGame.move(moveObj);
        if (move) {
          setLocalGame(nextGame);
          setSelectedSquare(null);
          setLegalMoves([]);
          setPendingPromotion(null);
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
        const isLegal = legalMoves.includes(square);

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
    if (readOnly || window.matchMedia('(min-width: 1280px)').matches) {
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia('(min-width: 1280px)').matches ||
        e.button !== 0 || !e.isPrimary || readOnly || pendingPromotion) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const square = squareAtPoint(e.clientX, e.clientY, bounds, orientation);
    if (!square) return;
    e.preventDefault();
    const piece = activeGame.get(square);
    if (piece?.color === activeGame.turn()) {
      const element = e.currentTarget.querySelector<HTMLElement>(`[data-piece-square="${square}"]`);
      if (!element) return;
      pointerDrag.current = {
        pointerId: e.pointerId, source: square, fen: activeFen, orientation, bounds,
        board: e.currentTarget, element, startX: e.clientX, startY: e.clientY,
        x: e.clientX, y: e.clientY,
        scaleX: bounds.width / e.currentTarget.offsetWidth,
        scaleY: bounds.height / e.currentTarget.offsetHeight,
        moved: false, wasSelected: selectedSquare === square,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (selectedSquare !== square) onSquareClick(square);
    } else {
      onSquareClick(square);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 4) return;
    drag.moved = true;
    if (dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      if (pointerDrag.current !== drag) return;
      drag.element.style.transition = 'none';
      drag.element.style.zIndex = '50';
      drag.element.style.transform = `translate3d(${(drag.x - drag.startX) / drag.scaleX}px, ${(drag.y - drag.startY) / drag.scaleY}px, 0)`;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const target = squareAtPoint(e.clientX, e.clientY, drag.bounds, orientation);
    cancelDrag();
    if (readOnly || drag.fen !== activeFen || drag.orientation !== orientation) return;
    if (drag.moved && target && target !== drag.source && legalMoves.includes(target)) {
      handleMove(drag.source, target);
    } else if (!drag.moved && drag.wasSelected) {
      onSquareClick(drag.source);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // pointerdown already handled desktop input; keep click/tap behaviour below 1280px.
    if (window.matchMedia('(min-width: 1280px)').matches && e.detail !== 0) return;
    const square = (e.target as Element).closest<HTMLElement>('[data-square]')?.dataset.square;
    if (square) onSquareClick(square);
  };

  return (
    <div
      className={cx(
        'w-full rounded-lg relative overflow-hidden transition-all duration-500 touch-manipulation',
        'p-2 md:p-3 bg-[#262421] border-[6px] border-[#312e2b] shadow-[0_16px_38px_-18px_rgba(0,0,0,0.72),inset_0_0_10px_rgba(0,0,0,0.28)]',
        className
      )}
    >
      <div className="aspect-square w-full rounded-sm overflow-hidden relative shadow-2xl border border-black/40">
        <div
          className="grid grid-cols-8 grid-rows-8 w-full h-full relative z-0 xl:touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onClick={handleClick}
        >
          {ranks.map((rank, rIndex) =>
            files.map((file, fIndex) => {
              const squareRef = `${file}${rank}`;
              const fileCode = file.charCodeAt(0) - 96; // a=1, ..., h=8
              const isDark = (fileCode + rank) % 2 === 0;

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
                  data-square={squareRef}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, squareRef)}
                >
                  {isLastMove && <div className="absolute inset-0 bg-yellow-400/30 pointer-events-none" />}
                  {isSelected && (
                    <div className="absolute inset-0 bg-white/20 border-2 border-white/50 pointer-events-none" />
                  )}

                  {isLegalMove && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      {activeGame.get(squareRef as Square) ? (
                        <div className="w-full h-full border-[5px] border-black/20 rounded-full scale-[0.85]" />
                      ) : (
                        <div className="w-[30%] h-[30%] rounded-full bg-black/25" />
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
                  data-square={p.square}
                  data-piece-square={p.square}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.square)}
                  className={cx(
                    'absolute w-[12.5%] h-[12.5%] transition-all duration-[150ms] xl:transition-none ease-out pointer-events-none md:pointer-events-auto xl:pointer-events-none cursor-grab active:cursor-grabbing max-xl:hover:scale-[1.05]',
                    isSelected ? 'max-xl:scale-[1.1] z-40' : 'z-30'
                  )}
                  style={{ left: `${fileIdx * 12.5}%`, top: `${rankIdx * 12.5}%` }}
                >
                  <PieceImage piece={p} theme={pieceTheme} />
                </div>
              );
            })}
          </div>

          {pendingPromotion && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/88 animate-fade-in p-4 pointer-events-auto">
              <div className="bg-neutral-900/95 border border-white/20 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3">
                <span className="text-white font-black text-xs uppercase tracking-widest">
                  Promote Pawn
                </span>
                <div className="flex gap-2">
                  {(['q', 'r', 'b', 'n'] as const).map((pieceType) => (
                    <button
                      key={pieceType}
                      type="button"
                      onClick={() => {
                        handleMove(pendingPromotion.source, pendingPromotion.target, pieceType);
                      }}
                      className="w-14 h-14 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 rounded-xl flex items-center justify-center transition-all p-1.5 shadow-lg cursor-pointer"
                    >
                      <PieceImage
                        piece={{ type: pieceType, color: pendingPromotion.color }}
                        theme={pieceTheme}
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPromotion(null)}
                  className="text-neutral-500 hover:text-white text-xs font-bold uppercase tracking-wider mt-1 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
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
  theme: string;
}) {
  const pieceSetName = theme || 'classic'; // Fallback only to classic if undefined
  const pieceCode = `${piece.color}${piece.type.toUpperCase()}`;
  const src = pieceSetName === 'cburnett-classic'
    ? `/chess-assets/pieces/cburnett/${pieceCode}.svg`
    : pieceSetName === 'neo' || pieceSetName === 'tournament'
      ? `/pieces/mobile/${pieceSetName}/${pieceCode}.svg`
      : `/pieces/${pieceSetName}/${pieceCode}.svg`;

  // Share the Neo pawn silhouette across the four desktop sets; preserve smaller screens.
  const pawnPalette = piece.color === 'w'
    ? (pieceSetName === 'neo' || pieceSetName === 'tournament' ? 'merida' : 'classic')
    : (pieceSetName === 'neo' || pieceSetName === 'tournament' ? pieceSetName : 'classic');
  const desktopPawnSrc = ['classic', 'cburnett-classic', 'neo', 'tournament'].includes(pieceSetName) && piece.type === 'p'
    ? `/pieces/desktop/neo-pawns/${pieceCode}-${pawnPalette}.svg`
    : null;

  // Use Merida SVGs (/pieces/mobile/neo and /pieces/mobile/tournament) on both desktop and mobile.
  const mobileSrc = pieceSetName === 'neo' || pieceSetName === 'tournament'
    ? `/pieces/mobile/${pieceSetName}/${pieceCode}.svg`
    : null;
  const image = (
    <img
      src={src}
      alt={pieceCode}
      data-desktop-pawn={desktopPawnSrc ? piece.color : undefined}
      data-piece-theme={desktopPawnSrc ? pieceSetName : undefined}
      className="w-full h-full object-contain transform-gpu"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
  return (
    <div className="w-full h-full flex items-center justify-center p-[3%] md:p-[8%] lg:p-[5%] pointer-events-none select-none">
      {desktopPawnSrc || mobileSrc ? (
        <picture className="block w-full h-full">
          {desktopPawnSrc && <source media="(min-width: 1280px)" srcSet={desktopPawnSrc} type="image/svg+xml" />}
          {mobileSrc && <source media="(max-width: 767px)" srcSet={mobileSrc} type="image/svg+xml" />}
          {image}
        </picture>
      ) : image}
    </div>
  );
}

export default memo(ChessBoard);
