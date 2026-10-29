import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useLanguage} from '../../context/LanguageContext';
import {openSpielerAnalysis} from '../../services/spieler';
import './AiCoachNajdorf.css';

type ModelGame={id:string;pgn:string;white:string;black:string;event:string;date:string;result:string;first25:string[]};
type Group={move:string;availableInSample:number;blackReplies:{move:string;count:number}[];games:ModelGame[]};
type Lesson={opening:string;color:string;moves:string[];ply:number;turn:string;matched:number;inspected:number;groups:Group[];briefing:string|null};
const labels={
 de:{title:'ChessAZ AI Coach · Openings',desc:'Mit Schwarz: Weiß-Pläne durch echte Modellpartien verstehen.',start:'Partien auswählen',busy:'Partien werden ausgewählt …',empty:'Keine passenden Partien in dieser Stichprobe.',sample:'Begrenzte Auswahl, keine vollständige Theorie oder Engine-Bewertung.',open:'In Analyse öffnen',moves:'Bis zu 25 vollständige Züge',error:'Coach derzeit nicht verfügbar.',auth:'Bitte zuerst anmelden.',noAi:'KI-Einführung nicht verfügbar. Die Partien kommen aus der Datenbank.',total:'Partien in der Stellung',inspected:'Geprüfte Beispiele',replies:'Antworten von Schwarz in den gezeigten Partien',ai:'KI-Einführung (nicht Engine-geprüft)',examples:'Modellpartien',notice:'Nur gezeigte Beispiele, keine Gesamtstatistik.'},
 en:{title:'ChessAZ AI Coach · Openings',desc:'With Black: study White’s plans through real model games.',start:'Select games',busy:'Selecting games …',empty:'No matching games in this sample.',sample:'Limited sample, not complete theory or engine analysis.',open:'Open in analysis',moves:'Up to 25 full moves',error:'Coach is unavailable.',auth:'Please sign in.',noAi:'AI introduction unavailable; games are from the database.',total:'Games in the position',inspected:'Games inspected',replies:'Black replies in the games shown',ai:'AI introduction (not engine verified)',examples:'Model games',notice:'Only the shown examples, not opening-wide statistics.'},
 ru:{title:'ChessAZ AI Coach · Дебюты',desc:'Играя чёрными, изучайте планы белых по реальным модельным партиям.',start:'Подобрать партии',busy:'Подбираю партии …',empty:'В выборке подходящих партий нет.',sample:'Ограниченная выборка, не полная теория дебюта и не оценка движка.',open:'Открыть на доске анализа',moves:'До 25 полных ходов',error:'Помощник пока недоступен.',auth:'Сначала войдите в аккаунт.',noAi:'ИИ-объяснение недоступно; ниже реальные партии из базы.',total:'Партий в позиции',inspected:'Изучено в выборке',replies:'Ответы чёрных в показанных партиях',ai:'Объяснение ИИ (не проверено движком)',examples:'Модельные партии',notice:'Только показанные примеры, не общая статистика дебюта.'},
 az:{title:'ChessAZ AI Coach · Debütlər',desc:'Qaralarla ağların planlarını real nümunəvi partiyalarda öyrənin.',start:'Partiyaları seç',busy:'Partiyalar seçilir …',empty:'Uyğun partiya tapılmadı.',sample:'Məhdud seçim, tam nəzəriyyə və ya mühərrik təhlili deyil.',open:'Analizdə aç',moves:'25 tam gedişə qədər',error:'Köməkçi əlçatan deyil.',auth:'Əvvəlcə daxil olun.',noAi:'AI izahı əlçatan deyil; partiyalar bazadandır.',total:'Mövqedəki partiyalar',inspected:'Yoxlanılan nümunələr',replies:'Göstərilən partiyalarda qaraların cavabları',ai:'AI izahı (mühərriklə yoxlanmayıb)',examples:'Nümunəvi partiyalar',notice:'Yalnız göstərilən nümunələr, ümumi statistika deyil.'},
 tr:{title:'ChessAZ AI Coach · Openings',desc:'Siyahlarla beyazların planlarını gerçek örnek partilerde öğrenin.',start:'Partileri seç',busy:'Partiler seçiliyor …',empty:'Uygun parti bulunamadı.',sample:'Sınırlı örneklem, tam teori veya motor analizi değildir.',open:'Analizde aç',moves:'25 tam hamleye kadar',error:'Asistan kullanılamıyor.',auth:'Önce giriş yapın.',noAi:'Yapay zekâ açıklaması yok; partiler veri tabanından.',total:'Konumdaki partiler',inspected:'İncelenen örnekler',replies:'Gösterilen partilerde siyahın yanıtları',ai:'Yapay zekâ açıklaması (motor kontrolü yok)',examples:'Örnek partiler',notice:'Yalnızca gösterilen örnekler, genel istatistik değil.'},
 ua:{title:'ChessAZ AI Coach · Дебюты',desc:'Граючи чорними, вивчайте плани білих за реальними партіями.',start:'Підібрати партії',busy:'Підбираємо партії …',empty:'Відповідних партій немає.',sample:'Обмежена вибірка, не повна теорія чи аналіз рушія.',open:'Відкрити в аналізі',moves:'До 25 повних ходів',error:'Помічник недоступний.',auth:'Спочатку увійдіть.',noAi:'Пояснення ШІ недоступне; партії взято з бази.',total:'Партій у позиції',inspected:'Перевірено прикладів',replies:'Відповіді чорних у показаних партіях',ai:'Пояснення ШІ (без перевірки рушієм)',examples:'Зразкові партії',notice:'Лише показані приклади, не загальна статистика.'}
} as const;
function formatLine(moves:string[]){return moves.map((san,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+san).join(' ');}
export default function AiCoachNajdorf({token}:{token:string}){
 const {language}=useLanguage(),navigate=useNavigate(),t=labels[language as keyof typeof labels]||labels.de;
 const [lesson,setLesson]=useState<Lesson|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [moves,setMoves]=useState('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'),[color,setColor]=useState<'white'|'black'>('black');
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 if(import.meta.env.VITE_AI_COACH_ENABLED!=='true')return null;
 async function prepare(){
  pending.current?.abort();const c=new AbortController();pending.current=c;
  setBusy(true);setError('');setLesson(null);
  try{
   const base=new URL(import.meta.env.VITE_SERVER_URL||'');
   const response=await fetch(new URL('/api/ai-coach/preparation',base),{method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({moves,color,language}),cache:'no-store',signal:c.signal});
   if(!response.ok)throw Error('unavailable');
   const data:Lesson=await response.json();
   if(data.opening!=='custom'||data.color!==color||!Array.isArray(data.groups))throw Error('invalid');
   if(!c.signal.aborted)setLesson(data);
  }catch{if(!c.signal.aborted)setError(t.error);}finally{if(!c.signal.aborted)setBusy(false);}
 }
 function view(pgn:string){try{navigate(openSpielerAnalysis(pgn));}catch{setError(t.error);}}
 return <section className="section-card chessaz-ai-coach" aria-label={t.title}>
  <header><h2>{t.title}</h2><p>{t.desc}</p></header>
  <label style={{display:'grid',gap:6,margin:'12px 0'}}>SAN · moves / Züge / Ходы<input aria-label="Opening SAN moves" value={moves} maxLength={250} onChange={e=>{setMoves(e.target.value);setLesson(null);}} placeholder="e4 e5 Nf3 Nc6"/></label>
  <label style={{display:'grid',gap:6,marginBottom:12}}>Color / Farbe / Цвет<select aria-label="Playing color" value={color} onChange={e=>{setColor(e.target.value as 'white'|'black');setLesson(null);}}><option value="white">White · Weiß · Белые</option><option value="black">Black · Schwarz · Чёрные</option></select></label>
  <button type="button" disabled={!token||busy||!moves.trim()} onClick={()=>void prepare()}>{busy?t.busy:t.start}</button>
  {!token&&<p role="status">{t.auth}</p>}{error&&<p role="alert">{error}</p>}
  {lesson&&<div className="chessaz-ai-coach-results" aria-live="polite">
   <p><strong>{lesson.moves?.join(' ')}</strong> · {lesson.turn==='white'?'White to move':'Black to move'}</p>
   <p>{t.total}: <strong>{lesson.matched}</strong> · {t.inspected}: <strong>{lesson.inspected}</strong></p>
   <p>{lesson.briefing?<><strong>{t.ai}:</strong> {lesson.briefing}</>:t.noAi}</p>
   <p className="chessaz-ai-coach-note">{t.sample}</p>
   {!lesson.groups.length&&<p>{t.empty}</p>}
   {lesson.groups.map(group=><details key={group.move} className="chessaz-ai-coach-group">
    <summary><strong>{group.move}</strong> <span>{t.examples}: {group.games.length}</span></summary>
    <div className="chessaz-ai-coach-group-body">
     <p><strong>{t.replies}:</strong> {group.blackReplies?.map(m=>m.move+' ('+m.count+')').join(', ')||'—'}</p>
     <p className="chessaz-ai-coach-note">{t.notice}</p>
     <ol>{group.games.map(game=><li key={game.id}>
      <strong>{game.white} – {game.black}</strong> · {game.result}
      <p>{game.date||'—'} · {game.event}</p>
      <p><strong>{t.moves}:</strong> {formatLine(game.first25)}</p>
      <button type="button" onClick={()=>view(game.pgn)}>{t.open}</button>
     </li>)}</ol>
    </div>
   </details>)}
  </div>}
 </section>;
}
