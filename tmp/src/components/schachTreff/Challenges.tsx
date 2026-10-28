import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { supabase } from '../../services/supabase';
import { useSchachTreffCopy } from './copy';
type Person = { id: string; username: string };
type Challenge = { id: string; message_id: string; created_by: string; target_user_id: string | null; time_control: string; status: string; expires_at: string; room_id: string | null };
type Controls = { now: number; available: boolean; me: string; rows: Challenge[]; people: Person[]; busy: boolean; open: (target?: string) => void; act: (action: 'accept' | 'cancel', id: string) => void };
const Context = createContext<Controls | null>(null);
export function ChallengeProvider({ clubId, me, people, enabled, children }: { clubId: string | null; me: string; people: Person[]; enabled: boolean; children: ReactNode }) {
  const t=useSchachTreffCopy();
  const { socket, isConnected } = useSocket(), navigate = useNavigate();
  const [now,setNow]=useState(() => Date.now());
  const [rows,setRows] = useState<Challenge[]>([]), [available,setAvailable] = useState(false);
  const [target,setTarget] = useState(''), [personal,setPersonal] = useState(false), [time,setTime] = useState('3+2');
  const [shown,setShown] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), warned = useRef(false);
  const load = useCallback(async () => {
    if (!enabled || !clubId) { setRows([]); setAvailable(false); return; }
    const result = await supabase.from('chess_club_challenges').select('id,message_id,created_by,target_user_id,time_control,status,expires_at,room_id').eq('club_id',clubId).order('created_at',{ascending:false}).limit(100);
    if (result.error) {
      if (['42P01','PGRST205','42703','PGRST204'].includes(result.error.code)) {
        setAvailable(false);
        if (!warned.current) { warned.current=true; console.warn('Schach-Treff challenges unavailable:',result.error.code); }
      } else setError(t.error);
      return;
    }
    setNow(Date.now()); setAvailable(true); setRows(result.data as Challenge[]);
  },[clubId,enabled]);
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
      if (typeof event.roomId==='string' && /^[0-9a-f-]{36}$/i.test(event.roomId) && ['w','b'].includes(event.color ?? '')) navigate(`/play?roomId=${event.roomId}&color=${event.color}`);
    };
    socket?.on('club_challenges_changed',changed); socket?.on('match_found',found);
    if (enabled && clubId && isConnected) socket?.emit('club_challenge_watch',{clubId});
    return () => { window.clearInterval(timer); socket?.off('club_challenges_changed',changed); socket?.off('match_found',found); };
  },[load,socket,clubId,enabled,isConnected,navigate]);
  useEffect(() => { if (shown) dialog.current?.showModal(); else dialog.current?.close(); },[shown]);
  async function request(action: 'create' | 'accept' | 'cancel', payload: object) {
    if (!socket || !isConnected || busy) return;
    setBusy(true); setError('');
    try {
      const response=await new Promise<{ ok: boolean; reason?: string }>((resolve,reject) => {
        socket.timeout(10000).emit('club_challenge_'+action,payload,(timeout: Error | null,result: { ok: boolean; reason?: string }) => timeout ? reject(timeout) : resolve(result));
      });
      if (!response?.ok) { setError(t.challengeErrors[response?.reason as keyof typeof t.challengeErrors] ?? t.error); return; }
      if (action==='create') setShown(false);
      await load();
    } catch { setError(t.error); } finally { setBusy(false); }
  }
  const controls: Controls={ now,available:available && isConnected,me,rows,people,busy,open(id) { setTarget(id ?? ''); setPersonal(Boolean(id)); setError(''); setShown(true); },act(action,id) { void request(action,{challengeId:id}); } };
  return <Context.Provider value={controls}>{children}{error && <p role="alert">{error}</p>}
    <dialog aria-label={t.challenge} ref={dialog} onCancel={() => setShown(false)} onClose={() => setShown(false)}>
      <h2>{t.challenge}</h2><form onSubmit={event => { event.preventDefault(); void request('create',{clubId,timeControl:time,targetUserId:personal ? target : null}); }}>
        <fieldset><legend>{t.challengeKind}</legend>
          <label><input name="challenge-kind" type="radio" checked={!personal} onChange={() => setPersonal(false)} />{t.openChallenge}</label>
          <label><input name="challenge-kind" type="radio" checked={personal} onChange={() => setPersonal(true)} />{t.personalChallenge}</label>
        </fieldset>
        {personal && <label>{t.targetPlayer}<select value={target} onChange={event => setTarget(event.target.value)} required><option value="">{t.choosePlayer}</option>{people.filter(person => person.id!==me).map(person => <option key={person.id} value={person.id}>{person.username}</option>)}</select></label>}
        <label>{t.timeControl}<select value={time} onChange={event => setTime(event.target.value)}>{['3+2','5+0','10+0'].map(value => <option key={value}>{value}</option>)}</select></label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy || (personal && !target) || rows.filter(row => row.created_by===me && row.status==='open' && Date.parse(row.expires_at)>now).length>=3}>{t.sendChallenge}</button>
        <button type="button" onClick={() => setShown(false)}>{t.cancel}</button>
      </form>
    </dialog>
  </Context.Provider>;
}
export function ChallengeButton({ targetUserId,beforeOpen }: { targetUserId?: string; beforeOpen?: () => void }) {
  const t=useSchachTreffCopy();
  const context=useContext(Context);
  if (!context?.available || targetUserId===context.me) return null;
  return <button type="button" onClick={() => { beforeOpen?.(); context.open(targetUserId); }}>{t.challengeAction}</button>;
}
export function ChallengeMessage({ messageId,body }: { messageId: string; body: string }) {
  const context=useContext(Context), row=context?.rows.find(item => item.message_id===messageId);
  if (!context || !row) return <p>{body}</p>;
  return <ChallengeCard now={context.now} row={row} me={context.me} people={context.people} busy={context.busy} act={context.act} />;
}
export function ChallengeCard({now,row,me,people,busy,act}: {now: number; row: Challenge; me: string; people: Person[]; busy: boolean; act: Controls['act']}) {
  const t=useSchachTreffCopy();
  const expired=row.status==='expired' || (row.status==='open' && Date.parse(row.expires_at)<=now);
  const name=(id: string) => people.find(person => person.id===id)?.username ?? t.targetPlayer;
  return <div className="st-challenge-card"><small>{row.target_user_id ? t.personalChallenge : t.openOffer}</small>
    <p>{t.game} <span className="st-mono">{row.time_control}</span></p><p>{name(row.created_by)}{row.target_user_id ? ` → ${name(row.target_user_id)}` : ''}</p>
    {expired ? <p>{t.expired}</p> : row.status==='cancelled' ? <p>{t.cancelled}</p> : row.status==='accepted' ? <p>{row.room_id ? t.gameStarted : t.gameStarting}</p> : row.created_by===me ? <><p>{t.waitingOpponent}</p><button disabled={busy} onClick={() => act('cancel',row.id)}>{t.cancel}</button></> : (!row.target_user_id || row.target_user_id===me) && <button disabled={busy} onClick={() => act('accept',row.id)}>{t.accept}</button>}
  </div>;
}
