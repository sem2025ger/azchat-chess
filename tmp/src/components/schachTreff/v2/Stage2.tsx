import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Crown, RotateCcw, Settings2, Undo2, X } from 'lucide-react';
import { DEFAULT_POSITION } from 'chess.js';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { analysisFromPgn, validateAnalysisFen } from '../../../utils/analysisWorkspace';
import { loadAnalysisSession, saveAnalysisSession } from '../../../utils/analysisSession';
import { moderationEnabled, UnreadBadge } from '../unread';
import { useSchachTreffCopy } from '../copy';
import { canPickUp, countFullMoves, fenShapeOk, moveLine, playMove, positionReplyUnchanged, squareName, type ChatGameResult } from './core';
import { useV2Copy2 } from './copy2';
import { nameStyle } from './Parts';

const PIECE: Record<string, string> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

/** Board for chat messages and the game viewer. Read-only unless onSquare is given (position composer). */
export function MiniBoard({ fen, label, size = 248, onSquare, selected }: {
  fen: string; label: string; size?: number; onSquare?: (square: string) => void; selected?: string | null;
}) {
  const rows = fen.split(' ')[0].split('/');
  const cells: { key: string; square: string; light: boolean; piece: string | null }[] = [];
  rows.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++, file++) cells.push({ key: `${r}-${file}`, square: squareName(r, file), light: (r + file) % 2 === 0, piece: null });
      else { cells.push({ key: `${r}-${file}`, square: squareName(r, file), light: (r + file) % 2 === 0, piece: (ch === ch.toUpperCase() ? 'w' : 'b') + PIECE[ch.toLowerCase()] }); file++; }
    }
  });
  const image = (piece: string | null) => piece && <img src={`/pieces/classic/${piece}.svg`} alt="" draggable={false} />;
  if (onSquare) return <div className="st2-board st2-board-play" role="group" aria-label={label} style={{ width: size, height: size }}>
    {cells.map(cell => <button type="button" key={cell.key} aria-label={cell.square} aria-pressed={selected === cell.square}
      data-light={cell.light || undefined} onClick={() => onSquare(cell.square)}>{image(cell.piece)}</button>)}
  </div>;
  return <div className="st2-board" role="img" aria-label={label} style={{ width: size, height: size }}>
    {cells.map(cell => <span key={cell.key} data-light={cell.light || undefined}>{image(cell.piece)}</span>)}
  </div>;
}

export function sideToMoveIsWhite(fen: string) { return fen.split(' ')[1] !== 'b'; }

/** Opens the existing Analysis page (route /game) with a position or a finished game. */
export function useOpenAnalysis() {
  const navigate = useNavigate();
  return useCallback((input: { fen: string } | { pgn: string; initialFen?: string | null; ply?: number }) => {
    if ('fen' in input) saveAnalysisSession([], -1, undefined, input.fen);
    else {
      const parsed = analysisFromPgn(input.pgn, input.initialFen || DEFAULT_POSITION);
      const ply = input.ply !== undefined && input.ply >= 0 && input.ply < parsed.positionHistory.length ? input.ply : -1;
      saveAnalysisSession(parsed.moveHistory, ply, undefined, parsed.positionHistory[0]);
    }
    navigate('/game');
  }, [navigate]);
}

export function PositionMessage({ fen, onReply, size }: { fen: string; onReply: (fen: string) => void; size?: number }) {
  const copy = useV2Copy2();
  const open = useOpenAnalysis();
  const caption = copy.sideToMove(sideToMoveIsWhite(fen));
  return <div className="st2-position">
    <MiniBoard fen={fen} label={`${copy.position}: ${caption}`} size={size} />
    <small>{caption}</small>
    <div className="st2-card-actions">
      <button type="button" className="st2-secondary" onClick={() => onReply(fen)}>{copy.replyWithPosition}</button>
      <button type="button" className="st2-bronze-outline" onClick={() => open({ fen })}>{copy.openInAnalysis}</button>
    </div>
  </div>;
}

