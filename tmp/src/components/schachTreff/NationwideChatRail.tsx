import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
const chatUiText: Record<string,Record<string,string>> = {"Deutschlandweiter Schach-Treff Chat":{"de":"Deutschlandweiter Schach-Treff Chat","en":"Nationwide Schach-Treff chat","az":"Ümumalmaniya Schach-Treff söhbəti","tr":"Almanya geneli Schach-Treff sohbeti","ua":"Загальнонімецький чат Schach-Treff","ru":"Общегерманский чат Schach-Treff"},"Deutschlandweiter Chat · keine NRW-Filterung":{"de":"Deutschlandweiter Chat · keine NRW-Filterung","en":"Nationwide chat · no NRW filter","az":"Ümumalmaniya çatı · NRW filtri yoxdur","tr":"Almanya geneli sohbet · NRW filtresi yok","ua":"Загальнонімецький чат · без фільтра NRW","ru":"Общегерманский чат · без фильтра NRW"},"Schach-Treff im Vollbild öffnen":{"de":"Schach-Treff im Vollbild öffnen","en":"Open full-screen Schach-Treff","az":"Schach-Treff-i tam ekranda aç","tr":"Schach-Treff’i tam ekranda aç","ua":"Відкрити Schach-Treff на весь екран","ru":"Открыть Schach-Treff во весь экран"},"Vollbild":{"de":"Vollbild","en":"Full screen","az":"Tam ekran","tr":"Tam ekran","ua":"Повний екран","ru":"Полный экран"},"Chat ist momentan nicht verfügbar.":{"de":"Chat ist momentan nicht verfügbar.","en":"Chat is currently unavailable.","az":"Çat hazırda əlçatan deyil.","tr":"Sohbet şu anda kullanılamıyor.","ua":"Чат наразі недоступний.","ru":"Чат сейчас недоступен."},"Beitritt nicht möglich. Bitte erneut versuchen.":{"de":"Beitritt nicht möglich. Bitte erneut versuchen.","en":"Unable to join. Please try again.","az":"Qoşulmaq mümkün deyil. Yenidən cəhd edin.","tr":"Katılamadınız. Tekrar deneyin.","ua":"Не вдалося приєднатися. Спробуйте ще раз.","ru":"Не удалось вступить. Повторите попытку."},"Nachricht konnte nicht gesendet werden.":{"de":"Nachricht konnte nicht gesendet werden.","en":"Message could not be sent.","az":"Mesaj göndərilmədi.","tr":"Mesaj gönderilemedi.","ua":"Не вдалося надіслати повідомлення.","ru":"Не удалось отправить сообщение."},"Chat wird geladen …":{"de":"Chat wird geladen …","en":"Loading chat…","az":"Çat yüklənir…","tr":"Sohbet yükleniyor…","ua":"Завантаження чату…","ru":"Загрузка чата…"},"Zum Lesen und Schreiben im gemeinsamen Chat anmelden.":{"de":"Zum Lesen und Schreiben im gemeinsamen Chat anmelden.","en":"Sign in to read and write in the shared chat.","az":"Ümumi çatda oxumaq və yazmaq üçün daxil olun.","tr":"Ortak sohbette okumak ve yazmak için giriş yapın.","ua":"Увійдіть, щоб читати й писати в загальному чаті.","ru":"Войдите, чтобы читать и писать в общем чате."},"Anmelden":{"de":"Anmelden","en":"Sign in","az":"Daxil ol","tr":"Giriş yap","ua":"Увійти","ru":"Войти"},"Der Schach-Treff ist noch nicht eingerichtet.":{"de":"Der Schach-Treff ist noch nicht eingerichtet.","en":"Schach-Treff has not been set up yet.","az":"Schach-Treff hələ qurulmayıb.","tr":"Schach-Treff henüz kurulmadı.","ua":"Schach-Treff ще не налаштований.","ru":"Schach-Treff ещё не настроен."},"Der gemeinsame Chat ist für Mitglieder der Schach-Treff-Community.":{"de":"Der gemeinsame Chat ist für Mitglieder der Schach-Treff-Community.","en":"The shared chat is for Schach-Treff community members.","az":"Ümumi çat Schach-Treff icmasının üzvləri üçündür.","tr":"Ortak sohbet Schach-Treff topluluğu üyeleri içindir.","ua":"Загальний чат для учасників спільноти Schach-Treff.","ru":"Общий чат для участников сообщества Schach-Treff."},"Community beitreten":{"de":"Community beitreten","en":"Join community","az":"İcmaya qoşul","tr":"Topluluğa katıl","ua":"Приєднатися до спільноти","ru":"Вступить в сообщество"},"Chat-Nachrichten":{"de":"Chat-Nachrichten","en":"Chat messages","az":"Çat mesajları","tr":"Sohbet mesajları","ua":"Повідомлення чату","ru":"Сообщения чата"},"Noch keine Nachrichten.":{"de":"Noch keine Nachrichten.","en":"No messages yet.","az":"Hələ mesaj yoxdur.","tr":"Henüz mesaj yok.","ua":"Повідомлень ще немає.","ru":"Сообщений пока нет."},"Mitglied":{"de":"Mitglied","en":"Member","az":"Üzv","tr":"Üye","ua":"Учасник","ru":"Участник"},"Nachricht":{"de":"Nachricht","en":"Message","az":"Mesaj","tr":"Mesaj","ua":"Повідомлення","ru":"Сообщение"},"Nachricht an Schach-Treff":{"de":"Nachricht an Schach-Treff","en":"Message to Schach-Treff","az":"Schach-Treff-ə mesaj","tr":"Schach-Treff’e mesaj","ua":"Повідомлення в Schach-Treff","ru":"Сообщение в Schach-Treff"},"Nachricht schreiben …":{"de":"Nachricht schreiben …","en":"Write a message…","az":"Mesaj yazın…","tr":"Mesaj yazın…","ua":"Написати повідомлення…","ru":"Написать сообщение…"},"Nachricht senden":{"de":"Nachricht senden","en":"Send message","az":"Mesaj göndər","tr":"Mesaj gönder","ua":"Надіслати повідомлення","ru":"Отправить сообщение"},"Gemeinsamer Raum":{"de":"Gemeinsamer Raum","en":"Shared room","az":"Ümumi otaq","tr":"Ortak oda","ua":"Спільна кімната","ru":"Общая комната"},"Alle Chat-Funktionen":{"de":"Alle Chat-Funktionen","en":"All chat features","az":"Bütün çat funksiyaları","tr":"Tüm sohbet özellikleri","ua":"Усі функції чату","ru":"Все функции чата"}};
const translateChat=(text:string,language:string)=>chatUiText[text]?.[language]||text;
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
 const {language}=useLanguage();const tr=(v:string)=>translateChat(v,language);
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
   }catch{if(!controller.signal.aborted)setError("Chat ist momentan nicht verfügbar.");}
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
  }catch{setError("Beitritt nicht möglich. Bitte erneut versuchen.");}
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
  }catch{setError("Nachricht konnte nicht gesendet werden.");}
  finally{setBusy(false);}
 }

 return <aside className="nrw-chat-rail" aria-label={tr("Deutschlandweiter Schach-Treff Chat")} data-national-chat-rail>
  <header className="nrw-chat-header">
   <span className="nrw-chat-dot" aria-hidden="true"><MessageSquare size={20}/></span>
   <div><h2>Schach-Treff</h2><small>{tr("Deutschlandweiter Chat · keine NRW-Filterung")}</small></div>
   <Link className="nrw-chat-open" to="/chat" aria-label={tr("Schach-Treff im Vollbild öffnen")} title={tr("Vollbild")}><ArrowUpRight size={19} aria-hidden="true"/></Link>
  </header>
  {error&&<p className="nrw-chat-error" role="alert">{tr(error)}</p>}
  {authLoading||loading?<p className="nrw-muted" role="status">{tr("Chat wird geladen …")}</p>
   : !userId?<div className="nrw-chat-notice"><p>{tr("Zum Lesen und Schreiben im gemeinsamen Chat anmelden.")}</p><Link to="/profile?returnTo=%2Fregion%2Fnrw">{tr("Anmelden")}</Link></div>
   : !clubId?<p className="nrw-muted">{tr("Der Schach-Treff ist noch nicht eingerichtet.")}</p>
   : !member?<div className="nrw-chat-notice"><p>{tr("Der gemeinsame Chat ist für Mitglieder der Schach-Treff-Community.")}</p><button type="button" disabled={busy} onClick={()=>void join()}>{tr("Community beitreten")}</button></div>
   : <><div className="nrw-chat-messages" aria-label={tr("Chat-Nachrichten")} aria-live="polite" aria-relevant="additions">
       {messages.length===0?<p className="nrw-muted">{tr("Noch keine Nachrichten.")}</p>
        : messages.map(m=><article key={m.id} className="nrw-chat-message">
           <div className="nrw-chat-meta"><strong>{profiles[m.author_id]||'Mitglied'}</strong><time dateTime={m.created_at}>{timeLabel(m.created_at)}</time></div>
           <p>{m.body}</p>
          </article>)}
     </div>
     <form className="nrw-chat-compose" onSubmit={send}>
      <label htmlFor="nrw-chat-message">{tr("Nachricht")}</label>
      <div className="nrw-chat-compose-line">
       <input id="nrw-chat-message" aria-label={tr("Nachricht an Schach-Treff")} maxLength={1200} required
        value={draft} onChange={e=>setDraft(e.target.value)} placeholder={tr("Nachricht schreiben …")} />
       <button type="submit" disabled={busy||!draft.trim()} aria-label={tr("Nachricht senden")}><Send size={18} aria-hidden="true"/></button>
      </div>
     </form>
    </>}
  <footer>{tr('Gemeinsamer Raum')} · <Link to="/chat">{tr("Alle Chat-Funktionen")}</Link></footer>
 </aside>;
}
