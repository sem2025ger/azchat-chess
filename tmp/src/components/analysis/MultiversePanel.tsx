import { useEffect, useRef, useState } from 'react';
import type { Chess } from 'chess.js';
import type { multiverseCopy } from '../../utils/multiverseCopy';
import { type MultiverseBranch, multiverseBranchPgn } from '../../utils/multiverse';
import { MultiverseEvaluator, type MultiverseScores, formatMultiverseDelta, formatMultiverseScore, multiversePositionsToScore, summarizeMultiverseBranches } from '../../utils/multiverseEvaluation';
import { multiverseShareUrl } from '../../utils/multiverseShare';

type Copy = (typeof multiverseCopy)['en'];
const COMPARE_DEPTH = 12;
const DEPTHS = [4, 8, 12, 16, 20];

export interface MultiversePanelProps {
  mw: Copy;
  playable: boolean;
  computerBranch: MultiverseBranch | null;
  computerGame: Chess | null;
  computerError: boolean;
  computerSide: 'w' | 'b';
  computerDepth: number;
  onSideChange: (side: 'w' | 'b') => void;
  onDepthChange: (depth: number) => void;
  onPlayFromHere: () => void;
  onRetry: () => void;
  onReturn: () => void;
  onSave: () => void;
  savedBranches: MultiverseBranch[];
  onOpen: (branch: MultiverseBranch) => void;
  onDelete: (id: string) => void;
  notice: string | null;
}

const button = 'rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-40';
const primary = 'rounded-lg border border-amber-200/40 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-200/20 disabled:opacity-40';