/**
 * The one position composer: a new position (reply=false) or a reply to a shared position (reply=true).
 * A reply starts from the referenced position; the player continues it with legal moves and/or a comment.
 */
export function PositionDialog({ initialFen, reply = false, onSend, onClose }: {
  initialFen: string; reply?: boolean; onSend: (fen: string, body: string) => Promise<boolean>; onClose: () => void;
}) {
  const copy = useV2Copy2();
  const t = useSchachTreffCopy();
  const dialog = useRef<HTMLDialogElement>(null);
  const [base, setBase] = useState(initialFen);
  const [line, setLine] = useState<{ fen: string; san: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const fen = line.at(-1)?.fen ?? base;
  const valid = useMemo(() => {
    try { const clean = validateAnalysisFen(fen); return fenShapeOk(clean) ? clean : null; } catch { return null; }
  }, [fen]);
  const moves = moveLine(base, line.map(move => move.san));
  const unchanged = positionReplyUnchanged(reply, line.length, caption);
  function load(next: string) { setBase(next); setLine([]); setSelected(null); }
  function pick(square: string) {
    if (!valid) return;
    if (selected && selected !== square) {
      const moved = playMove(valid, selected, square);
      if (moved) { setLine([...line, moved]); setSelected(null); return; }
    }
    setSelected(selected !== square && canPickUp(valid, square) ? square : null);
  }
  function fromAnalysis() {
    const session = loadAnalysisSession();
    const index = session.viewMoveIndex === -1 ? session.positionHistory.length - 1 : session.viewMoveIndex;
    const found = session.positionHistory[index];
    if (!session.moveHistory.length && found === DEFAULT_POSITION) { setNote(copy.noAnalysis); return; }
    setNote(''); load(found);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy || unchanged) return;
    setBusy(true);
    const sent = await onSend(valid, (caption.trim() || moves || copy.position).slice(0, 1200));
    setBusy(false);
    if (sent) onClose();
  }
  return <dialog ref={dialog} className="st2-modal" aria-labelledby="st2-position-title" onClose={onClose} onCancel={onClose}>
    <div className="st2-modal-head">
      <h2 id="st2-position-title">{reply ? copy.replyTitle : copy.positionTitle}</h2>
      <button type="button" className="st2-icon-button" aria-label={t.close} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <form className="st2-position-form" onSubmit={submit}>
      <div className="st2-position-preview">
        {valid ? <MiniBoard fen={valid} label={`${copy.position}: ${copy.sideToMove(sideToMoveIsWhite(valid))}`} size={224} onSquare={pick} selected={selected} />
          : <div className="st2-board st2-board-empty" style={{ width: 224, height: 224 }}><span>{copy.invalidFen}</span></div>}
        <div className="st2-line">
          <span>{moves || copy.boardHint}</span>
          <button type="button" className="st2-icon-button" aria-label={copy.undoMove} title={copy.undoMove} disabled={!line.length} onClick={() => { setLine(line.slice(0, -1)); setSelected(null); }}><Undo2 size={16} aria-hidden="true" /></button>
          <button type="button" className="st2-icon-button" aria-label={copy.resetPosition} title={copy.resetPosition} disabled={!line.length} onClick={() => load(base)}><RotateCcw size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="st2-position-fields">
        {!reply && <>
          <div className="st2-card-actions"><button type="button" className="st2-secondary" onClick={fromAnalysis}>{copy.fromAnalysis}</button></div>
          {note && <p role="status" className="st2-note">{note}</p>}
          <label>{copy.fenLabel}<input value={fen} maxLength={100} spellCheck={false} onChange={event => load(event.target.value)} aria-invalid={!valid} /></label>
        </>}
        <label>{copy.caption}<input value={caption} maxLength={1200} placeholder={copy.captionPlaceholder} onChange={event => setCaption(event.target.value)} /></label>
        {unchanged && <p role="status" className="st2-note">{copy.replyNeedsChange}</p>}
        <button className="st-send st2-primary" disabled={!valid || busy || unchanged}>{copy.sendPosition}</button>
      </div>
    </form>
  </dialog>;
}

