import { useState } from 'react';
import { ClipboardCopy, Check, Share2, FileText } from 'lucide-react';

interface Props {
  title: string;
  white: string;
  black: string;
  timeControl?: string;
  initialFen: string;
  moveHistory: string[];
  currentFen: string;
  moveIndex: number;
  total: number;
  onNew: () => void;
}

/** Presentation-only controls on top of the real analysis state. */
export default function AnalysisWorkspaceHeader({
  title, white, black, timeControl, initialFen, moveHistory,
  currentFen, moveIndex, total, onNew,
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
      const historyGame = new Chess(initialFen);
      for (const move of moveHistory) historyGame.move(move);
      return historyGame.pgn();
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
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: title || 'ChessAZ — Анализ', url }); }
      catch { /* user canceled */ }
      return;
    }
    void copy('share', url);
  };
  return (
    <header className="analysis-redesign-header" aria-label="Панель анализа партии">
      <div className="analysis-redesign-heading">
        <div className="analysis-redesign-title">{title || 'Анализ позиции'}</div>
        <div className="analysis-redesign-meta">{white} — {black}{timeControl ? ` · ${timeControl}` : ''} · Ход {moveIndex} / {total}</div>
      </div>
      <div className="analysis-redesign-actions">
        <button type="button" onClick={exportPgn} disabled={!moveHistory.length} title="Копировать PGN текущей партии"><FileText size={14} />{copied === 'pgn' ? 'Скопировано' : 'PGN'}</button>
        <button type="button" onClick={() => void copy('fen', currentFen)} title="Копировать FEN выбранной позиции">{copied === 'fen' ? <Check size={14}/> : <ClipboardCopy size={14}/>} FEN</button>
        <button type="button" onClick={() => void share()} title="Поделиться ссылкой на страницу анализа"><Share2 size={14}/>{copied === 'share' ? 'Скопировано' : 'Поделиться'}</button>
        <button type="button" className="analysis-redesign-reset" onClick={onNew} title="Начать новый анализ">Новый анализ</button>
      </div>
    </header>
  );
}