export default function MultiversePanel(props: MultiversePanelProps) {
  const { mw, playable, computerBranch, computerGame, computerError, computerSide, computerDepth, savedBranches } = props;
  const [scores, setScores] = useState<MultiverseScores>({});
  const [comparing, setComparing] = useState<string | null>(null); // rootFen under evaluation
  const [evalError, setEvalError] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const evaluator = useRef<MultiverseEvaluator | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { evaluator.current?.destroy(); evaluator.current = null; if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const flash = (text: string) => {
    setCopyNotice(text);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyNotice(null), 2500);
  };
  const copyText = (text: string, done: string) => {
    if (!navigator.clipboard?.writeText) { flash(mw.copyFailed); return; }
    navigator.clipboard.writeText(text).then(() => flash(done)).catch(() => flash(mw.copyFailed));
  };
  const share = (branch: MultiverseBranch) => {
    try { copyText(multiverseShareUrl(window.location.origin, window.location.pathname, branch), mw.linkCopied); }
    catch { flash(mw.copyFailed); }
  };
  const compare = (rootFen: string, branches: MultiverseBranch[]) => {
    setEvalError(false);
    setComparing(rootFen);
    if (!evaluator.current) {
      try {
        evaluator.current = new MultiverseEvaluator(COMPARE_DEPTH, (fen, score) => setScores(old => ({ ...old, [fen]: score })), () => { setEvalError(true); setComparing(null); }, () => setComparing(null));
      } catch { setEvalError(true); setComparing(null); return; }
    }
    evaluator.current.enqueue(multiversePositionsToScore(branches, scores));
  };

  const groups = new Map<string, MultiverseBranch[]>();
  for (const branch of savedBranches) groups.set(branch.rootFen, [...(groups.get(branch.rootFen) ?? []), branch]);
  const comparable = Array.from(groups.entries()).filter(([, list]) => list.length > 1);
  const thinking = !!computerBranch && !computerError && computerGame?.turn() !== computerSide && !computerGame?.isGameOver();

  return (
    <div className="w-full space-y-2 text-neutral-100">
      <section aria-label={mw.title} data-testid="multiverse-play" className="rounded-xl border border-amber-200/20 bg-[#17191e] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm">{mw.title}</strong>
          {computerBranch
            ? <button type="button" className={button} onClick={props.onReturn}>{mw.stop}</button>
            : <button type="button" className={primary} disabled={!playable} title={playable ? undefined : mw.notAvailable} onClick={props.onPlayFromHere}>{mw.start}</button>}
        </div>
        {!computerBranch && <div className="flex flex-wrap items-center gap-3 text-xs">
          <label>{mw.side} <select className="ml-1 rounded bg-neutral-800 p-2" value={computerSide} onChange={e => props.onSideChange(e.target.value as 'w' | 'b')}><option value="w">{mw.white}</option><option value="b">{mw.black}</option></select></label>
          <label>{mw.level} <select className="ml-1 rounded bg-neutral-800 p-2" value={computerDepth} onChange={e => props.onDepthChange(Number(e.target.value))}>{DEPTHS.map(depth => <option key={depth} value={depth}>{depth}</option>)}</select></label>
          {!playable && <span className="text-neutral-400">{mw.notAvailable}</span>}
        </div>}
        {computerBranch && <div className="space-y-2 text-xs">
          <div className="min-h-[1.25rem] break-words font-mono text-[11px] text-neutral-300" data-testid="multiverse-moves">{computerBranch.moves.join(' ') || '—'}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span role="status" className="text-neutral-300">{computerError ? '' : computerGame?.isGameOver() ? mw.ended : thinking ? mw.thinking : mw.yourMove}</span>
            <button type="button" className={button} onClick={props.onRetry}>{mw.retry}</button>
            <button type="button" className={primary} disabled={computerBranch.moves.length === 0} onClick={props.onSave}>{mw.save}</button>
          </div>
        </div>}
        {computerError && <p role="alert" className="text-xs text-red-300">{mw.error}</p>}
        {props.notice && <p role="status" className="text-xs text-amber-100">{props.notice}</p>}
      </section>

      <section aria-label={mw.variations} data-testid="multiverse-variations" className="rounded-xl border border-white/10 bg-[#17191e] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm">{mw.variations} ({savedBranches.length})</strong>
          {copyNotice && <span role="status" className="text-xs text-amber-100">{copyNotice}</span>}
        </div>
        {savedBranches.length === 0 && <p className="text-xs text-neutral-400">{mw.empty}</p>}
        <ul className="space-y-1 text-xs">
          {savedBranches.map(branch => <li key={branch.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/5 px-2 py-1">
            <span className="min-w-0 truncate" title={branch.moves.join(' ')}>{branch.label} · {branch.moves.length} {mw.plies}</span>
            <span className="flex flex-wrap gap-1">
              <button type="button" className={button} onClick={() => props.onOpen(branch)}>{mw.load}</button>
              <button type="button" className={button} onClick={() => share(branch)}>{mw.link}</button>
              <button type="button" className={button} onClick={() => { try { copyText(multiverseBranchPgn(branch), mw.pgnCopied); } catch { flash(mw.copyFailed); } }}>{mw.share}</button>
              <button type="button" className={button} onClick={() => props.onDelete(branch.id)}>{mw.delete}</button>
            </span>
          </li>)}
        </ul>
        {savedBranches.length > 0 && comparable.length === 0 && <p className="text-xs text-neutral-400">{mw.compareHint}</p>}
        {comparable.map(([rootFen, list]) => {
          const rows = summarizeMultiverseBranches(list, scores);
          const busy = comparing === rootFen;
          const started = rows.some(row => row.score) || busy;
          return <div key={rootFen} data-testid="multiverse-compare" className="rounded border border-white/10 p-2 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-300">{mw.sameRoot}: {list.length}</span>
              <button type="button" className={primary} disabled={busy} onClick={() => compare(rootFen, list)}>{busy ? mw.evaluating : mw.compare}</button>
            </div>
            {started && <table className="w-full text-left"><thead className="text-neutral-400"><tr><th className="pr-2 font-normal">{mw.branch}</th><th className="pr-2 font-normal">{mw.evaluation}</th><th className="pr-2 font-normal">{mw.delta}</th><th className="font-normal">{mw.critical}</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.id} data-testid="multiverse-compare-row">
                <td className="pr-2">{row.label}</td>
                <td className="pr-2 font-mono">{formatMultiverseScore(row.score)}</td>
                <td className="pr-2 font-mono">{row.deltaFromRoot === undefined ? '…' : formatMultiverseDelta(row.deltaFromRoot)}</td>
                <td>{row.pendingPositions > 0 ? '…' : row.critical ? `${row.critical.moveNumber}${row.critical.mover === 'w' ? '.' : '…'} ${row.critical.san} (−${row.critical.loss.toFixed(2)})` : mw.noMistake}</td>
              </tr>)}</tbody></table>}
          </div>;
        })}
        {evalError && <p role="alert" className="text-xs text-red-300">{mw.evalError}</p>}
      </section>
    </div>
  );
}
