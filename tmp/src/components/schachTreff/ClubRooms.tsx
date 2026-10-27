import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';
import { copy as t } from './copy';
type Room = { id: string; name: string };
export default function ClubRooms({ currentClubId }: { currentClubId: string | null }) {
  const [rooms,setRooms]=useState<Room[]>([]), [available,setAvailable]=useState(false);
  const [name,setName]=useState(''), [form,setForm]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const [link,setLink]=useState(''), [copied,setCopied]=useState(false);
  const warned=useRef(false);
  const load=useCallback(async () => {
    const result=await supabase.from('chess_clubs').select('id,name').eq('kind','room').order('created_at');
    if (result.error) {
      if (['42703','PGRST204','PGRST205'].includes(result.error.code)) {
        if (!warned.current) { warned.current=true; console.warn('Schach-Treff rooms unavailable:',result.error.code); }
      } else setError(t.error);
      setAvailable(false); return;
    }
    setAvailable(true); setRooms(result.data as Room[]);
  },[]);
  useEffect(() => { void load(); },[load]);
  async function create() {
    if (busy || name.trim().length<3) return;
    setBusy(true); setError(''); setLink('');
    try {
      const room=await supabase.rpc('create_club_room',{p_name:name.trim()});
      if (room.error) throw room.error;
      await load(); setForm(false); setName('');
      const invite=await supabase.rpc('create_club_invite',{p_club_id:room.data});
      if (invite.error) throw invite.error;
      setLink(window.location.origin+'/schach-treff/einladung/'+invite.data); setCopied(false);
    } catch (e) { setError(t.roomErrors[(e as {message?:string}).message as keyof typeof t.roomErrors] ?? t.error); }
    finally { setBusy(false); }
  }
  if (!available && !error) return null;
  return <div className="st-room-list">{rooms.map(room => <a key={room.id} href={'/chat?club='+room.id} aria-current={currentClubId===room.id ? 'page' : undefined}>{room.name}</a>)}
    {available && <button type="button" className="st-create-room" onClick={() => setForm(!form)}>{t.createClub}</button>}
    {form && <form onSubmit={event => { event.preventDefault(); void create(); }}><label>{t.clubName}<input value={name} onChange={event => setName(event.target.value)} minLength={3} maxLength={60} required /></label><button disabled={busy}>{t.createRoom}</button><button type="button" onClick={() => setForm(false)}>{t.cancel}</button></form>}
    {link && <div><p>{t.inviteReady}</p><button type="button" onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true),() => setError(t.error)); }}>{copied ? t.linkCopied : t.copyLink}</button><input aria-label={t.inviteLink} value={link} readOnly /></div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
export function RoomTitle({ clubId }: { clubId: string | null }) {
  const [room,setRoom]=useState<{id:string;name:string}|null>(null);
  useEffect(() => {
    if (!clubId) return;
    let current=true;
    void supabase.from('chess_clubs').select('name').eq('id',clubId).maybeSingle().then(result => {
      if (current && !result.error && result.data) setRoom({id:clubId,name:result.data.name});
    });
    return () => { current=false; };
  },[clubId]);
  return <>{room?.id===clubId ? room.name : t.general}</>;
}