function resultLabel(result: string, copy: ReturnType<typeof useV2Copy2>) {
  return result === '1-0' ? copy.whiteWins : result === '0-1' ? copy.blackWins : copy.draw;
}
const displayResult = (result: string) => result === '1/2-1/2' ? '½–½' : result.replace('-', '–');

export function GameResultCard({ game, kind, onWatch }: { game: ChatGameResult; kind: string; onWatch: () => void }) {
  const copy = useV2Copy2();
  const moves = countFullMoves(game.pgn);
  return <article className="st2-game-card" aria-label={`${game.white_name ?? '?'} – ${game.black_name ?? '?'} ${displayResult(game.result)}`}>
    <div className="st2-game-main">
      <small>{kind} {game.time_control} · {copy.gamePlayed}</small>
      <p>
        <span style={nameStyle(game.white_id ?? 'w')}>{game.white_name ?? '?'}</span>
        <span aria-hidden="true"> — </span>
        <span style={nameStyle(game.black_id ?? 'b')}>{game.black_name ?? '?'}</span>
      </p>
      <small>{moves ? copy.moves(moves) + ' · ' : ''}{resultLabel(game.result, copy)}</small>
    </div>
    <strong className="st2-game-score">{displayResult(game.result)}</strong>
    <button type="button" className="st2-secondary" onClick={onWatch} disabled={!game.pgn}>{copy.watchGame}</button>
  </article>;
}

export function GameViewer({ game, onClose }: { game: ChatGameResult; onClose: () => void }) {
  const copy = useV2Copy2();
  const t = useSchachTreffCopy();
  const open = useOpenAnalysis();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const parsed = useMemo(() => {
    try { return game.pgn ? analysisFromPgn(game.pgn, game.initial_fen || DEFAULT_POSITION) : null; } catch { return null; }
  }, [game.pgn, game.initial_fen]);
  const last = parsed ? parsed.positionHistory.length - 1 : 0;
  const [ply, setPly] = useState(last);
  const fen = parsed?.positionHistory[ply] ?? game.initial_fen ?? DEFAULT_POSITION;
  const go = (next: number) => setPly(Math.max(0, Math.min(last, next)));
  function keys(event: KeyboardEvent) {
    if ((event.target as HTMLElement).tagName === 'BUTTON' && event.key === 'Enter') return;
    const map: Record<string, number> = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: last };
    if (event.key in map) { event.preventDefault(); go(map[event.key]); }
  }
  const pairs: { number: number; white?: { san: string; ply: number }; black?: { san: string; ply: number } }[] = [];
  if (parsed) {
    const startBlack = parsed.positionHistory[0].split(' ')[1] === 'b';
    const firstNumber = Number(parsed.positionHistory[0].split(' ')[5]) || 1;
    parsed.moveHistory.forEach((san, index) => {
      const offset = index + (startBlack ? 1 : 0);
      const number = firstNumber + Math.floor(offset / 2);
      let row = pairs.find(pair => pair.number === number);
      if (!row) { row = { number }; pairs.push(row); }
      if (offset % 2 === 0) row.white = { san, ply: index + 1 }; else row.black = { san, ply: index + 1 };
    });
  }
  return <dialog ref={dialog} className="st2-modal st2-viewer" aria-labelledby="st2-viewer-title" onClose={onClose} onCancel={onClose} onKeyDown={keys}>
    <div className="st2-modal-head">
      <h2 id="st2-viewer-title">
        <span style={nameStyle(game.white_id ?? 'w')}>{game.white_name ?? '?'}</span> — <span style={nameStyle(game.black_id ?? 'b')}>{game.black_name ?? '?'}</span>
        <small> · {game.time_control} · {displayResult(game.result)}</small>
      </h2>
      <button type="button" className="st2-icon-button" aria-label={t.close} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    {!parsed ? <p>{copy.noMoves}</p> : <div className="st2-viewer-body">
      <div className="st2-viewer-board">
        <MiniBoard fen={fen} label={`${copy.viewer}: ${ply}/${last}`} size={320} />
        <div className="st2-viewer-nav" role="group" aria-label={copy.viewer}>
          <button type="button" aria-label={copy.first} onClick={() => go(0)} disabled={ply === 0}><ChevronsLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label={copy.previous} onClick={() => go(ply - 1)} disabled={ply === 0}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label={copy.next} onClick={() => go(ply + 1)} disabled={ply === last}><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" aria-label={copy.last} onClick={() => go(last)} disabled={ply === last}><ChevronsRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="st2-viewer-side">
        <ol className="st2-viewer-moves">{pairs.map(pair => <li key={pair.number}>
          <span>{pair.number}.</span>
          {pair.white ? <button type="button" aria-current={ply === pair.white.ply || undefined} onClick={() => go(pair.white!.ply)}>{pair.white.san}</button> : <span>…</span>}
          {pair.black && <button type="button" aria-current={ply === pair.black.ply || undefined} onClick={() => go(pair.black!.ply)}>{pair.black.san}</button>}
        </li>)}</ol>
        <p className="st2-viewer-result"><Crown size={15} aria-hidden="true" /> {resultLabel(game.result, copy)}</p>
        <button type="button" className="st2-bronze-outline" onClick={() => open({ pgn: game.pgn!, initialFen: game.initial_fen, ply })}>{copy.openInAnalysis}</button>
      </div>
    </div>}
  </dialog>;
}

