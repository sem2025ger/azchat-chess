import { useMemo, useState } from 'react';
import { DEFAULT_POSITION } from 'chess.js';
import { Eraser, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { analysisFromFen, AnalysisInputError, positionDraftFen, validateAnalysisFen, type AnalysisInputErrorCode, type AnalysisLoad, type PositionDraft } from '../../utils/analysisWorkspace';
import type { AnalysisWords } from './copy';

export default function PositionTools({
  currentFen, words, onLoad, onCancel, draft, selected, onSelected,
  onDraft, onClear, onUndo, canUndo, onReset, onEditingChange,
}: {
  currentFen: string;
  words: AnalysisWords;
  onLoad: (analysis: AnalysisLoad) => void;
  onCancel: () => void;
  draft: PositionDraft;
  selected: string;
  onSelected: (piece: string) => void;
  onDraft: (next: PositionDraft) => void;
  onClear: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onReset: (fen: string) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [mode, setMode] = useState<'fen' | 'editor'>('editor');
  const [fen, setFen] = useState(currentFen);
  const { pieceTheme } = useThemeContext();
  const value = mode === 'fen' ? fen : positionDraftFen(draft);
  const error = useMemo(() => {
    try { validateAnalysisFen(value); return null; }
    catch (err) { return err instanceof AnalysisInputError ? err.code : 'invalidFen' as AnalysisInputErrorCode; }
  }, [value]);

  const pieceName = (piece: string) => `${piece === piece.toUpperCase() ? words.white : words.black} ${words[piece.toLowerCase() as 'k' | 'q' | 'r' | 'b' | 'n' | 'p']}`;
  const pieceImage = (piece: string) => {
    const code = `${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}`;
    return pieceTheme === 'cburnett-classic' ? `/chess-assets/pieces/cburnett/${code}.svg`
      : pieceTheme === 'neo' || pieceTheme === 'tournament' ? `/pieces/mobile/${pieceTheme}/${code}.svg` : `/pieces/${pieceTheme}/${code}.svg`;
  };
  const reset = (next: string) => { setFen(next); onReset(next); };

  return <section aria-label={words.position} className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-3">
      <div className="mb-3 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {(['fen', 'editor'] as const).map(tab => <button key={tab} type="button" aria-pressed={mode === tab} onClick={() => {
          if (tab === mode) return;
          if (tab === 'editor') {
            let seed = currentFen;
            try { seed = validateAnalysisFen(fen); } catch { /* Invalid FEN never locks the editor */ }
            onReset(seed);
          } else {
            setFen(positionDraftFen(draft));
          }
          setMode(tab);
          onEditingChange(tab === 'editor');
        }} className={`min-h-9 flex-1 rounded-lg px-2 text-xs font-bold ${mode === tab ? 'bg-amber-200/10 text-amber-100' : 'text-neutral-400 hover:text-neutral-200'}`}>{words[tab]}</button>)}
      </div>
      <button type="button" onClick={() => reset(currentFen)} className="analysis-tool-button mb-3 w-full">{words.current}</button>

      {mode === 'fen' ? <div>
        <label htmlFor="analysis-fen" className="text-xs font-bold text-neutral-200">{words.fenLabel}</label>
        <p className="mb-2 mt-1 text-xs leading-relaxed text-neutral-500">{words.fenInfo}</p>
        <textarea id="analysis-fen" value={fen} maxLength={200} onChange={event => setFen(event.target.value)} spellCheck={false} rows={4} aria-invalid={!!error} aria-describedby="analysis-position-validation" className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs leading-relaxed text-neutral-200 outline-none focus:border-amber-200/50" />
      </div> : <>
        <p className="mb-2 text-xs leading-relaxed text-neutral-400">{words.choosePiece} — {words.editor}</p>
        <div className="mb-3 grid grid-cols-7 gap-1" aria-label={words.choosePiece}>
          {['K','Q','R','B','N','P','', 'k','q','r','b','n','p'].map(piece => <button key={piece || 'erase'} type="button" draggable={!!piece}
            onDragStart={event => { if (piece) { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-chessaz-piece', piece); } }}
            title={piece ? pieceName(piece) : words.erase} aria-label={piece ? pieceName(piece) : words.erase} aria-pressed={selected === piece}
            onClick={() => onSelected(piece)} className={`flex aspect-square items-center justify-center rounded-lg border p-1 ${selected === piece ? 'border-amber-200/70 bg-amber-200/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
            {piece ? <img src={pieceImage(piece)} alt="" className={`h-7 w-7 ${piece === piece.toLowerCase() ? 'desktop-editor-black-piece' : ''}`} draggable={false} /> : <Eraser size={18} className="text-neutral-300" />}
          </button>)}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClear} className="analysis-tool-button"><Trash2 size={15}/>{words.clear}</button>
          <button type="button" disabled={!canUndo} onClick={onUndo} className="analysis-tool-button"><Undo2 size={15}/>{words.undo}</button>
          <button type="button" onClick={() => onDraftFromStart()} className="analysis-tool-button col-span-2"><RotateCcw size={14}/>{words.start}</button>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-neutral-400">{words.turn}
          <select value={draft.turn} onChange={event => onDraft({ ...draft, turn:event.target.value, ep:'-' })} className="rounded-lg border border-white/10 bg-neutral-900 p-2 text-neutral-200">
            <option value="w">{words.white}</option><option value="b">{words.black}</option>
          </select>
        </label>
        <fieldset className="mt-3"><legend className="mb-2 text-xs text-neutral-400">{words.castling}</legend>
          <div className="grid grid-cols-2 gap-2">{['K','Q','k','q'].map(right => <label key={right} className="flex items-center gap-2 text-xs text-neutral-300">
            <input type="checkbox" checked={draft.castling.includes(right)} onChange={event => {
              const rights = new Set(draft.castling.replace('-', '').split(''));
              if (event.target.checked) rights.add(right); else rights.delete(right);
              onDraft({ ...draft, castling: ['K','Q','k','q'].filter(value => rights.has(value)).join('') || '-' });
            }} />{right === right.toUpperCase() ? words.white : words.black} {right.toLowerCase() === 'k' ? 'O-O' : 'O-O-O'}
          </label>)}</div>
        </fieldset>
        <details className="mt-4 text-xs text-neutral-400"><summary className="cursor-pointer">{words.advanced}</summary><div className="mt-2 space-y-2">
          {(['ep','half','full'] as const).map(field => <label key={field} className="flex items-center justify-between gap-2">{words[field]}
            <input value={draft[field]} type={field === 'ep' ? 'text' : 'number'} min={field === 'full' ? 1 : 0} max={10000} maxLength={field === 'ep' ? 2 : undefined}
              onChange={event => onDraft({ ...draft, [field]:event.target.value })} className="w-20 rounded-lg border border-white/10 bg-neutral-900 p-2 text-neutral-200" />
          </label>)}
        </div></details>
      </>}
      <p id="analysis-position-validation" role="status" className={`mt-3 text-xs leading-relaxed ${error ? 'text-amber-200/80' : 'text-neutral-500'}`}>{error ? words[error] : words.draft}</p>
    </div>
    <footer className="shrink-0 space-y-2 border-t border-white/10 bg-black/20 p-3">
      <button type="button" disabled={!!error} onClick={() => { try { onLoad(analysisFromFen(value)); } catch { /* Display the validation message */ } }} className="min-h-10 w-full rounded-xl border border-amber-200/30 bg-gradient-to-br from-amber-200/15 via-[#211d16] to-violet-400/10 px-3 text-xs font-bold text-amber-100 hover:border-amber-200/60 disabled:cursor-not-allowed disabled:opacity-35">{words.apply}</button>
      <button type="button" onClick={onCancel} className="min-h-8 w-full text-xs text-neutral-400 hover:text-white">{words.cancel}</button>
    </footer>
  </section>;

  function onDraftFromStart() { onReset(DEFAULT_POSITION); }
}
