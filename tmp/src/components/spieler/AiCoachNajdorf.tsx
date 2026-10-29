import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {openSpielerAnalysis} from '../../services/spieler';
import {useLanguage} from '../../context/LanguageContext';

type ModelGame={id:string;pgn:string;white:string;black:string;event:string;date:string;result:string;first25:string[]};
type ModelGroup={move:string;availableInSample:number;games:ModelGame[]};
type Lesson={opening:string;color:string;matched:number;inspected:number;groups:ModelGroup[];briefing:string|null;generated:boolean};
const labels={
 de:{title:'ChessAZ AI Coach · Najdorf',desc:'Mit Schwarz: Modellpartien nach den Antworten von Weiß vergleichen. Bis zu fünf Partien pro System.',start:'Vorbereitung erstellen',loading:'Partien werden zusammengestellt …',empty:'In der vorhandenen Stichprobe sind keine passenden Partien.',sample:'Auswahl aus den verfügbaren Partien, keine vollständige Theorie und keine Engine-Bewertung.',view:'Partie im Analysebrett öffnen',first:'Erste 25 Züge',error:'Der Coach ist derzeit nicht verfügbar.',auth:'Bitte zuerst anmelden',noAi:'KI-Erklärung derzeit nicht eingerichtet. Die Partien stammen aus der Datenbank.',matched:'Gefundene Partien',sampled:'Geprüfte Stichprobe'},
 en:{title:'ChessAZ AI Coach · Najdorf',desc:'Playing Black: compare model games by White’s replies. Up to five games per system.',start:'Build preparation',loading:'Selecting model games …',empty:'No matching games in the current sample.',sample:'Sample of available games, not comprehensive theory or an engine verdict.',view:'Open game in analysis',first:'First 25 moves',error:'Coach is currently unavailable.',auth:'Please sign in',noAi:'AI explanation is not configured. Games come from the database.',matched:'Matching games',sampled:'Inspected sample'},
 ru:{title:'ChessAZ AI Coach · Найдорф',desc:'Игра за чёрных: модельные партии по продолжениям белых. До пяти партий на каждую систему.',start:'Подготовить репертуар',loading:'Подбираю модельные партии …',empty:'Подходящих партий в текущей выборке нет.',sample:'Выборка доступных партий, не полная теория и не оценка движка.',view:'Открыть в анализе',first:'Первые 25 ходов',error:'Помощник временно недоступен.',auth:'Сначала войдите в аккаунт',noAi:'ИИ-объяснения пока не подключены. Партии взяты из базы.',matched:'Найдено партий',sampled:'Изучено в выборке'}
};
export default function AiCoachNajdorf({token}:{token:string}){
 const {language}=useLanguage();const t=labels[language as keyof typeof labels]||labels.en,navigate=useNavigate();
 const [lesson,setLesson]=useState<Lesson|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(import.meta.env.VITE_AI_COACH_ENABLED!=='true')return null;
 async function prepare(){
  setBusy(true);setError('');setLesson(null);
  try{
   const base=new URL(import.meta.env.VITE_SERVER_URL||'');
   const response=await fetch(new URL('/api/ai-coach/preparation',base),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({opening:'najdorf',color:'black',language}),cache:'no-store'});
   if(!response.ok)throw Error('unavailable');
   const data=await response.json();
   if(!Array.isArray(data.groups))throw Error('invalid');
   setLesson(data);
  }catch{setError(t.error);}finally{setBusy(false);}
 }
 function view(pgn:string){try{navigate(openSpielerAnalysis(pgn));}catch{setError(t.error);}}
 return <section className="section-card" aria-label={t.title} style={{marginBottom:20}}>
  <h2>{t.title}</h2><p>{t.desc}</p>
  <button type="button" disabled={!token||busy} onClick={()=>void prepare()}>{busy?t.loading:t.start}</button>
  {!token&&<p role="status">{t.auth}</p>}{error&&<p role="alert">{error}</p>}
  {lesson&&<div style={{marginTop:16}}>
   <p>{t.matched}: {lesson.matched} · {t.sampled}: {lesson.inspected}</p>
   <p>{lesson.briefing||t.noAi}</p><p>{t.sample}</p>
   {!lesson.groups.length&&<p>{t.empty}</p>}
   {lesson.groups.map(group=><details key={group.move} style={{marginTop:12}}>
    <summary><strong>{group.move}</strong> · {group.games.length} / {group.availableInSample}</summary>
    <ol>{group.games.map(game=><li key={game.id} style={{marginBottom:16}}>
     <strong>{game.white} – {game.black}</strong> · {game.result}
     <p>{game.date} · {game.event}</p>
     <p>{t.first}: {game.first25.map((san,i)=>(i%2===0?(Math.floor(i/2)+1)+'. ':'')+san).join(' ').slice(0,900)}</p>
     <button type="button" onClick={()=>view(game.pgn)}>{t.view}</button>
    </li>)}</ol>
   </details>)}
  </div>}
 </section>;
}
