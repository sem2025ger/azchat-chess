import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Swords } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { supabase } from '../../services/supabase';
import { useSchachTreffCopy } from './copy';
import { useV2Copy2 } from './v2/copy2';
import { useV2Copy } from './v2/copy';
import { ROOM_ID, gamePath, ownStartedGame } from './challengeRouting';
import { v2Enabled } from './v2/core';
import { Toast } from './v2/Toast';
type Person = { id: string; username: string };
type Challenge = { id: string; message_id: string; created_by: string; target_user_id: string | null; time_control: string; status: string; expires_at: string; room_id: string | null; accepted_by?: string | null };
type Controls = { now: number; available: boolean; me: string; rows: Challenge[]; people: Person[]; busy: boolean; open: (target?: string) => void; act: (action: 'accept' | 'cancel', id: string) => void; seek: (time: string) => Promise<boolean>; openOffers: number; finished: ReadonlySet<string>; mobileV2?: boolean };
const Context = createContext<Controls | null>(null);
const NONE: ReadonlySet<string> = new Set();
/** finished: challenge ids whose game already has a result card (no "Open game" link for a game that is over). */
export function ChallengeProvider({ clubId, me, people, enabled, finished = NONE, children, mobileV2 = false, activeIds }: { clubId: string | null; me: string; people: Person[]; enabled: boolean; finished?: ReadonlySet<string>; children: ReactNode; mobileV2?: boolean; activeIds?: ReadonlySet<string> }) {
  const t=useSchachTreffCopy();
  const mobileCopy=useV2Copy2(), v2Copy=useV2Copy();
  const { socket, isConnected } = useSocket(), navigate = useNavigate();
  const [now,setNow]=useState(() => Date.now());
  const [rows,setRows] = useState<Challenge[]>([]), [available,setAvailable] = useState(false);
  const [target,setTarget] = useState(''), [personal,setPersonal] = useState(false), [time,setTime] = useState('3+2');
  const [shown,setShown] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), warned = useRef(false);
  // Offers created in THIS tab (first seen right after its own create call) and games already opened here.
  const knownOwn = useRef(new Set<string>()), createdHere = useRef(new Set<string>()), opened = useRef(new Set<string>()), creating = useRef(false);
  const load = useCallback(async () => {
    if (!enabled || !clubId) { setRows([]); setAvailable(false); return; }
    const result = await supabase.from('chess_club_challenges').select('id,message_id,created_by,target_user_id,time_control,status,expires_at,room_id,accepted_by').eq('club_id',clubId).order('created_at',{ascending:false}).limit(100);
    if (result.error) {
      if (['42P01','PGRST205','42703','PGRST204'].includes(result.error.code)) {
        setAvailable(false);
        if (!warned.current) { warned.current=true; console.warn('Schach-Treff challenges unavailable:',result.error.code); }
      } else setError(t.error);
      return;
    }
    const loaded = result.data as Challenge[];
    setNow(Date.now()); setAvailable(true); setRows(loaded);
    for (const row of loaded) if (row.created_by===me && !knownOwn.current.has(row.id)) {
      knownOwn.current.add(row.id);
      if (creating.current && row.status==='open') createdHere.current.add(row.id);
    }
    const roomId = ownStartedGame(loaded, me, createdHere.current, opened.current);
    if (roomId) { opened.current.add(roomId); navigate(gamePath(roomId)); }
  },[clubId,enabled,me,navigate]);
  useEffect(() => {
    void load();
    const poll=() => {
      if (document.hidden) return;
      if (enabled && clubId && isConnected && socket) socket.timeout(8000).emit('club_challenge_watch',{clubId},() => { void load(); });
      else void load();
    };
    const timer=window.setInterval(poll,12000);
    const changed=(event: { clubId?: string }) => { if (event.clubId===clubId) void load(); };
    const found=(event: { roomId?: string; color?: string }) => {
      if (typeof event.roomId==='string' && ROOM_ID.test(event.roomId) && ['w','b'].includes(event.color ?? '')) {
        opened.current.add(event.roomId); navigate(`/play?roomId=${event.roomId}&color=${event.color}`);
      }
    };
    socket?.on('club_challenges_changed',changed); socket?.on('match_found',found);
    if (enabled && clubId && isConnected) socket?.emit('club_challenge_watch',{clubId});
    return () => { window.clearInterval(timer); socket?.off('club_challenges_changed',changed); socket?.off('match_found',found); };
  },[load,socket,clubId,enabled,isConnected,navigate]);
  useEffect(() => { if (shown) dialog.current?.showModal(); else dialog.current?.close(); },[shown]);
  async function request(action: 'create' | 'accept' | 'cancel', payload: object): Promise<boolean> {
    if (!socket || !isConnected || busy) return false;
    setBusy(true); setError('');
    if (action==='create') creating.current = true;
    try {
      const response=await new Promise<{ ok: boolean; reason?: string }>((resolve,reject) => {
        socket.timeout(10000).emit('club_challenge_'+action,payload,(timeout: Error | null,result: { ok: boolean; reason?: string }) => timeout ? reject(timeout) : resolve(result));
      });
      if (!response?.ok) { creating.current = false; setError(t.challengeErrors[response?.reason as keyof typeof t.challengeErrors] ?? t.error); return false; }
      if (action==='create') setShown(false);
      await load();
      creating.current = false;
      return true;
    } catch { creating.current = false; setError(t.error); return false; } finally { setBusy(false); }
  }
  const controls: Controls={ now,available:available && isConnected,me,rows,people,busy,open(id) { setTarget(id ?? ''); setPersonal(Boolean(id)); setError(''); setShown(true); },act(action,id) { void request(action,{challengeId:id}); },
    seek: time => request('create',{clubId,timeControl:time,targetUserId:null}),
    openOffers: rows.filter(row => row.created_by===me && row.status==='open' && Date.parse(row.expires_at)>now).length, finished, mobileV2 };
  return <Context.Provider value={controls}>{children}{error && !shown && (v2Enabled ? <Toast message={error} closeLabel={t.close} onClose={() => setError('')} /> : <p role="alert">{error}</p>)}
    <dialog aria-label={t.challenge} ref={dialog} className={mobileV2 ? 'st-mobile-sheet st-mobile-challenge' : undefined} onCancel={() => setShown(false)} onClose={() => setShown(false)}>
      <h2>{t.challenge}</h2><form onSubmit={event => { event.preventDefault(); if (mobileV2 && personal && !people.some(person => person.id === target && person.id !== me)) return; void request('create',{clubId,timeControl:time,targetUserId:personal ? target : null}); }}>
        {mobileV2 ? <>
          <fieldset className="st-mobile-challenge-kind"><legend>{t.challengeKind}</legend><button type="button" aria-pressed={!personal} onClick={() => setPersonal(false)}>{mobileCopy.openShort}</button><button type="button" aria-pressed={personal} onClick={() => setPersonal(true)}>{mobileCopy.personalShort}</button></fieldset>
          {personal && <fieldset className="st-mobile-opponents"><legend>{t.targetPlayer}</legend>{people.filter(person => person.id !== me).sort((a,b) => Number(Boolean(activeIds?.has(b.id))) - Number(Boolean(activeIds?.has(a.id))) || a.username.localeCompare(b.username)).map(person => <button type="button" key={person.id} aria-pressed={target === person.id} onClick={() => setTarget(person.id)}>{person.username}</button>)}{!people.some(person => person.id !== me) && <p>{t.noMembers}</p>}</fieldset>}
          <fieldset className="st-mobile-times"><legend>{t.timeControl}</legend>{['3+2','5+0','10+0'].map(value => <button type="button" key={value} aria-pressed={time === value} onClick={() => setTime(value)}><strong>{value}</strong><small>{value === '10+0' ? v2Copy.rapid : v2Copy.blitz}</small></button>)}</fieldset>
          <p className="st-mobile-challenge-summary">{personal ? mobileCopy.personalShort : mobileCopy.openShort} · {time} · {mobileCopy.challengeExpiry}</p>
        </> : <><fieldset><legend>{t.challengeKind}</legend>
          <label><input name="challenge-kind" type="radio" checked={!personal} onChange={() => setPersonal(false)} />{t.openChallenge}</label>
          <label><input name="challenge-kind" type="radio" checked={personal} onChange={() => setPersonal(true)} />{t.personalChallenge}</label>
        </fieldset>
        {personal && <label>{t.targetPlayer}<select value={target} onChange={event => setTarget(event.target.value)} required><option value="">{t.choosePlayer}</option>{people.filter(person => person.id!==me).map(person => <option key={person.id} value={person.id}>{person.username}</option>)}</select></label>}
        <label>{t.timeControl}<select value={time} onChange={event => setTime(event.target.value)}>{['3+2','5+0','10+0'].map(value => <option key={value}>{value}</option>)}</select></label></>}
        {error && <p role="alert">{error}</p>}
        <button className={mobileV2 ? 'st-mobile-primary' : undefined} disabled={busy || (personal && (!target || (mobileV2 && !people.some(person => person.id === target && person.id !== me)))) || rows.filter(row => row.created_by===me && row.status==='open' && Date.parse(row.expires_at)>now).length>=3}>{t.sendChallenge}</button>
        <button type="button" className={mobileV2 ? 'st-mobile-secondary' : undefined} onClick={() => setShown(false)}>{t.cancel}</button>
      </form>
    </dialog>
  </Context.Provider>;
}
export function ChallengeButton({ targetUserId,beforeOpen,icon,composer,disabled=false,play=false }: { targetUserId?: string; beforeOpen?: () => void; icon?: boolean; composer?: boolean; disabled?: boolean; play?: boolean }) {
  const t=useSchachTreffCopy();
  const context=useContext(Context);
  const copy2=useV2Copy2();
  if (play) return <button type="button" className="st-mobile-play" disabled={disabled || !context?.available || targetUserId === context?.me} onClick={() => context?.open(targetUserId)}><Swords size={17} aria-hidden="true" />{copy2.play}</button>;
  if (!context?.available || targetUserId===context.me) return null;
  return <button type="button" className={icon ? 'st-challenge-icon' : composer ? 'st-composer-challenge' : undefined}
    aria-label={icon || composer ? t.challengePlayer : undefined} title={composer ? t.challengePlayer : undefined} disabled={disabled} onClick={() => { beforeOpen?.(); context.open(targetUserId); }}>
    {icon ? <Swords size={16} aria-hidden="true" /> : composer
      ? <><Swords className="st-composer-challenge-icon" size={18} aria-hidden="true" /><span className="st-composer-challenge-label">{t.challengePlayer}</span></>
      : t.challengeAction}
  </button>;
}
export function useChallengeControls() { return useContext(Context); }
export function useChallengeMessageIds(): ReadonlySet<string> {
  const context = useContext(Context);
  return new Set(context?.rows.map(row => row.message_id) ?? []);
}
export function ChallengeMessage({ messageId,body }: { messageId: string; body: string }) {
  const context=useContext(Context), row=context?.rows.find(item => item.message_id===messageId);
  if (!context || !row) return <p>{body}</p>;
  return <ChallengeCard now={context.now} row={row} me={context.me} people={context.people} busy={context.busy} act={context.act} finished={context.finished.has(row.id)} mobileV2={context.mobileV2} />;
}
export function ChallengeCard({now,row,me,people,busy,act,finished=false,mobileV2=false}: {now: number; row: Challenge; me: string; people: Person[]; busy: boolean; act: Controls['act']; finished?: boolean; mobileV2?: boolean}) {
  const t=useSchachTreffCopy();
  const expired=row.status==='expired' || (row.status==='open' && Date.parse(row.expires_at)<=now);
  const name=(id: string) => people.find(person => person.id===id)?.username ?? t.targetPlayer;
  const heading = expired ? t.challengeExpired : row.status==='cancelled' ? t.challengeCancelled
    : row.status==='accepted' ? (finished ? t.gameFinished : row.room_id ? t.gameStarted : t.gameStarting)
    : row.target_user_id ? t.personalChallenge : t.openOffer;
  return <div className="st-challenge-card"><small>{heading}</small>
    <p className="st-challenge-title">{t.game} <span className="st-mono">{row.time_control}</span></p><p className="st-challenge-players">{name(row.created_by)}{row.target_user_id ? ` → ${name(row.target_user_id)}` : ''}</p>
    {expired ? (mobileV2 ? null : <p className="st-challenge-status">{t.expired}</p>) : row.status==='cancelled' ? (mobileV2 ? null : <p className="st-challenge-status">{t.cancelled}</p>) : row.status==='accepted' ? <>{!mobileV2 && <p className="st-challenge-status">{finished ? t.gameFinished : row.room_id ? t.gameStarted : t.gameStarting}</p>}{!finished && row.room_id && ROOM_ID.test(row.room_id) && (row.created_by===me || row.accepted_by===me) && <Link className="st-challenge-open" to={gamePath(row.room_id)}>{t.openGame}</Link>}</> : row.created_by===me ? <><p className="st-challenge-status">{t.waitingOpponent}</p><button disabled={busy} onClick={() => act('cancel',row.id)}>{t.cancel}</button></> : (!row.target_user_id || row.target_user_id===me) && <button disabled={busy} onClick={() => act('accept',row.id)}>{t.accept}</button>}
  </div>;
}
