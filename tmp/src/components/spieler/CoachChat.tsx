import {useCallback,useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {Mic,Send,MessageSquare,Square,Volume2} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useLanguage} from '../../context/LanguageContext';
import {openSpielerAnalysis} from '../../services/spieler';
import {openingPrepLanguage} from '../../i18n/openingPrepCopy';
import {coachChatCopy} from '../../i18n/coachChatCopy';
import {readPositionSearchState,writePositionSearchState,positionSearchRevision} from '../../utils/positionSearchState';
import {readCoachSpeech,createCoachPlayback} from '../../services/coachSpeech';
import './CoachChat.css';
type ResultGame={id:string;white:string;black:string;result:string;ply:number;pgn:string};
type Reply={answer:string;games:ResultGame[];generated:boolean};
type ChatItem={role:'user'|'assistant';text:string;games?:ResultGame[];generated?:boolean};
type Clip={url:string;item:number;autoplay:boolean};
type Props={fen:string;side:'white'|'black'|'any';token:string;accountId?:string};
type SavedChat={context:string;open:boolean;draft:string;items:ChatItem[];voiceReplies:boolean;scrollTop:number;expanded?:number[]};
function restoredChat(accountId:string,context:string){
 const saved=readPositionSearchState<SavedChat>(accountId,'chat');
 if(!saved||saved.context!==context||typeof saved.open!=='boolean'||typeof saved.voiceReplies!=='boolean'||typeof saved.draft!=='string'||saved.draft.length>500||!Number.isFinite(saved.scrollTop)||!Array.isArray(saved.items)||saved.items.length>18)return null;
 if(saved.items.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>1200||(m.generated!==undefined&&typeof m.generated!=='boolean')||(m.games!==undefined&&(!Array.isArray(m.games)||m.games.length>5||m.games.some(g=>!g||typeof g.id!=='string'||typeof g.white!=='string'||typeof g.black!=='string'||typeof g.pgn!=='string'||!Number.isInteger(g.ply)||g.ply<0)))))return null;
 if(saved.expanded!==undefined&&(!Array.isArray(saved.expanded)||saved.expanded.some(i=>!Number.isInteger(i)||i<0||i>=saved.items.length)))return null;
 return saved;
}
const MAX_AUDIO_BYTES=2*1024*1024;
function apiUrl(path:string){
 const root=new URL(import.meta.env.VITE_SERVER_URL||'');
 if(root.protocol!=='https:'&&!(root.protocol==='http:'&&['localhost','127.0.0.1'].includes(root.hostname)))throw Error('config');
 return new URL('/api/ai-coach/'+path,root);
}
async function checked(response:Response){
 if(!response.ok){let code='unavailable';try{code=(await response.json()).code||code;}catch{/* Proxy errors use the localized fallback. */}throw Error(code);}
 return response;
}
export default function CoachChat(props:Props){
 const {language}=useLanguage();
 return <CoachConversation key={JSON.stringify([props.accountId,props.fen,props.side,openingPrepLanguage(language)])} {...props}/>;
}
function CoachConversation({fen,side,token,accountId='guest'}:Props){
 const {language}=useLanguage(),navigate=useNavigate(),lang=openingPrepLanguage(language),t=coachChatCopy[lang],inputId=useId(),privacyId=useId();
 const context=JSON.stringify([fen,side,lang]);
 const [storageRevision]=useState(positionSearchRevision);
 const [saved]=useState(()=>token&&accountId!=='guest'?restoredChat(accountId,context):null);
 const [open,setOpen]=useState(saved?.open??false),[draft,setDraft]=useState(saved?.draft??''),[items,setItems]=useState<ChatItem[]>(saved?.items??[]),[busy,setBusy]=useState<'chat'|'transcribe'|'microphone'|null>(null),[error,setError]=useState(''),[recording,setRecording]=useState(false),[voiceReplies,setVoiceReplies]=useState(saved?.voiceReplies??false),[speechBusy,setSpeechBusy]=useState<number|null>(null),[clip,setClip]=useState<Clip|null>(null),[scrollTop,setScrollTop]=useState(saved?.scrollTop??0),[speechError,setSpeechError]=useState(''),[speechPlaying,setSpeechPlaying]=useState(false),[expanded,setExpanded]=useState<number[]>(saved?.expanded??[]);
 const request=useRef<AbortController|null>(null),busyRef=useRef(false),voicePreference=useRef(saved?.voiceReplies??false),restoredScroll=useRef<number|null>(saved?.scrollTop??null),speechRequest=useRef<AbortController|null>(null),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),recordTimer=useRef<ReturnType<typeof setTimeout>|null>(null),epoch=useRef(0),clipUrl=useRef<string|null>(null),audioRef=useRef<HTMLAudioElement|null>(null),listRef=useRef<HTMLDivElement>(null);
 const playback=useRef<ReturnType<typeof createCoachPlayback>>(null),speechCache=useRef(new Map<string,Blob>());
 const stopSpeech=useCallback(()=>{speechRequest.current?.abort();speechRequest.current=null;playback.current?.stop();playback.current=null;setSpeechPlaying(false);setSpeechError('');audioRef.current?.pause();if(clipUrl.current)URL.revokeObjectURL(clipUrl.current);clipUrl.current=null;setClip(null);setSpeechBusy(null);},[]);
 const cancel=useCallback(()=>{
  epoch.current++;busyRef.current=false;request.current?.abort();request.current=null;stopSpeech();
  if(recordTimer.current)clearTimeout(recordTimer.current);recordTimer.current=null;
  const current=recorder.current;recorder.current=null;if(current){current.onstop=null;current.ondataavailable=null;current.onerror=null;if(current.state!=='inactive')current.stop();}
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setRecording(false);setBusy(null);
 },[stopSpeech]);
 useEffect(()=>{cancel();setError('');setSpeechError('');return cancel;},[token,cancel]);
 useEffect(()=>{if(token&&accountId!=='guest')writePositionSearchState(accountId,{context,open,draft,items,voiceReplies,scrollTop,expanded},'chat',storageRevision);},[storageRevision,accountId,context,token,open,draft,items,voiceReplies,scrollTop,expanded]);
 useEffect(()=>{const list=listRef.current;if(list){list.scrollTop=restoredScroll.current??list.scrollHeight;restoredScroll.current=null;}},[items,open,busy]);
 useEffect(()=>{if(clip?.autoplay)void audioRef.current?.play().catch(()=>{/* Native controls remain available when autoplay is blocked. */});},[clip]);
 function describe(error:unknown){
  const code=error instanceof Error?error.message:'';
  if(code==='authentication_required')return t.auth;if(code==='rate_limit')return t.rate;
  if(code==='provider_not_configured')return t.notConfigured;if(code==='empty_audio')return t.empty;
  if(code==='transcript_too_long'||code==='payload_too_large')return t.tooLong;
  return t.unavailable;
 }
 async function speak(text:string,item:number){
  stopSpeech();const abort=new AbortController();speechRequest.current=abort;setSpeechBusy(item);setSpeechError('');
  const cacheKey=lang+':'+text;
  const attach=(blob:Blob,autoplay:boolean)=>{const url=URL.createObjectURL(blob);clipUrl.current=url;setClip({url,item,autoplay});};
  let player:ReturnType<typeof createCoachPlayback>=null;
  try{
   const cached=speechCache.current.get(cacheKey);if(cached){attach(cached,true);return;}
   player=createCoachPlayback(()=>{if(!abort.signal.aborted)setSpeechPlaying(true);});playback.current=player;
   const response=await checked(await fetch(apiUrl('speech'),{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(95000)]),cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({text,language:lang})}));
   const blob=await readCoachSpeech(response,pcm=>{if(!abort.signal.aborted)player?.push(pcm);});
   if(abort.signal.aborted)return;
   if(speechCache.current.size>=2)speechCache.current.delete(speechCache.current.keys().next().value!);speechCache.current.set(cacheKey,blob);
   const played=await player?.finish();if(!abort.signal.aborted){playback.current=null;setSpeechPlaying(false);attach(blob,!played);}
  }catch(e){player?.stop();if(playback.current===player)playback.current=null;if(!abort.signal.aborted){const code=e instanceof Error?e.message:'';setSpeechError(code==='speech_timeout'||(e instanceof DOMException&&e.name==='TimeoutError')?t.speechTimeout:code==='speech_too_long'?t.speechTooLong:code==='rate_limit'?t.rate:code==='provider_not_configured'?t.notConfigured:t.speechUnavailable);setSpeechPlaying(false);}}
  finally{if(!abort.signal.aborted)setSpeechBusy(null);}
 }
 async function send(event:FormEvent){
  event.preventDefault();const message=draft.trim();if(message.length<2||!token||busyRef.current||recorder.current)return;
  busyRef.current=true;
  stopSpeech();const abort=new AbortController();request.current?.abort();request.current=abort;const previous=items.slice(-16);
  setBusy('chat');setDraft('');setError('');setItems([...previous,{role:'user',text:message}]);setExpanded([]);
  try{
   const response=await checked(await fetch(apiUrl('chat'),{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)]),cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({message,fen,side,language:lang,history:previous.slice(-8).map(({role,text})=>({role,text}))})}));
   const data=await response.json() as Reply;
   if(typeof data.answer!=='string'||data.answer.length>1200||!Array.isArray(data.games)||typeof data.generated!=='boolean')throw Error('api');
   if(!abort.signal.aborted){setItems([...previous,{role:'user',text:message},{role:'assistant',text:data.answer,games:data.games.slice(0,5),generated:data.generated}]);if(voicePreference.current)void speak(data.answer,previous.length+1);}
  }catch(e){if(!abort.signal.aborted){setError(describe(e));setDraft(message);setItems(previous);}}
  finally{if(!abort.signal.aborted){busyRef.current=false;setBusy(null);}}
 }
 async function toggleVoice(){
  if(recorder.current){if(recorder.current.state!=='inactive')recorder.current.stop();return;}
  if(busyRef.current||!token)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError(t.micUnavailable);return;}
  stopSpeech();const currentEpoch=epoch.current;busyRef.current=true;setBusy('microphone');setError('');
  let acquired:MediaStream|null=null;
  try{
   acquired=await navigator.mediaDevices.getUserMedia({audio:true});
   if(epoch.current!==currentEpoch){acquired.getTracks().forEach(track=>track.stop());return;}
   stream.current=acquired;
   const type=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(value=>MediaRecorder.isTypeSupported(value));
   if(!type)throw Error('unsupported');
   const instance=new MediaRecorder(acquired,{mimeType:type});recorder.current=instance;
   const chunks:Blob[]=[];let size=0,tooLarge=false;
   instance.ondataavailable=event=>{size+=event.data.size;if(size>MAX_AUDIO_BYTES){tooLarge=true;if(instance.state!=='inactive')instance.stop();}else if(event.data.size)chunks.push(event.data);};
   instance.onerror=()=>{cancel();setError(t.micUnavailable);};
   instance.onstop=()=>{
    acquired?.getTracks().forEach(track=>track.stop());stream.current=null;recorder.current=null;if(recordTimer.current)clearTimeout(recordTimer.current);recordTimer.current=null;
    if(epoch.current!==currentEpoch)return;setRecording(false);
    if(tooLarge){busyRef.current=false;setBusy(null);setError(t.tooLong);return;}
    const audio=new Blob(chunks,{type:instance.mimeType});
    if(audio.size<16){busyRef.current=false;setBusy(null);setError(t.empty);return;}
    const abort=new AbortController();request.current=abort;busyRef.current=true;setBusy('transcribe');
    void (async()=>{try{
     const response=await checked(await fetch(apiUrl('transcribe?language='+lang),{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)]),cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':audio.type},body:audio}));
     const data=await response.json();if(typeof data.text!=='string'||data.text.length>500)throw Error('api');
     if(!abort.signal.aborted)setDraft(data.text);
    }catch(e){if(!abort.signal.aborted)setError(describe(e));}finally{if(!abort.signal.aborted){busyRef.current=false;setBusy(null);}}})();
   };
   instance.start(250);busyRef.current=false;setBusy(null);setRecording(true);voicePreference.current=true;setVoiceReplies(true);recordTimer.current=setTimeout(()=>{if(instance.state!=='inactive')instance.stop();},30000);
  }catch(e){acquired?.getTracks().forEach(track=>track.stop());stream.current=null;recorder.current=null;if(epoch.current===currentEpoch){busyRef.current=false;setBusy(null);setError(e instanceof DOMException&&e.name==='NotAllowedError'?t.micDenied:t.micUnavailable);}}
 }
 if(import.meta.env.VITE_AI_COACH_ENABLED!=='true')return null;
 return <section className="coach-chat" aria-label={t.title}>
  <button type="button" className="coach-chat-toggle" aria-expanded={open} onClick={()=>{if(open)cancel();setOpen(v=>!v);}}><MessageSquare size={16}/>{t.title}</button>
  {open&&<div className="coach-chat-panel">
   <div ref={listRef} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)} className="coach-chat-history" role="log" aria-live="polite" aria-relevant="additions text">
    {items.map((m,i)=><div key={i} className={'coach-chat-message '+m.role}><p>{m.text}</p>{m.role==='assistant'&&<>
     {!m.generated&&<small className="coach-chat-notice">{t.fallback}</small>}
     <button type="button" className="coach-chat-listen" disabled={!token||!!busy||recording||speechBusy!==null} onClick={()=>void speak(m.text,i)}><Volume2 size={14}/>{t.listen}</button>
    </>}{!!m.games?.length&&<details className="coach-chat-games" open={expanded.includes(i)} onToggle={e=>{const isOpen=e.currentTarget.open;setExpanded(previous=>previous.includes(i)===isOpen?previous:isOpen?[...previous,i]:previous.filter(value=>value!==i));}}><summary>{t.games} · {m.games.length}</summary>{m.games.map(g=><button type="button" key={g.id} onClick={()=>navigate(openSpielerAnalysis(g.pgn,undefined,g.ply))}>{t.analyze} · {g.white} – {g.black}</button>)}</details>}</div>)}
    {busy&&<p role="status">{busy==='transcribe'?t.transcribing:busy==='microphone'?t.voice:t.busy}</p>}
   </div>
   {recording&&<p role="status" className="coach-chat-notice">{t.recording}</p>}
   {speechBusy!==null&&<div role="status" className="coach-chat-stream"><span>{speechPlaying?t.speechPlaying:t.speechBusy}</span><button type="button" onClick={stopSpeech} aria-label={t.stopSpeaking}><Square size={15}/></button></div>}
   {clip&&<div className="coach-chat-audio"><audio ref={audioRef} src={clip.url} controls aria-label={t.listen}/><button type="button" onClick={stopSpeech} aria-label={t.stopSpeaking}><Square size={15}/></button><small>{t.audioReady}</small></div>}
   {!token&&<p className="coach-chat-error" role="status">{t.auth}</p>}
   {error&&<p className="coach-chat-error" role="alert">{error}</p>}
   {speechError&&<p className="coach-chat-error coach-chat-speech-error" role="alert">{speechError}</p>}
   <form className="coach-chat-compose" onSubmit={send}>
    <label className="sr-only" htmlFor={inputId}>{t.placeholder}</label>
    <input id={inputId} value={draft} maxLength={500} onChange={e=>setDraft(e.target.value)} placeholder={t.placeholder} disabled={!token||!!busy||recording}/>
    <button type="button" onClick={()=>void toggleVoice()} disabled={!token||!!busy} aria-label={recording?t.stop:t.voice} aria-pressed={recording} aria-describedby={privacyId} title={recording?t.stop:t.voice}>{recording?<Square size={15}/>:<Mic size={17}/>}</button>
    <button type="submit" aria-label={t.send} disabled={!token||!!busy||recording||draft.trim().length<2}><Send size={17}/></button>
   </form>
   <label className="coach-chat-voice-option"><input type="checkbox" checked={voiceReplies} disabled={!token} onChange={e=>{voicePreference.current=e.target.checked;setVoiceReplies(e.target.checked);if(!e.target.checked)stopSpeech();}}/>{t.autoVoice}</label>
   <p id={privacyId} className="coach-chat-notice">{t.privacy}</p>
  </div>}
 </section>;
}
