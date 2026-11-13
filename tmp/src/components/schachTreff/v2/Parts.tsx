import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Lightbulb, Mail, MessageSquare, SendHorizontal, Timer, X } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { useChallengeControls } from '../Challenges';
import { useSchachTreffCopy } from '../copy';
import { useV2Copy } from './copy';
import { useV2Copy2 } from './copy2';
import {
  REACTIONS, SEEK_CONTROLS, isMissingSchema, nameColor, readLastSeek, recentlyActive, writeLastSeek,
  type Reaction, type ReactionSummary, type SeekControl,
} from './core';
import './v2.css';

type Person = { id: string; username: string };
const safeStorage = () => { try { return window.localStorage; } catch { return null; } };

export function nameStyle(userId: string): CSSProperties {
  return { '--st-name': nameColor(userId) } as CSSProperties;
}

/** Accessible position control with a visible mouse/keyboard hint and a delayed touch hint. */
export function PositionTrigger({ label, onClick }: { label: string; onClick: () => void }) {
  const [longPress, setLongPress] = useState(false);
  const pressTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);
  const stopPress = () => {
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setLongPress(false), 1600);
  };
  return <button type="button" className={longPress ? 'st2-position-trigger st2-hint-visible' : 'st2-position-trigger'}
    data-hint={label} aria-label={label} title={label} onClick={onClick}
    onTouchStart={() => {
      window.clearTimeout(pressTimer.current);
      window.clearTimeout(hideTimer.current);
      setLongPress(false);
      pressTimer.current = window.setTimeout(() => setLongPress(true), 550);
    }}
    onTouchEnd={stopPress}
    onTouchCancel={() => { window.clearTimeout(pressTimer.current); setLongPress(false); }}>
    <MiniBoardIcon />
  </button>;
}

