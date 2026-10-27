import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {createVorbereitungApi,VorbereitungError,vorbereitungEnabled,type PreparationGame} from '../services/vorbereitung';
import {openSpielerAnalysis} from '../services/spieler';
import VorbereitungResults from '../components/spieler/VorbereitungResults';
import NamedPreparation from '../components/spieler/NamedPreparation';
import './VorbereitungScreen.css';
export default function VorbereitungScreen(){
 const {session}=useAuth(),location=useLocation(),navigate=useNavigate();
 const initial=typeof location.state?.lichessUsername==='string'?location.state.lichessUsername:'';
 const initialFideId=typeof location.state?.playerFideId==='string'?location.state.playerFideId:null;
 const initialName=typeof location.state?.playerName==='string'?location.state.playerName:'';
 // Consume the team-origin seed once; a later account/session change starts
 // blank and cannot recover another member's preparation target from history.
 useEffect(()=>{if(session?.access_token&&(initial||initialFideId||initialName))navigate(location.pathname,{replace:true,state:null});},[session?.access_token,initial,initialFideId,initialName,location.pathname,navigate]);
 if(!vorbereitungEnabled(import.meta.env.VITE_VORBEREITUNG_ENABLED))return <p role="status">Vorbereitung ist noch nicht aktiviert.</p>;
 if(!session)return <section className="vorbereitung-page"><h1>Vorbereitung</h1><Link to="/profile">Bitte zuerst anmelden</Link></section>;
 return <PreparationSources key={session.access_token} token={session.access_token} initial={initial} initialFideId={initialFideId} initialName={initialName}/>;
}
function PreparationSources({token,initial,initialFideId,initialName}:{token:string;initial:string;initialFideId:string|null;initialName:string}){
 const [seed]=useState({initial,initialFideId,initialName});
 return <section className="vorbereitung-page"><h1>Vorbereitung</h1><NamedPreparation token={token} initialFideId={seed.initialFideId} initialName={seed.initialName}/><details open><summary>Lichess-Benutzername — zweite Quelle</summary><VorbereitungWorkspace token={token} initial={seed.initial}/></details></section>;
}
function VorbereitungWorkspace({token,initial}:{token:string;initial:string}){
 const navigate=useNavigate(),[username,setUsername]=useState(initial),[loaded,setLoaded]=useState('');
 const [games,setGames]=useState<PreparationGame[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rejected,setRejected]=useState(0);
 const [color,setColor]=useState('all'),[speed,setSpeed]=useState('all'),[timeControl,setTimeControl]=useState('all'),[variation,setVariation]=useState('');
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 async function load(e:FormEvent){e.preventDefault();pending.current?.abort();const c=new AbortController();pending.current=c;setError('');setBusy(true);setLoaded('');setGames([]);
  try{const data=await createVorbereitungApi(import.meta.env.VITE_SERVER_URL||'').load(username.trim(),token,c.signal);if(!c.signal.aborted){setGames(data.games);setLoaded(data.nickname);setRejected(data.rejected);setColor('all');setSpeed('all');setTimeControl('all');setVariation('');}}
  catch(e){if(!c.signal.aborted)setError(e instanceof VorbereitungError&&e.code==='lichess_rate_limit'?`Lichess bittet um eine Pause. Bitte in ${e.retryAfter||60} Sekunden erneut versuchen.`:e instanceof VorbereitungError&&e.code==='rate_limit'?'Zu viele Anfragen. Bitte warte eine Minute.':'Partien konnten nicht geladen werden. Bitte prüfe den Namen und versuche es später erneut.');}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 function analyse(pgn:string){try{navigate(openSpielerAnalysis(pgn));}catch{setError('Diese Partie kann nicht in der Analyse geöffnet werden.');}}
 const controls=[...new Set(games.map(g=>g.timeControl))];
 return <section className="vorbereitung-page"><header><h2>Lichess-Konto (zweite Quelle)</h2><p>Öffentliche Lichess-Partien eines Kontos · bis zu 200 neueste abgeschlossene Standardpartien.</p></header>
  <form onSubmit={e=>void load(e)}><label>Lichess-Benutzername<input required minLength={2} maxLength={30} pattern="[A-Za-z0-9_-]+" autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label><button disabled={busy}>Partien laden</button></form>
  {busy&&<p role="status">Partien werden geladen …</p>}{error&&<p role="alert">{error}</p>}
  {loaded&&<><p>Lichess-Konto: {loaded} (nicht verifiziert)</p><p>Stichprobe, kein vollständiges Repertoire. Eröffnungsnamen und ECO stammen von Lichess. Die Stichprobe kann bis zu 15 Minuten alt sein.</p>{rejected>0&&<p>{rejected} nicht unterstützte oder ungültige Einträge ausgelassen.</p>}
   <div className="vorbereitung-filters"><label>Farbe<select value={color} onChange={e=>setColor(e.target.value)}><option value="all">Beide Farben</option><option value="white">Weiß</option><option value="black">Schwarz</option></select></label>
    <label>Bedenkzeit<select value={speed} onChange={e=>setSpeed(e.target.value)}><option value="all">Alle Bedenkzeiten</option>{['ultraBullet','bullet','blitz','rapid','classical','correspondence'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label>Zeitkontrolle (Sekunden + Inkrement)<select value={timeControl} onChange={e=>setTimeControl(e.target.value)}><option value="all">Alle Zeitkontrollen</option>{controls.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label>Eröffnung oder Variante (Name / ECO)<input maxLength={150} placeholder="Najdorf oder B90" value={variation} onChange={e=>setVariation(e.target.value)}/></label></div>
   <VorbereitungResults games={games} filters={{color,speed,timeControl,variation}} onAnalyse={analyse}/>
  </>}
 </section>;
}
