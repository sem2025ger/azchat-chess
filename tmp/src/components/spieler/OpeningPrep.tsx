import {useEffect,useId,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useLanguage} from '../../context/LanguageContext';
import {openSpielerAnalysis} from '../../services/spieler';
import {openingPrepCopy,openingPrepLanguage} from '../../i18n/openingPrepCopy';
import './OpeningPrep.css';

type ModelGame={id:string;pgn:string;ply:number;white:string;black:string;event:string;date:string;result:string;first25:string[]};
type Continuation={move:string;availableInSample:number;replyColor:'white'|'black';replies:{move:string;count:number}[];games:ModelGame[]};
type OpeningLesson={opening:string;color:string;moves:string[];ply:number;turn:string;matched:number;inspected:number;groups:Continuation[];briefing:string|null};
function formatLine(moves:string[]){return moves.map((san,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+san).join(' ');}
export default function OpeningPrep({token,showAuthNotice=true}:{token:string;showAuthNotice?:boolean}){
 const {language}=useLanguage(),navigate=useNavigate(),id=useId();
 const locale=openingPrepLanguage(language),t=openingPrepCopy[locale];
 const [result,setResult]=useState<{key:string;lesson:OpeningLesson}|null>(null);
 const [busyKey,setBusyKey]=useState<string|null>(null),[failure,setFailure]=useState<{key:string;code:string}|null>(null);
 const [moves,setMoves]=useState('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'),[color,setColor]=useState<'white'|'black'>('black');
 const requestKey=JSON.stringify([moves,color,locale,token]);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[requestKey]);
 const lesson=result?.key===requestKey?result.lesson:null,busy=busyKey===requestKey;
 const code=failure?.key===requestKey?failure.code:null;
 const error=code==='invalid_query'?t.invalid:code==='authentication_required'?t.auth:code==='index_warming'?t.warming:code==='rate_limit'?t.rate:code?t.error:'';
 if(import.meta.env.VITE_AI_COACH_ENABLED!=='true')return null;
 function invalidate(){pending.current?.abort();setBusyKey(null);setResult(null);setFailure(null);}
 async function prepare(){
  pending.current?.abort();const c=new AbortController();pending.current=c;
  setBusyKey(requestKey);setFailure(null);setResult(null);
  try{
   const base=new URL(import.meta.env.VITE_SERVER_URL||'');
   const response=await fetch(new URL('/api/ai-coach/preparation',base),{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({moves,color,language:locale}),cache:'no-store',signal:c.signal});
   if(!response.ok){const data=await response.json().catch(()=>null);throw Error(typeof data?.code==='string'?data.code:'unavailable');}
   const data:OpeningLesson=await response.json();
   if(data.opening!=='custom'||data.color!==color||!Array.isArray(data.groups))throw Error('invalid');
   if(!c.signal.aborted)setResult({key:requestKey,lesson:data});
  }catch(error){if(!c.signal.aborted)setFailure({key:requestKey,code:error instanceof Error?error.message:'unavailable'});}
  finally{if(!c.signal.aborted)setBusyKey(null);}
 }
 function view(game:ModelGame){try{navigate(openSpielerAnalysis(game.pgn,undefined,game.ply));}catch{setFailure({key:requestKey,code:'unavailable'});}}
 return <section className="section-card chessaz-ai-coach" aria-label={t.title}>
  <header><h2 className="ai-coach-wordmark">{t.title}</h2></header>
  <label className="chessaz-ai-coach-input">{t.input}<input aria-label={t.input} aria-describedby={id+'-hint'} value={moves} maxLength={250} onChange={e=>{invalidate();setMoves(e.target.value);}} placeholder="e4 e5 Nf3 Nc6"/></label>
  <span id={id+'-hint'} className="sr-only">{t.hint}</span>
  <label className="chessaz-ai-coach-color">{t.color}<select aria-label={t.color} value={color} onChange={e=>{invalidate();setColor(e.target.value as 'white'|'black');}}><option value="white">{t.white}</option><option value="black">{t.black}</option></select></label>
  <button type="button" disabled={!token||busy||!moves.trim()} onClick={()=>void prepare()}>{busy?t.busy:t.start}</button>
  {!token&&showAuthNotice&&<p role="status">{t.auth}</p>}{error&&<p role="alert">{error}</p>}
  {lesson&&<div className="chessaz-ai-coach-results" aria-live="polite">
   <p><strong>{lesson.moves.join(' ')}</strong> · {lesson.turn==='white'?t.whiteTurn:t.blackTurn}</p>
   <p>{t.total}: <strong>{lesson.matched}</strong> · {t.inspected}: <strong>{lesson.inspected}</strong></p>
   <p>{lesson.briefing?<><strong>{t.ai}:</strong> {lesson.briefing}</>:t.noAi}</p>
   <p className="chessaz-ai-coach-note">{t.sample}</p>
   {!lesson.groups.length&&<p>{t.empty}</p>}
   {lesson.groups.map(group=><details key={group.move} className="chessaz-ai-coach-group">
    <summary><strong>{group.move}</strong> <span>{t.examples}: {group.games.length}</span></summary>
    <div className="chessaz-ai-coach-group-body">
     <p><strong>{group.replyColor==='white'?t.whiteReplies:t.blackReplies}:</strong> {group.replies.map(m=>m.move+' ('+m.count+')').join(', ')||'—'}</p>
     <p className="chessaz-ai-coach-note">{t.notice}</p>
     <ol>{group.games.map(game=><li key={game.id}>
      <strong>{game.white} – {game.black}</strong> · {game.result}
      <p>{game.date||'—'} · {game.event}</p>
      <p><strong>{t.moves}:</strong> {formatLine(game.first25)}</p>
      <button type="button" onClick={()=>view(game)}>{t.open}</button>
     </li>)}</ol>
    </div>
   </details>)}
  </div>}
 </section>;
}
