import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Mic,Send,MessageSquare,Square} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useLanguage} from '../../context/LanguageContext';
import {openSpielerAnalysis} from '../../services/spieler';
import {openingPrepLanguage} from '../../i18n/openingPrepCopy';
import './CoachChat.css';
type ResultGame={id:string;white:string;black:string;result:string;ply:number;pgn:string;date:string|null};
type Reply={answer:string;games:ResultGame[];matched:number;generated:boolean;engineVerified:boolean};
type ChatItem={role:'user'|'assistant';text:string;games?:ResultGame[]};
const strings={
 de:['Mit AI Coach sprechen','Frage zur aktuellen Stellung','Senden','Spracheingabe','Aufnahme beenden','Antwort wird erstellt …','Bitte anmelden, um den Coach zu nutzen.','Coach derzeit nicht verfügbar.','Partie analysieren','Mikrofon in diesem Browser nicht verfügbar.','Sprachaufnahme wurde nicht freigegeben.'],
 en:['Chat with AI Coach','Ask about the current board','Send','Voice input','Stop recording','Preparing answer …','Sign in to use the Coach.','Coach is currently unavailable.','Analyze game','Microphone is not available in this browser.','Microphone permission was denied.'],
 ru:['Чат с AI Coach','Спросите о позиции на доске','Отправить','Голосовой ввод','Остановить запись','Готовим ответ …','Войдите, чтобы общаться с тренером.','Тренер временно недоступен.','Анализ партии','Микрофон недоступен в этом браузере.','Нет доступа к микрофону.'],
 az:['AI Coach ilə söhbət','Lövhədəki mövqe barədə soruşun','Göndər','Səslə daxil et','Yazını dayandır','Cavab hazırlanır …','Məşqçidən istifadə üçün daxil olun.','Məşqçi hazırda əlçatan deyil.','Partiyanı təhlil et','Bu brauzerdə mikrofon mövcud deyil.','Mikrofona icazə verilmədi.'],
 tr:['AI Coach ile sohbet','Tahtadaki konumu sor','Gönder','Sesli giriş','Kaydı durdur','Yanıt hazırlanıyor …','Koçu kullanmak için giriş yapın.','Koç şu anda kullanılamıyor.','Partiyi analiz et','Bu tarayıcıda mikrofon yok.','Mikrofona izin verilmedi.'],
 uk:['Чат з AI Coach','Запитайте про позицію на дошці','Надіслати','Голосове введення','Зупинити запис','Готуємо відповідь …','Увійдіть, щоб користуватися тренером.','Тренер зараз недоступний.','Аналіз партії','Мікрофон недоступний у цьому браузері.','Доступ до мікрофона заборонено.']
} as const;
interface SpeechResult {results:ArrayLike<ArrayLike<{transcript:string}>>}
interface Recognition {lang:string;onresult:((e:SpeechResult)=>void)|null;onerror:((e:unknown)=>void)|null;onend:(()=>void)|null;start():void;stop():void}
type SpeechConstructor=new()=>Recognition;
export default function CoachChat({fen,side,token}:{fen:string;side:'white'|'black'|'any';token:string}){
 const {language}=useLanguage(),navigate=useNavigate(),lang=openingPrepLanguage(language),t=strings[lang];
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[items,setItems]=useState<ChatItem[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recording,setRecording]=useState(false);
 const controller=useRef<AbortController|null>(null),recognition=useRef<Recognition|null>(null),listRef=useRef<HTMLDivElement>(null);
 useEffect(()=>()=>{controller.current?.abort();recognition.current?.stop();},[]);
 useEffect(()=>{controller.current?.abort();setBusy(false);setItems([]);setError('');},[token]);
 useEffect(()=>{listRef.current?.scrollTo({top:listRef.current.scrollHeight});},[items,open]);
 async function send(event:FormEvent){
  event.preventDefault();const message=draft.trim();if(!message||!token||busy)return;
  const abort=new AbortController();controller.current?.abort();controller.current=abort;setBusy(true);setDraft('');setError('');setItems(v=>[...v.slice(-16),{role:'user',text:message}]);
  try{
   const root=new URL(import.meta.env.VITE_SERVER_URL||'');
   if(root.protocol!=='https:'&&!(root.protocol==='http:'&&['localhost','127.0.0.1'].includes(root.hostname)))throw Error('config');
   const response=await fetch(new URL('/api/ai-coach/chat',root),{method:'POST',signal:abort.signal,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({message,fen,side,language:lang})});
   const data=await response.json() as Reply;
   if(!response.ok||typeof data.answer!=='string'||!Array.isArray(data.games))throw Error('api');
   if(!abort.signal.aborted)setItems(v=>[...v,{role:'assistant',text:data.answer,games:data.games.slice(0,5)}]);
  }catch{if(!abort.signal.aborted)setError(t[7]);}
  finally{if(!abort.signal.aborted)setBusy(false);}
 }
 function toggleVoice(){
  if(recognition.current){recognition.current.stop();recognition.current=null;setRecording(false);return;}
  const holder=window as typeof window & {SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};
  const Engine=holder.SpeechRecognition||holder.webkitSpeechRecognition;
  if(!Engine){setError(t[9]);return;}
  const instance=new Engine();recognition.current=instance;
  instance.lang=({de:'de-DE',en:'en-US',ru:'ru-RU',az:'az-AZ',tr:'tr-TR',uk:'uk-UA'} as const)[lang];
  instance.onresult=e=>setDraft(s=>[s,...Array.from(e.results).map(r=>r[0]?.transcript||'')].filter(Boolean).join(' '));
  instance.onerror=()=>{setError(t[10]);setRecording(false);recognition.current=null;};
  instance.onend=()=>{setRecording(false);recognition.current=null;};
  try{instance.start();setRecording(true);setError('');}catch{setRecording(false);recognition.current=null;setError(t[9]);}
 }
 return <section className="coach-chat" aria-label={t[0]}>
  <button type="button" className="coach-chat-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><MessageSquare size={16}/>{t[0]}</button>
  {open&&<div className="coach-chat-panel">
   <div ref={listRef} className="coach-chat-history" role="log" aria-live="polite" aria-relevant="additions text">
    {items.map((m,i)=><div key={i} className={'coach-chat-message '+m.role}><p>{m.text}</p>{m.games?.map(g=><button type="button" key={g.id} onClick={()=>navigate(openSpielerAnalysis(g.pgn,undefined,g.ply))}>{t[8]} · {g.white} – {g.black}</button>)}</div>)}
    {busy&&<p role="status">{t[5]}</p>}
   </div>
   {!token&&<p className="coach-chat-error" role="status">{t[6]}</p>}
   {error&&<p className="coach-chat-error" role="alert">{error}</p>}
   <form className="coach-chat-compose" onSubmit={send}>
    <label className="sr-only" htmlFor="coach-message">{t[1]}</label>
    <input id="coach-message" value={draft} maxLength={500} onChange={e=>setDraft(e.target.value)} placeholder={t[1]} disabled={!token||busy}/>
    <button type="button" onClick={toggleVoice} disabled={!token} aria-label={recording?t[4]:t[3]} title={recording?t[4]:t[3]}>{recording?<Square size={15}/>:<Mic size={17}/>}</button>
    <button type="submit" aria-label={t[2]} disabled={!token||busy||draft.trim().length<2}><Send size={17}/></button>
   </form>
  </div>}
 </section>;
}
