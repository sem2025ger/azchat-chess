import { useEffect, useId, useRef, useState } from 'react';
import { annotatedPgn, type PositionEvaluation } from '../../utils/positionMap';
import { ClipboardCopy, Share2, FileText, MoreHorizontal, RotateCcw, X, FolderOpen, Pencil, Plus, Minus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { mobileAnalysisCopy } from './mobileAnalysisCopy';
import { analysisCopy } from './copy';
import { formatFullAnalysisReport } from '../../utils/fullAnalysisReport';
import './desktopAnalysis.css';
import type { EngineResult } from '../../utils/StockfishEngine';

interface Props {
  title: string;
  initialFen: string;
  moveHistory: string[];
  currentFen: string;
  onNew: () => void;
  onEdit: () => void;
  editing: boolean;
  evaluations: Record<string, PositionEvaluation>;
  mobile?: boolean;
  onMobileTool?: (tool: 'map' | 'games' | 'position') => void;
  mobileDepth?: number;
  onMobileDepth?: (direction: -1 | 1) => void;
  currentResult?: EngineResult | null;
}

/** Presentation-only controls on top of the real analysis state. */
export default function AnalysisWorkspaceHeader({
  title, initialFen, moveHistory,
  currentFen, onNew, onEdit, editing, evaluations, mobile = false, onMobileTool, mobileDepth, onMobileDepth, currentResult,
}: Props) {
  const { language, t } = useLanguage();
  const words = mobileAnalysisCopy[language];
  const actionsId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsPosition, setActionsPosition] = useState({ top: 0, right: 12 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const closeActions = () => actionsRef.current?.hidePopover();
    window.addEventListener('resize', closeActions);
    window.addEventListener('scroll', closeActions, true);
    const closeOnDesktop = () => { if (media.matches) dialogRef.current?.close(); };
    media.addEventListener('change', closeOnDesktop);
    return () => {
      window.removeEventListener('resize', closeActions);
      window.removeEventListener('scroll', closeActions, true);
      media.removeEventListener('change', closeOnDesktop);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);
  const copy = async (label: string, value: string) => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(current => current === label ? null : current), 1800);
    } catch { setCopied(null); setCopyError(true); }
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
    else setCopyError(true);
  };
  const exportFull = () => {
    try { void copy('full', formatFullAnalysisReport({ initialFen, moves: moveHistory, currentFen, evaluations, currentResult: currentResult || null, title })); }
    catch { setCopyError(true); }
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
  if (mobile) return <>
    <button type="button" className="mobile-analysis-more" aria-label={words.more}
      aria-haspopup="dialog" onClick={() => { setCopyError(false); setCopied(null); dialogRef.current?.showModal(); }}>
      <MoreHorizontal size={22} aria-hidden="true"/>
    </button>
    <dialog ref={dialogRef} className="mobile-analysis-actions-dialog" aria-label={words.more}
      onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
      <header><h2>{words.more}</h2><button type="button" aria-label={words.close} onClick={() => dialogRef.current?.close()}><X size={20}/></button></header>
      {onMobileTool && <div className="mobile-analysis-action-list mobile-analysis-tool-actions">
        <button type="button" data-mobile-new-analysis onClick={() => { dialogRef.current?.close(); onNew(); }}>
          <RotateCcw size={18} aria-hidden="true"/>{t('game.analysis.new')}
        </button>
        {([
          { tool: 'games', label: analysisCopy[language].games, icon: FolderOpen },
          { tool: 'position', label: words.editor, icon: Pencil },
        ] as const).map(({ tool, label, icon: Icon }) => <button key={tool} type="button"
          data-mobile-tool={tool} aria-haspopup="dialog" onClick={() => { dialogRef.current?.close(); onMobileTool(tool); }}>
          <Icon size={18} aria-hidden="true"/>{label}
        </button>)}
      </div>}
      <div className="mobile-analysis-action-list">
        {onMobileDepth && mobileDepth !== undefined && <div className="mobile-analysis-depth-control" role="group" aria-label={words.deeper}>
          <span>{words.deeper} · {mobileDepth}</span>
          <button type="button" aria-label={words.lessDepth} disabled={mobileDepth <= 6} onClick={() => onMobileDepth(-1)}><Minus size={18}/></button>
          <button type="button" aria-label={words.moreDepth} disabled={mobileDepth >= 36} onClick={() => onMobileDepth(1)}><Plus size={18}/></button>
        </div>}
        <button type="button" onClick={exportFull}><FileText size={18}/>{words.fullReport}</button>
        <button type="button" disabled={!moveHistory.length} onClick={exportPgn}><FileText size={18}/>{words.pgn}</button>
        <button type="button" onClick={() => void copy('fen', currentFen)}><ClipboardCopy size={18}/>{words.fen}</button>
        <button type="button" onClick={() => void share()}><Share2 size={18}/>{words.share}</button>

      </div>
      <p role="status" className="mobile-analysis-copy-status">{copyError ? words.copyFailed : copied ? words.copied : ''}</p>
    </dialog>
  </>;
  return (
    <header className="analysis-redesign-header" aria-label={words.more}>
      <div className="analysis-redesign-actions">
        <button ref={actionsTrigger} type="button" className="desktop-analysis-more"
          aria-label={words.more} title={words.more} aria-expanded={actionsOpen}
          aria-controls={actionsId} popoverTarget={actionsId}
          onClick={() => {
            if (!actionsOpen) { setCopyError(false); setCopied(null); }
            const rect = actionsTrigger.current?.getBoundingClientRect();
            if (rect) setActionsPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
          }}>
          <MoreHorizontal size={21} aria-hidden="true" />
        </button>
        <div id={actionsId} ref={actionsRef} popover="auto" role="group" aria-label={words.more}
          className="desktop-analysis-actions-popover" style={actionsPosition}
          onToggle={event => {
            const open = event.newState === 'open';
            setActionsOpen(open);
            if (open) actionsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
          }}>
          <button type="button" onClick={() => void copy('fen', currentFen)}>
            <ClipboardCopy size={16} aria-hidden="true" />{words.fen}
          </button>
          <button type="button" aria-pressed={editing} onClick={() => {
            actionsRef.current?.hidePopover();
            onEdit();
          }}><Pencil size={16} aria-hidden="true" />{analysisCopy[language].editor}</button>
          <button type="button" onClick={() => void share()}><Share2 size={16} aria-hidden="true" />{words.share}</button>
          <button type="button" onClick={exportPgn} disabled={!moveHistory.length}>
            <FileText size={16} aria-hidden="true" />{words.pgn}
          </button>
          <p role="status" className="desktop-analysis-copy-status">{copyError ? words.copyFailed : copied ? words.copied : ''}</p>
        </div>
      </div>
    </header>
  );
}