export type DirectChat = { clubId: string; partnerId: string; partnerName: string };

/** Direct conversations of the signed-in player (two-member rooms of kind 'dm'). */
export function useDirectChats(userId: string | undefined) {
  const [chats, setChats] = useState<DirectChat[]>([]);
  const [available, setAvailable] = useState(false);
  const load = useCallback(async () => {
    if (!userId) { setChats([]); setAvailable(false); return; }
    const rooms = await supabase.from('chess_clubs').select('id,dm_key').eq('kind', 'dm').order('created_at', { ascending: false }).limit(100);
    if (rooms.error) { setAvailable(false); return; }
    const rows = (rooms.data ?? []) as { id: string; dm_key: string | null }[];
    const partners = rows.map(row => ({ clubId: row.id, partnerId: (row.dm_key ?? '').split(':').find(id => id && id !== userId) ?? '' })).filter(row => row.partnerId);
    const names = partners.length ? await supabase.from('profiles').select('id,username').in('id', partners.map(row => row.partnerId)) : { data: [], error: null };
    const byId = new Map(((names.data ?? []) as { id: string; username: string }[]).map(row => [row.id, row.username]));
    setAvailable(true);
    setChats(partners.map(row => ({ ...row, partnerName: byId.get(row.partnerId) ?? '…' })));
  }, [userId]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  return { chats, available, reload: load };
}

export function refusalMessage(error: unknown, copy: ReturnType<typeof useV2Copy2>): string | null {
  const message = (error as { message?: string } | null)?.message ?? '';
  return message in copy.refusals ? copy.refusals[message as keyof typeof copy.refusals] : null;
}

export function useOpenDirectChat() {
  const copy = useV2Copy2();
  const t = useSchachTreffCopy();
  const [error, setError] = useState('');
  const open = useCallback(async (userId: string) => {
    setError('');
    const result = await supabase.rpc('open_direct_chat', { p_user: userId });
    if (result.error || typeof result.data !== 'string') { setError(refusalMessage(result.error, copy) ?? t.error); return; }
    window.location.assign('/chat?club=' + result.data);
  }, [copy, t.error]);
  return { open, error, clear: () => setError('') };
}

export function DirectList({ currentClubId }: { currentClubId: string | null }) {
  const copy = useV2Copy2();
  const { user } = useAuth();
  const { chats, available } = useDirectChats(user?.id);
  const [settings, setSettings] = useState(false);
  if (!user || !available) return null;
  return <div className="st2-direct">
    <h2 className="st-club-heading">{copy.direct}</h2>
    {chats.length === 0 && <p className="st-club-empty">{copy.directEmpty}</p>}
    {chats.map(chat => <a key={chat.clubId} href={'/chat?club=' + chat.clubId} aria-current={currentClubId === chat.clubId ? 'page' : undefined} style={nameStyle(chat.partnerId)}>
      <span className="st2-dot" data-name aria-hidden="true" /><span className="st2-direct-name">{chat.partnerName}</span>
      {moderationEnabled && <UnreadBadge clubId={chat.clubId} />}
    </a>)}
    <button type="button" className="st2-settings-link" onClick={() => setSettings(true)}><Settings2 size={15} aria-hidden="true" />{copy.settings}</button>
    {settings && <ChatSettingsDialog onClose={() => setSettings(false)} />}
  </div>;
}

export function ChatSettingsDialog({ onClose }: { onClose: () => void }) {
  const copy = useV2Copy2();
  const t = useSchachTreffCopy();
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [policy, setPolicy] = useState<'all' | 'clubs' | 'none'>('all');
  const [hideGames, setHideGames] = useState(false);
  const [state, setState] = useState<'loading' | 'idle' | 'busy' | 'saved'>('loading');
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!user) return;
    let current = true;
    void supabase.from('chess_chat_settings').select('dm_policy,hide_games').eq('user_id', user.id).maybeSingle().then(result => {
      if (!current) return;
      const row = result.data as { dm_policy: 'all' | 'clubs' | 'none'; hide_games: boolean } | null;
      if (row) { setPolicy(row.dm_policy); setHideGames(row.hide_games); }
      if (result.error) setError(t.error);
      setState('idle');
    });
    return () => { current = false; };
  }, [user, t.error]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setState('busy'); setError('');
    const result = await supabase.rpc('set_chat_settings', { p_dm_policy: policy, p_hide_games: hideGames });
    if (result.error) { setError(t.error); setState('idle'); return; }
    setState('saved');
  }
  return <dialog ref={dialog} className="st2-modal" aria-labelledby="st2-settings-title" onClose={onClose} onCancel={onClose}>
    <div className="st2-modal-head">
      <h2 id="st2-settings-title">{copy.settingsTitle}</h2>
      <button type="button" className="st2-icon-button" aria-label={t.close} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <form className="st2-settings-form" onSubmit={save}>
      <fieldset disabled={state === 'loading' || state === 'busy'}>
        <legend>{copy.whoCanWrite}</legend>
        {([['all', copy.policyAll], ['clubs', copy.policyClubs], ['none', copy.policyNone]] as const).map(([value, label]) =>
          <label key={value}><input type="radio" name="st2-dm-policy" checked={policy === value} onChange={() => { setPolicy(value); setState('idle'); }} />{label}</label>)}
      </fieldset>
      <label className="st2-check"><input type="checkbox" checked={hideGames} disabled={state === 'loading'} onChange={event => { setHideGames(event.target.checked); setState('idle'); }} />{copy.hideGames}</label>
      {error && <p role="alert">{error}</p>}
      {state === 'saved' && <p role="status" className="st2-note">{copy.saved}</p>}
      <button className="st-send st2-primary" disabled={state === 'loading' || state === 'busy'}>{copy.save}</button>
    </form>
  </dialog>;
}

/** Blocking state for one partner, as seen by the signed-in player. */
export function useBlock(partnerId: string | undefined) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user || !partnerId) { setBlocked(false); return; }
    let current = true;
    void supabase.from('chess_user_blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', partnerId).maybeSingle()
      .then(result => { if (current && !result.error) setBlocked(Boolean(result.data)); });
    return () => { current = false; };
  }, [user, partnerId]);
  async function toggle() {
    if (!user || !partnerId || busy) return false;
    setBusy(true);
    const result = blocked
      ? await supabase.from('chess_user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', partnerId)
      : await supabase.from('chess_user_blocks').insert({ blocker_id: user.id, blocked_id: partnerId });
    setBusy(false);
    if (result.error) return false;
    setBlocked(!blocked);
    return true;
  }
  return { blocked, busy, toggle };
}
