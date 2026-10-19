import { useRef, type DragEvent, type PointerEvent } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import { BOARD_THEMES } from '../../lib/chessThemes';
import type { PositionDraft } from '../../utils/analysisWorkspace';
import type { AnalysisWords } from './copy';

interface EditorBoardProps {
  draft: PositionDraft;
  selected: string;
  words: AnalysisWords;
  onPlace: (index: number, piece?: string) => void;
  onMove: (from: number, to: number) => void;
}

const files = 'abcdefgh';
const pieces = /^[KQRBNPkqrbnp]$/;

// This replaces (rather than overlaps) the normal board during desktop setup.
// It accepts incomplete positions: chess.js validation is done only on Apply.
export default function EditorBoard({ draft, selected, words, onPlace, onMove }: EditorBoardProps) {
  const { boardTheme, pieceTheme, specialThemesEnabled } = useThemeContext();
  const colors = BOARD_THEMES[specialThemesEnabled ? boardTheme : 'Classic Green'] || BOARD_THEMES['Classic Green'];
  const drag = useRef<{ pointerId: number; from: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const pieceAsset = (piece: string) => {
    const code = `${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}`;
    return pieceTheme === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/${code}.svg`
      : pieceTheme === 'neo' || pieceTheme === 'tournament'
        ? `/pieces/mobile/${pieceTheme}/${code}.svg` : `/pieces/${pieceTheme}/${code}.svg`;
  };

  const indexAt = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const col = Math.floor(8 * (event.clientX - bounds.left) / bounds.width);
    const row = Math.floor(8 * (event.clientY - bounds.top) / bounds.height);
    return col >= 0 && col < 8 && row >= 0 && row < 8 ? row * 8 + col : -1;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const index = indexAt(event);
    if (index < 0 || !draft.squares[index]) return;
    drag.current = { pointerId: event.pointerId, from: index, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < 8) return;
    // A dragged piece can be placed freely, without chess move-legality constraints.
    const to = indexAt(event);
    if (to >= 0 && to !== state.from) onMove(state.from, to);
    suppressClick.current = true;
    event.preventDefault();
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    const piece = event.dataTransfer.getData('application/x-chessaz-piece');
    if (pieces.test(piece)) onPlace(index, piece);
  };

  return (
    <div className="w-full rounded-none md:rounded-lg relative overflow-hidden p-0 md:p-3 bg-[#262421] md:border-[6px] md:border-[#312e2b] shadow-[0_16px_38px_-18px_rgba(0,0,0,0.72)]">
      <div data-coordinate-axis="rank" aria-hidden="true" className="hidden lg:grid grid-rows-8 absolute left-0 top-[calc(0.75rem+1px)] bottom-[calc(0.75rem+1px)] w-3 text-[0.65rem] font-bold text-neutral-400 pointer-events-none">
        {[8,7,6,5,4,3,2,1].map(n => <span key={n} className="flex items-center justify-center">{n}</span>)}
      </div>
      <div data-coordinate-axis="file" aria-hidden="true" className="hidden lg:grid grid-cols-8 absolute left-[calc(0.75rem+1px)] right-[calc(0.75rem+1px)] bottom-0 h-3 text-[0.65rem] font-bold text-neutral-400 pointer-events-none">
        {[...files].map(f => <span key={f} className="flex items-center justify-center">{f}</span>)}
      </div>
      <div className="aspect-square w-full overflow-hidden rounded-sm border border-black/40">
        <div
          aria-label={words.editor}
          data-selected-piece={selected || "erase"}
          data-main-position-editor
          className="grid h-full w-full grid-cols-8 grid-rows-8 touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; }}
        >
          {draft.squares.map((piece, index) => {
            const dark = (Math.floor(index / 8) + index % 8) % 2 === 1;
            const square = `${files[index % 8]}${8 - Math.floor(index / 8)}`;
            return (
              <button key={square} type="button" data-editor-index={index}
                aria-label={`${words.square} ${square}${piece ? ', ' + (piece === piece.toUpperCase() ? words.white : words.black) + ' ' + words[piece.toLowerCase() as 'k' | 'q' | 'r' | 'b' | 'n' | 'p'] : ''}`}
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  onPlace(index);
                }}
                onContextMenu={event => { event.preventDefault(); onPlace(index, ''); }}
                onDragOver={event => event.preventDefault()}
                onDrop={event => onDrop(event, index)}
                className={`relative flex aspect-square min-w-0 items-center justify-center focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${dark ? colors.dark : colors.light}`}
              >
                {piece && <img src={pieceAsset(piece)} draggable={false} alt="" aria-hidden="true"
                  className={`pointer-events-none select-none h-[89%] w-[89%] object-contain ${piece === piece.toLowerCase() ? 'desktop-editor-black-piece' : ''}`} />}
                {index % 8 === 0 && <span aria-hidden="true" className="pointer-events-none absolute left-1 top-0.5 text-[0.7rem] font-bold text-black/45">{8 - Math.floor(index / 8)}</span>}
                {index >= 56 && <span aria-hidden="true" className="pointer-events-none absolute bottom-0.5 right-1 text-[0.7rem] font-bold text-black/45">{files[index % 8]}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
