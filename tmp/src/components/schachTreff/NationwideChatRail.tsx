import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

type ChatMessage = { id: string; author_id: string; body: string; created_at: string };
type ChatProfile = { id: string; username: string };
const NATIONAL_ROOM_SLUG = 'chessaz-deutsch';
const REFRESH_MS = 12000;

function timeLabel(value: string) {
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? '' :
  new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',timeZone:'Europe/Berlin'}).format(date);
}

/**
 * The NRW view is ONLY a second client of the existing German Schach-Treff.
 * Room, membership and message tables are identical to /chat. Never create
 * region-specific rooms, relax RLS, or fetch messages for non-members.
 */
export default function NationwideChatRail() {
 const { user, isLoading: authLoading } = useAuth();
 // Remount on identity change to discard private messages and drafts immediately.
 return <ChatSession key={user?.id ?? 'guest'} userId={user?.id ?? null} authLoading={authLoading}/>;
}

function ChatSession({userId,authLoading}:{userId:string|null;authLoading:boolean}) {
 const [clubId,setClubId] = useState<string|null>(null);
 const [member,setMember] = useState(false);
 const [messages,setMessages] = useState<ChatMessage[]>([]);
 const [profiles,setProfiles] = useState<Record<string,string>>({});
 const [loading,setLoading] = useState(true);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [draft,setDraft] = useState('');
 const [revision,setRevision] = useState(0);

 useEffect(()=>{
  const controller = new AbortController();
  let reading = false;
  const refresh = async()=>{
   if(reading || controller.signal.aborted || authLoading)return;
   reading=true;
   try{
    const club = await supabase.from('chess_clubs').select('id')
      .eq('slug',NATIONAL_ROOM_SLUG).abortSignal(controller.signal).maybeSingle();
    if(club.error)throw club.error;
    if(controller.signal.aborted)return;
    const id=club.data?.id ?? null;
    setClubId(id);
    if(!userId || !id){setMember(false);setMessages([]);setProfiles({});setError('');return;}
    const membership=await supabase.from('chess_club_members').select('user_id')
     .eq('club_id',id).eq('user_id',userId).abortSignal(controller.signal).maybeSingle();
    if(membership.error)throw membership.error;
    if(controller.signal.aborted)return;
    const joined=Boolean(membership.data);
    setMember(joined);
    if(!joined){setMessages([]);setProfiles({});setError('');return;}
    const feed=await supabase.from('chess_club_messages')
     .select('id,author_id,body,created_at').eq('club_id',id)
     .order('created_at',{ascending:false}).limit(30).abortSignal(controller.signal);
    if(feed.error)throw feed.error;
    if(controller.signal.aborted)return;
    const recent=(feed.data??[]) as ChatMessage[];
    const ids=[...new Set(recent.map(m=>m.author_id))];
    const names=ids.length?await supabase.from('profiles')
     .select('id,username').in('id',ids).abortSignal(controller.signal):{data:[] as ChatProfile[],error:null};
    if(names.error)throw names.error;
    if(controller.signal.aborted)return;
    setProfiles(Object.fromEntries((names.data??[]).map(p=>[p.id,p.username])));
    setMessages([...recent].reverse());
    setError('');
   }catch{if(!controller.signal.aborted)setError('Chat ist momentan nicht verfügbar.');}
   finally{reading=false;if(!controller.signal.aborted)setLoading(false);}
  };
  void refresh();
  const interval=window.setInterval(()=>{if(!document.hidden)void refresh();},REFRESH_MS);
  return()=>{controller.abort();window.clearInterval(interval);};
 },[userId,authLoading,revision]);

 async function join(){
  if(!userId||!clubId||busy||member)return;
  setBusy(true);setError('');
  try{
   const result=await supabase.from('chess_club_members').insert({
    club_id:clubId,user_id:userId,role:'member',
   });
   if(result.error)throw result.error;
   setRevision(n=>n+1);
  }catch{setError('Beitritt nicht möglich. Bitte erneut versuchen.');}
  finally{setBusy(false);}
 }

 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const body=draft.trim();
  if(!userId||!clubId||!member||busy||!body||body.length>1200)return;
  setBusy(true);setError('');
  try{
   const result=await supabase.from('chess_club_messages').insert({
    club_id:clubId,author_id:userId,body,
   });
   if(result.error)throw result.error;
   setDraft('');
   setRevision(n=>n+1);
  }catch{setError('Nachricht konnte nicht gesendet werden.');}
  finally{setBusy(false);}
 }

 return <aside className="nrw-chat-rail" aria-label="Deutschlandweiter Schach-Treff Chat" data-national-chat-rail>
  <header className="nrw-chat-header">
   <span className="nrw-chat-dot" aria-hidden="true"><MessageSquare size={20}/></span>
   <div><h2>Schach-Treff</h2><small>Deutschlandweiter Chat · keine NRW-Filterung</small></div>
   <Link className="nrw-chat-open" to="/chat" aria-label="Schach-Treff im Vollbild öffnen" title="Vollbild"><ArrowUpRight size={19} aria-hidden="true"/></Link>
  </header>
  {error&&<p className="nrw-chat-error" role="alert">{error}</p>}
  {authLoading||loading?<p className="nrw-muted" role="status">Chat wird geladen …</p>
   : !userId?<div className="nrw-chat-notice"><p>Zum Lesen und Schreiben im gemeinsamen Chat anmelden.</p><Link to="/profile?returnTo=%2Fregion%2Fnrw">Anmelden</Link></div>
   : !clubId?<p className="nrw-muted">Der Schach-Treff ist noch nicht eingerichtet.</p>
   : !member?<div className="nrw-chat-notice"><p>Der gemeinsame Chat ist für Mitglieder der Schach-Treff-Community.</p><button type="button" disabled={busy} onClick={()=>void join()}>Community beitreten</button></div>
   : <><div className="nrw-chat-messages" aria-label="Chat-Nachrichten" aria-live="polite" aria-relevant="additions">
       {messages.length===0?<p className="nrw-muted">Noch keine Nachrichten.</p>
        : messages.map(m=><article key={m.id} className="nrw-chat-message">
           <div className="nrw-chat-meta"><strong>{profiles[m.author_id]||'Mitglied'}</strong><time dateTime={m.created_at}>{timeLabel(m.created_at)}</time></div>
           <p>{m.body}</p>
          </article>)}
     </div>
     <form className="nrw-chat-compose" onSubmit={send}>
      <label htmlFor="nrw-chat-message">Nachricht</label>
      <div className="nrw-chat-compose-line">
       <input id="nrw-chat-message" aria-label="Nachricht an Schach-Treff" maxLength={1200} required
        value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Nachricht schreiben …" />
       <button type="submit" disabled={busy||!draft.trim()} aria-label="Nachricht senden"><Send size={18} aria-hidden="true"/></button>
      </div>
     </form>
    </>}
  <footer>Gemeinsamer Raum · <Link to="/chat">Alle Chat-Funktionen</Link></footer>
 </aside>;
}
