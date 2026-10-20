import { useState } from 'react';
import { annotatedPgn, type PositionEvaluation } from '../../utils/positionMap';
import { ClipboardCopy, Check, Share2, FileText } from 'lucide-react';

interface Props {
  title: string;
  initialFen: string;
  moveHistory: string[];
  currentFen: string;
  onNew: () => void;
  onEdit: () => void;
  editing: boolean;
  evaluations: Record<string, PositionEvaluation>;
}

/** Presentation-only controls on top of the real analysis state. */
export default function AnalysisWorkspaceHeader({
  title, initialFen, moveHistory,
  currentFen, onNew, onEdit, editing, evaluations,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(current => current === label ? null : current), 1800);
    } catch { setCopied(null); }
  };
  const buildPgn = () => {
    try {
      return annotatedPgn(initialFen, moveHistory, evaluations);
    } catch {
      // Never present incomplete/incorrect PGN as a successful export.
      return null;
    }
  };
  const exportPgn = () => {
    const pgn = buildPgn();
    if (pgn !== null) void copy('pgn', pgn);
  };
  const share = async () => {
    const shared = new URL(window.location.href);
    shared.searchParams.delete('roomId');
    shared.searchParams.delete('color');
    shared.searchParams.set('fen', currentFen);
    const url = shared.toString();
    if (navigator.share) {
      try { await navigator.share({ title: title || 'ChessAZ — Анализ', url }); }
      catch { /* user canceled */ }
      return;
    }
    void copy('share', url);
  };
  return (
    <header className="analysis-redesign-header" aria-label="Панель анализа партии">
      <div className="analysis-redesign-actions">
        <button type="button" onClick={exportPgn} disabled={!moveHistory.length} title="Копировать PGN с оценками рассчитанных позиций"><FileText size={14} />{copied === 'pgn' ? 'Скопировано' : 'PGN с оценками'}</button>
        <button type="button" onClick={() => void copy('fen', currentFen)} title="Копировать FEN выбранной позиции">{copied === 'fen' ? <Check size={14}/> : <ClipboardCopy size={14}/>} FEN</button>
        <button type="button" className="hidden lg:inline-flex" aria-pressed={editing} onClick={onEdit}>Редактор доски</button>
        <button type="button" onClick={() => void share()} title="Поделиться ссылкой на страницу анализа"><Share2 size={14}/>{copied === 'share' ? 'Скопировано' : 'Поделиться'}</button>
        <button type="button" className="analysis-redesign-reset" onClick={onNew} title="Начать новый анализ">Новый анализ</button>
      </div>
    </header>
  );
}
