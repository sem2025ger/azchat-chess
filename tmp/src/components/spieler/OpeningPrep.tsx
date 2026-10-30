import {useEffect,useId,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useLanguage} from '../../context/LanguageContext';
import {openSpielerAnalysis} from '../../services/spieler';
import {openingPrepCopy,openingPrepLanguage} from '../../i18n/openingPrepCopy';
import {readPositionSearchState,writePositionSearchState,positionSearchRevision} from '../../utils/positionSearchState';
import './OpeningPrep.css';

type ModelGame={id:string;pgn:string;ply:number;white:string;black:string;event:string;date:string;result:string;first25:string[]};
type Continuation={move:string;availableInSample:number;replyColor:'white'|'black';replies:{move:string;count:number}[];games:ModelGame[]};
type OpeningLesson={opening:string;color:string;moves:string[];ply:number;turn:string;matched:number;inspected:number;groups:Continuation[];briefing:string|null};
type SavedPreparation={moves:string;color:'white'|'black';result:{key:string;lesson:OpeningLesson}|null;expanded:string[];resultsOpen?:boolean};
function restorePreparation(accountId:string){
 const saved=readPositionSearchState<SavedPreparation>(accountId,'preparation');
 if(!saved||typeof saved.moves!=='string'||saved.moves.length>250||!['white','black'].includes(saved.color)||!Array.isArray(saved.expanded)||saved.expanded.some(v=>typeof v!=='string')||(saved.resultsOpen!==undefined&&typeof saved.resultsOpen!=='boolean'))return null;
 if(saved.result){const lesson=saved.result.lesson;
  if(typeof saved.result.key!=='string'||!lesson||!Array.isArray(lesson.moves)||lesson.moves.some(m=>typeof m!=='string')||!Number.isFinite(lesson.matched)||!Number.isFinite(lesson.inspected)||(lesson.briefing!==null&&typeof lesson.briefing!=='string')||!Array.isArray(lesson.groups))return null;
  if(lesson.groups.some(g=>!g||typeof g.move!=='string'||!Array.isArray(g.replies)||g.replies.some(r=>!r||typeof r.move!=='string'||!Number.isFinite(r.count))||!Array.isArray(g.games)||g.games.some(p=>!p||[p.id,p.pgn,p.white,p.black,p.result,p.date,p.event].some(v=>typeof v!=='string')||!Number.isInteger(p.ply)||p.ply<0||!Array.isArray(p.first25)||p.first25.some(m=>typeof m!=='string'))))return null;
 }
 return saved;
}
function formatLine(moves:string[]){return moves.map((san,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+san).join(' ');}
export default function OpeningPrep({token,accountId='guest',showAuthNotice=true,color:selectedColor,onColorChange,onPreparedMoves}:{token:string;accountId?:string;showAuthNotice?:boolean;color?:'white'|'black';onColorChange?:(color:'white'|'black')=>void;onPreparedMoves?:(moves:string[])=>void}){
 const {language}=useLanguage(),navigate=useNavigate(),id=useId();
 const locale=openingPrepLanguage(language),t=openingPrepCopy[locale];
 const [storageRevision]=useState(positionSearchRevision);
 const [saved]=useState(()=>token&&accountId!=='guest'?restorePreparation(accountId):null);
 const [result,setResult]=useState<{key:string;lesson:OpeningLesson}|null>(saved?.result??null);
 const [resultsOpen,setResultsOpen]=useState(saved?.resultsOpen??true);
 const [busyKey,setBusyKey]=useState<string|null>(null),[failure,setFailure]=useState<{key:string;code:string}|null>(null);
 const [moves,setMoves]=useState(saved?.moves??'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'),[localColor,setLocalColor]=useState<'white'|'black'>(saved?.color??'black'),[expanded,setExpanded]=useState<string[]>(saved?.expanded??[]);
 const color=selectedColor??localColor;
 // Identity is scoped by account; bearer tokens are never persisted in a query key.
 const requestKey=JSON.stringify([moves,color,locale]);
 const operationKey=JSON.stringify([requestKey,token]);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[requestKey,token]);
 useEffect(()=>{if(token&&accountId!=='guest')writePositionSearchState(accountId,{moves,color,result,expanded,resultsOpen},'preparation',storageRevision);},[storageRevision,accountId,token,moves,color,result,expanded,resultsOpen]);
 const lesson=result?.key===requestKey?result.lesson:null,busy=busyKey===operationKey;
 const code=failure?.key===operationKey?failure.code:null;
 const error=code==='invalid_query'?t.invalid:code==='authentication_required'?t.auth:code==='index_warming'?t.warming:code==='rate_limit'?t.rate:code?t.error:'';
 if(import.meta.env.VITE_AI_COACH_ENABLED!=='true')return null;
 function invalidate(){pending.current?.abort();setBusyKey(null);setResult(null);setFailure(null);setExpanded([]);}
 async function prepare(){
  pending.current?.abort();const c=new AbortController();pending.current=c;
  setBusyKey(operationKey);setFailure(null);setResult(null);setResultsOpen(true);
  try{
   const base=new URL(import.meta.env.VITE_SERVER_URL||'');
   const response=await fetch(new URL('/api/ai-coach/preparation',base),{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({moves,color,language:locale}),cache:'no-store',signal:c.signal});
   if(!response.ok){const data=await response.json().catch(()=>null);throw Error(typeof data?.code==='string'?data.code:'unavailable');}
   const data:OpeningLesson=await response.json();
   if(data.opening!=='custom'||data.color!==color||!Array.isArray(data.groups))throw Error('invalid');
   if(!c.signal.aborted){onPreparedMoves?.(data.moves);setResult({key:requestKey,lesson:data});}
  }catch(error){if(!c.signal.aborted)setFailure({key:operationKey,code:error instanceof Error?error.message:'unavailable'});}
  finally{if(!c.signal.aborted)setBusyKey(null);}
 }
 function view(game:ModelGame){try{navigate(openSpielerAnalysis(game.pgn,undefined,game.ply));}catch{setFailure({key:operationKey,code:'unavailable'});}}
 return <section className="section-card chessaz-ai-coach" aria-label={t.title}>
  <header><h2 className="ai-coach-wordmark">{t.title}</h2></header>
  <label className="chessaz-ai-coach-input">{t.input}<input aria-label={t.input} aria-describedby={id+'-hint'} value={moves} maxLength={250} onChange={e=>{invalidate();setMoves(e.target.value);}} placeholder="e4 e5 Nf3 Nc6"/></label>
  <span id={id+'-hint'} className="sr-only">{t.hint}</span>
  <label className="chessaz-ai-coach-color">{t.color}<select aria-label={t.color} value={color} onChange={e=>{invalidate();const value=e.target.value as 'white'|'black';setLocalColor(value);onColorChange?.(value);}}><option value="white">{t.white}</option><option value="black">{t.black}</option></select></label>
  <button type="button" disabled={!token||busy||!moves.trim()} onClick={()=>void prepare()}>{busy?t.busy:t.start}</button>
  {!token&&showAuthNotice&&<p role="status">{t.auth}</p>}{error&&<p role="alert">{error}</p>}
  {lesson&&<details className="chessaz-ai-coach-results-panel" open={resultsOpen} onToggle={e=>setResultsOpen(e.currentTarget.open)}><summary>{t.examples} · {lesson.matched}</summary><div className="chessaz-ai-coach-results" aria-live="polite">
   <p><strong>{lesson.moves.join(' ')}</strong> · {lesson.turn==='white'?t.whiteTurn:t.blackTurn}</p>
   <p>{t.total}: <strong>{lesson.matched}</strong> · {t.inspected}: <strong>{lesson.inspected}</strong></p>
   <p>{lesson.briefing?<><strong>{t.ai}:</strong> {lesson.briefing}</>:t.noAi}</p>
   <p className="chessaz-ai-coach-note">{t.sample}</p>
   {!lesson.groups.length&&<p>{t.empty}</p>}
   {lesson.groups.map(group=><details key={group.move} className="chessaz-ai-coach-group" open={expanded.includes(group.move)} onToggle={e=>{const isOpen=e.currentTarget.open;setExpanded(previous=>previous.includes(group.move)===isOpen?previous:isOpen?[...previous,group.move]:previous.filter(move=>move!==group.move));}}>
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
  </div><button type="button" className="chessaz-ai-coach-close-results" onClick={()=>setResultsOpen(false)}>{t.closeResults}</button></details>}
 </section>;
}