/** 4×4 board in the ChessAZ board colours: the composer's "send a position" icon. */
export function MiniBoardIcon() {
  const dark = [[4, 0], [12, 0], [0, 4], [8, 4], [4, 8], [12, 8], [0, 12], [8, 12]];
  return <svg className="st2-mini-board" width="22" height="22" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect width="16" height="16" rx="2" fill="#D8C3A0" />
    {dark.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" fill="#A27A55" />)}
    <rect x=".5" y=".5" width="15" height="15" rx="1.5" fill="none" stroke="#D4A373" />
  </svg>;
}

/** Composer button: one tap opens time controls, a second tap posts an open challenge card. */
export function SeekButton() {
  const controls = useChallengeControls();
  const copy = useV2Copy();
  const copy2 = useV2Copy2();
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<SeekControl>(() => readLastSeek(safeStorage()));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  if (!controls?.available) return null;
  const limit = controls.openOffers >= 3;
  async function pick(value: SeekControl) {
    if (!controls || controls.busy || limit) return;
    writeLastSeek(safeStorage(), value); setLast(value);
    if (await controls.seek(value)) setOpen(false);
  }
  return <div className="st2-seek" ref={box}>
    <button type="button" className="st2-seek-trigger" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
      <Timer size={17} aria-hidden="true" /><span className="st2-seek-label">{copy.seek}</span>
    </button>
    {open && <div className="st2-seek-popover" role="group" aria-label={copy.seek}>
      <p>{limit ? copy.seekLimit : copy.seekHint}</p>
      <div className="st2-seek-grid">{SEEK_CONTROLS.map(control =>
        <button type="button" key={control.value} aria-pressed={control.value === last} disabled={controls.busy || limit}
          onClick={() => void pick(control.value)}>
          <strong>{control.value}</strong><small>{control.kind === 'bullet' ? copy2.bullet : control.kind === 'blitz' ? copy.blitz : copy.rapid}</small>
        </button>)}
      </div>
    </div>}
  </div>;
}

export function ReactionBar({ summary, replies, onToggle, onThread }: {
  summary: ReactionSummary[]; replies: number; onToggle: (reaction: Reaction, mine: boolean) => void; onThread: () => void;
}) {
  const copy = useV2Copy();
  if (!summary.length && !replies) return null;
  return <div className="st2-reaction-row">
    {summary.map(item => <button type="button" key={item.reaction} className="st2-reaction" aria-pressed={item.mine}
      aria-label={`${copy.reactionNames[item.reaction]} (${item.reaction}): ${item.count}`}
      onClick={() => onToggle(item.reaction, item.mine)}><b>{item.reaction}</b><span>{item.count}</span></button>)}
    {replies > 0 && <button type="button" className="st2-replies" onClick={onThread}>{copy.replies(replies)} →</button>}
  </div>;
}

export function MessageTools({ summary, onToggle, onThread }: {
  summary: ReactionSummary[]; onToggle: (reaction: Reaction, mine: boolean) => void; onThread?: () => void;
}) {
  const copy = useV2Copy();
  return <div className="st2-tools" role="group" aria-label={copy.reactions}>
    {REACTIONS.map(reaction => {
      const mine = summary.some(item => item.reaction === reaction && item.mine);
      return <button type="button" key={reaction} aria-pressed={mine} title={copy.reactionNames[reaction]}
        aria-label={`${copy.reactionNames[reaction]} (${reaction})`} onClick={() => onToggle(reaction, mine)}>{reaction}</button>;
    })}
    {onThread && <button type="button" className="st2-tool-thread" title={copy.reply} aria-label={copy.reply} onClick={onThread}>
      <MessageSquare size={15} aria-hidden="true" /></button>}
  </div>;
}

export function MembersPanel({ members, messages, me, onlineIds, onPlayer, onMessage }: {
  members: Person[]; messages: { author_id: string; created_at: string }[]; me?: string;
  onlineIds?: string[] | null; onPlayer: (person: Person) => void;
  onMessage?: (person: Person) => void;
}) {
  const copy = useV2Copy();
  const copy2 = useV2Copy2();
  const t = useSchachTreffCopy();
  const challenges = useChallengeControls();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const recent = recentlyActive(messages, now);
  const online = new Set(onlineIds ?? []);
  const active = (id: string) => onlineIds ? online.has(id) : recent.has(id);
  const sorted = [...members].sort((a, b) => Number(active(b.id)) - Number(active(a.id)) || a.username.localeCompare(b.username));
  const offer = challenges?.available
    ? challenges.rows.find(row => row.status === 'open' && !row.target_user_id && row.created_by !== me && Date.parse(row.expires_at) > now)
    : undefined;
  const offerPlayer = offer && members.find(person => person.id === offer.created_by);
  return <aside className="st-surface st2-side" aria-label={copy.members}>
    <h2 className="st2-side-title">{copy.members}</h2>
    {offer && <div className="st2-seeking-card">
      <span className="st2-seeking-kicker">{copy.seeking}</span>
      <div className="st2-seeking-action">
        <span><strong style={nameStyle(offer.created_by)}>{offerPlayer?.username ?? copy.seeking}</strong> · {offer.time_control}</span>
        <button type="button" disabled={challenges?.busy} onClick={() => challenges?.act('accept', offer.id)}>{t.accept}</button>
      </div>
    </div>}
    <p className="st2-members-label">{copy.onlineInChat}{onlineIds ? ` · ${sorted.filter(person => online.has(person.id)).length}` : ''}</p>
    <ul className="st2-members">{sorted.map(person => <li key={person.id} style={nameStyle(person.id)}>
      <span className="st2-dot" data-active={active(person.id) || undefined} title={active(person.id) ? copy.activeNow : undefined} aria-hidden="true" />
      <button type="button" className="st2-member-name" onClick={() => onPlayer(person)}>
        {person.username}{active(person.id) && <span className="sr-only"> · {copy.activeNow}</span>}
      </button>
      {person.id !== me && challenges?.available && <button type="button" className="st2-icon-small"
        aria-label={`${copy.challenge}: ${person.username}`} title={copy.challenge} onClick={() => challenges.open(person.id)}>
        <Timer size={15} aria-hidden="true" /></button>}
      {person.id !== me && onMessage && <button type="button" className="st2-icon-small" aria-label={`${copy2.writePrivately}: ${person.username}`}
        title={copy2.writePrivately} onClick={() => onMessage(person)}><Mail size={15} aria-hidden="true" /></button>}
    </li>)}</ul>
  </aside>;
}

type Reply = { id: string; author_id: string; body: string | null; created_at: string; deleted_at?: string | null; fen?: string | null };
export function ThreadPanel({ clubId, root, people, onClose, onChanged, revision = 0, rootFen, renderPosition, scrollToEnd = false, onScrolled }: {
  clubId: string; root: { id: string; author_id: string; body: string | null };
  people: Person[]; onClose: () => void; onChanged: () => void;
  /** Stage 2: bump to reload after a position reply; positions of the root and replies are drawn by renderPosition. */
  revision?: number; rootFen?: string; renderPosition?: (fen: string) => ReactNode;
  /** After the next load, scroll the panel to the newest reply (set by the parent after sending a position reply). */
  scrollToEnd?: boolean; onScrolled?: () => void;
}) {
  const copy = useV2Copy();
  const t = useSchachTreffCopy();
  const { user } = useAuth();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const justLoaded = useRef(false);
  async function load() {
    const current = ++version.current;
    const select = (columns: string) => supabase.from('chess_club_messages').select(columns)
      .eq('club_id', clubId).eq('parent_id', root.id).order('created_at', { ascending: true }).limit(200);
    const columns = 'id,author_id,body,created_at,deleted_at';
    let result = await select(renderPosition ? columns + ',fen' : columns);
    // Stage 2 migration not applied yet: replies still load, without positions.
    if (renderPosition && result.error && isMissingSchema(result.error.code)) result = await select(columns);
    if (current !== version.current) return;
    if (result.error) { setError(t.error); return; }
    const rows = (result.data ?? []) as unknown as Reply[];
    justLoaded.current = true;
    setReplies(rows); setError('');
    const missing = [...new Set(rows.map(row => row.author_id))].filter(id => !people.some(person => person.id === id));
    if (missing.length) {
      const found = await supabase.from('profiles').select('id,username').in('id', missing);
      if (!found.error && current === version.current) setNames(Object.fromEntries((found.data ?? []).map(row => [row.id, row.username])));
    }
  }
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 12000);
    return () => { version.current++; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, root.id, revision]);
  useEffect(() => {
    if (!justLoaded.current) return;
    justLoaded.current = false;
    if (!scrollToEnd || !panel.current) return;
    panel.current.scrollTop = panel.current.scrollHeight;
    onScrolled?.();
  }, [replies, scrollToEnd, onScrolled]);
  const name = (id: string) => people.find(person => person.id === id)?.username ?? names[id] ?? '…';
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!user || busy || !text) return;
    setBusy(true); setError('');
    const result = await supabase.from('chess_club_messages').insert({ club_id: clubId, author_id: user.id, body: text, parent_id: root.id });
    setBusy(false);
    if (result.error) { setError(t.error); return; }
    setBody(''); await load(); onChanged();
  }
  return <aside ref={panel} className="st-surface st2-side st2-thread" aria-label={copy.thread}>
    <div className="st2-thread-head">
      <h2 className="st2-side-title">{copy.thread}</h2>
      <button type="button" className="st2-icon-button" aria-label={copy.closeThread} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <blockquote className="st2-thread-root" style={nameStyle(root.author_id)}>
      <strong>{name(root.author_id)}</strong><p>{root.body ?? t.deleted}</p>
      {rootFen && renderPosition?.(rootFen)}
    </blockquote>
    <p className="st2-thread-count">{replies.length ? copy.replies(replies.length) : copy.noReplies}</p>
    <ol className="st2-thread-list">{replies.map(reply => <li key={reply.id} style={nameStyle(reply.author_id)}>
      <span className="st2-thread-author">{name(reply.author_id)}</span>
      <time dateTime={reply.created_at}>{new Date(reply.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time>
      <p>{reply.deleted_at ? t.deleted : reply.body}</p>
      {!reply.deleted_at && reply.fen && renderPosition && <div className="st2-thread-position">{renderPosition(reply.fen)}</div>}
    </li>)}</ol>
    {error && <p role="alert">{error}</p>}
    <form className="st2-thread-form" onSubmit={send}>
      <input aria-label={copy.replyPlaceholder} placeholder={copy.replyPlaceholder} value={body} maxLength={1200}
        onChange={event => setBody(event.target.value)} />
      <button className="st-send" aria-label={copy.send} disabled={busy || !body.trim()}><SendHorizontal size={18} aria-hidden="true" /></button>
    </form>
  </aside>;
}

export function FeedbackButton() {
  const copy = useV2Copy();
  const t = useSchachTreffCopy();
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState('');
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (state === 'busy') return;
    if (!user) { setError(copy.feedbackLogin); return; }
    if (body.trim().length < 3) { setError(copy.feedbackShort); return; }
    setState('busy'); setError('');
    const result = await supabase.rpc('submit_chessaz_feedback', { p_body: body.trim(), p_page: window.location.pathname });
    if (result.error) {
      setState('idle');
      setError(result.error.message === 'feedback_limit' ? copy.feedbackLimit : result.error.message === 'invalid_feedback' ? copy.feedbackShort : t.error);
      return;
    }
    setState('sent'); setBody('');
  }
  return <>
    <button type="button" className="st2-feedback" onClick={() => { setOpen(true); setState('idle'); setError(''); }}>
      <Lightbulb size={16} aria-hidden="true" />{copy.feedbackButton}
    </button>
    <dialog ref={dialog} className="st2-feedback-dialog" aria-labelledby="st2-feedback-title" onClose={() => setOpen(false)} onCancel={() => setOpen(false)}>
      <div className="st2-thread-head">
        <h2 id="st2-feedback-title">{copy.feedbackTitle}</h2>
        <button type="button" className="st2-icon-button" aria-label={t.close} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
      </div>
      {state === 'sent' ? <p role="status">{copy.feedbackThanks}</p> : <form onSubmit={send}>
        <textarea aria-label={copy.feedbackButton} placeholder={copy.feedbackPlaceholder} value={body} maxLength={2000}
          onChange={event => setBody(event.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button className="st-send" disabled={state === 'busy'}>{copy.send}</button>
      </form>}
    </dialog>
  </>;
}
