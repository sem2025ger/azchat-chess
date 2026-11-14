import { moderationEnabled, UnreadBadge } from './unread';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useSchachTreffCopy } from './copy';
import { useAuth } from '../../context/AuthContext';
import { LockKeyhole } from 'lucide-react';
import { roomDisplayLabel } from './roomIdentity';
type Room = { id: string; name: string };
export default function ClubRooms({ currentClubId, heading }: { currentClubId: string | null; heading?: string }) {
  const t=useSchachTreffCopy();
  const {user}=useAuth();
  const [rooms,setRooms]=useState<Room[]>([]), [available,setAvailable]=useState(false);
  const [name,setName]=useState(''), [form,setForm]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const [link,setLink]=useState(''), [copied,setCopied]=useState(false);
  const warned=useRef(false), requestVersion=useRef(0);
  const load=useCallback(async () => {
    const version=++requestVersion.current;
    if (!user) { setAvailable(false); setRooms([]); setError(''); return; }
    const result=await supabase.from('chess_clubs').select('id,name').eq('kind','room').order('created_at');
    if (version !== requestVersion.current) return;
    if (result.error) {
      if (['42703','PGRST204','PGRST205'].includes(result.error.code)) {
        if (!warned.current) { warned.current=true; console.warn('Schach-Treff rooms unavailable:',result.error.code); }
      } else setError(t.error);
      setAvailable(false); return;
    }
    setAvailable(true); setRooms(result.data as Room[]);
  },[user]);
  useEffect(() => { void load(); return () => { requestVersion.current++; }; },[load]);
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
  if (!user || (!available && !error)) return null;
  return <div className="st-room-list">{available && <h2 className="st-club-heading"><LockKeyhole size={16} aria-hidden="true" />{heading ?? t.clubs}</h2>}{rooms.map(room => <a key={room.id} href={'/chat?club='+room.id} aria-current={currentClubId===room.id ? 'page' : undefined}>{roomDisplayLabel(room,rooms)}{moderationEnabled && <UnreadBadge clubId={room.id} />}</a>)}
    {available && rooms.length === 0 && <p className="st-club-empty">{t.clubEmpty}</p>}
    {available && <button type="button" className="st-create-room" onClick={() => setForm(!form)}>{t.createClub}</button>}
    {form && <form onSubmit={event => { event.preventDefault(); void create(); }}><label>{t.clubName}<input value={name} onChange={event => setName(event.target.value)} minLength={3} maxLength={60} required /></label><button disabled={busy}>{t.createRoom}</button><button type="button" onClick={() => setForm(false)}>{t.cancel}</button></form>}
    {link && <div><p>{t.inviteReady}</p><button type="button" onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true),() => setError(t.error)); }}>{copied ? t.linkCopied : t.copyLink}</button><input aria-label={t.inviteLink} value={link} readOnly /></div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
export function RoomTitle({ clubId }: { clubId: string | null }) {
  const t=useSchachTreffCopy();
  const [room,setRoom]=useState<{id:string;name:string}|null>(null);
  useEffect(() => {
    if (!clubId) return;
    let current=true;
    // Use the same membership-filtered room list as the sidebar, so identical
    // names receive the same stable marker in the header and the room list.
    void supabase.from('chess_clubs').select('id,name').eq('kind','room').order('created_at').then(result => {
      if (!current) return;
      const rooms=(result.data ?? []) as Room[];
      const selected=rooms.find(item => item.id === clubId);
      if (!result.error && selected) {
        setRoom({id:clubId,name:roomDisplayLabel(selected,rooms)});
      } else {
        // Preserve the previous direct lookup for rooms outside this listing.
        void supabase.from('chess_clubs').select('name').eq('id',clubId).maybeSingle().then(fallback => {
          if (current && !fallback.error && fallback.data) setRoom({id:clubId,name:fallback.data.name});
        });
      }
    });
    return () => { current=false; };
  },[clubId]);
  return <>{room?.id===clubId ? room.name : t.general}</>;
}
