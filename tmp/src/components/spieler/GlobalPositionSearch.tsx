import {useEffect,useRef,useState,type FormEvent} from 'react';
import {DEFAULT_POSITION} from 'chess.js';
import {useNavigate} from 'react-router-dom';
import {useRegionalCopy} from '../../i18n/regionalCopy';
import {createSpielerApi,openSpielerAnalysis,type SpielerPlayer} from '../../services/spieler';
import {createPositionSearchApi,PositionSearchError,type PositionSearchResult,type PositionSide} from '../../services/positions';
import PreparationBoard from './PreparationBoard';
import '../../screens/VorbereitungScreen.css';
import './GlobalPositionSearch.css';

export default function GlobalPositionSearch({token}:{token:string}){
 const tr=useRegionalCopy(),navigate=useNavigate();
 const [fen,setFen]=useState(DEFAULT_POSITION),[side,setSide]=useState<PositionSide>('any'),[fideId,setFideId]=useState(''),[name,setName]=useState('');
 const [players,setPlayers]=useState<SpielerPlayer[]>([]),[result,setResult]=useState<PositionSearchResult|null>(null),[busy,setBusy]=useState(false),[finding,setFinding]=useState(false),[error,setError]=useState('');
 const pending=useRef<AbortController|null>(null),lookup=useRef<AbortController|null>(null);
 useEffect(()=>()=>{pending.current?.abort();lookup.current?.abort();},[]);
 function invalidate(){pending.current?.abort();setBusy(false);setResult(null);setError('');}
 async function findPlayer(e:FormEvent){
  e.preventDefault();lookup.current?.abort();const c=new AbortController();lookup.current=c;setFinding(true);setError('');
  try{const found=await createSpielerApi(import.meta.env.VITE_SERVER_URL||'').search(name.trim(),token,c.signal);if(!c.signal.aborted)setPlayers(found);}
  catch{if(!c.signal.aborted)setError('Spielersuche derzeit nicht verfügbar.');}finally{if(!c.signal.aborted)setFinding(false);}
 }
 async function search(e:FormEvent){
  e.preventDefault();pending.current?.abort();const c=new AbortController();pending.current=c;setBusy(true);setError('');setResult(null);
  try{const data=await createPositionSearchApi(import.meta.env.VITE_SERVER_URL||'').search({fen,side,fideId},token,c.signal);if(!c.signal.aborted)setResult(data);}
  catch(e){if(!c.signal.aborted)setError(e instanceof PositionSearchError&&e.code==='index_warming'?'Die Suche wird vorbereitet. Bitte versuche es in wenigen Sekunden erneut.':e instanceof PositionSearchError&&e.code==='rate_limit'?'Zu viele Anfragen. Bitte warte eine Minute.':e instanceof PositionSearchError&&e.code==='invalid_fen'?'Ungültige Stellung':e instanceof PositionSearchError&&e.code==='authentication_required'?'Bitte zuerst anmelden':'Stellungssuche derzeit nicht verfügbar.');}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 function analyse(pgn:string,ply:number){try{navigate(openSpielerAnalysis(pgn,undefined,ply));}catch{setError('Diese Partie kann nicht geöffnet werden.');}}
 return <section className="global-position-search vorbereitung-page section-card" aria-label={tr('Stellung in allen importierten Partien suchen')}>
  <header><h2>{tr('Stellung in allen importierten Partien suchen')}</h2><p>{tr('Die ersten 60 Halbzüge jeder importierten Partie. Neueste Partien zuerst.')}</p></header>
  <div className="global-position-grid"><PreparationBoard fen={fen} onFen={value=>{invalidate();setFen(value);}}/>
   <div className="global-position-controls">
    <form onSubmit={search}><label>{tr('Meine Farbe')}<select value={side} onChange={e=>{invalidate();setSide(e.target.value as PositionSide);}}><option value="black">{tr('Schwarz')}</option><option value="white">{tr('Weiß')}</option><option value="any">{tr('Beide Farben')}</option></select></label><label>{tr('FIDE-ID (optional)')}<input value={fideId} pattern="[1-9][0-9]{0,9}" maxLength={10} onChange={e=>{invalidate();setFideId(e.target.value);}}/></label><button disabled={busy||!token}>{tr('Stellung in der Datenbank suchen')}</button></form>
    <details className="section-info"><summary>{tr('Spielerfilter (optional)')}</summary><form onSubmit={findPlayer}><label>{tr('Nachname')}<input minLength={2} maxLength={100} required value={name} onChange={e=>{lookup.current?.abort();setFinding(false);setName(e.target.value);setPlayers([]);}}/></label><button disabled={finding||!token}>{tr('Spieler finden')}</button></form><ul>{players.map(p=><li key={p.fide_id}><button type="button" aria-pressed={fideId===String(p.fide_id)} onClick={()=>{invalidate();setFideId(String(p.fide_id));}}>{p.name} · FIDE {p.fide_id}</button></li>)}</ul></details>
    <p>{tr('Ohne Spielerfilter gilt die gewählte Farbe für die Ergebniswertung. Bei beiden Farben zählt die Seite am Zug; mit Spielerfilter die Farbe des Spielers.')}</p>
    {!token&&<p role="status">{tr('Bitte zuerst anmelden')}</p>}{busy&&<p role="status">{tr('Stellung wird gesucht …')}</p>}{error&&<p role="alert">{tr(error)}</p>}
   </div>
  </div>
  {result&&<section className="global-position-results" aria-label={tr('Suchergebnisse')}>
   <h3>{result.total} {tr('passende Partien')}</h3><p>{tr('Neueste Partien zuerst. Angezeigt:')} {result.games.length}</p>
   {!result.games.length&&<p role="status">{tr('Keine Partien erreichten diese Stellung.')}</p>}
   {!!result.nextMoves.length&&<div className="vorbereitung-table"><table><caption>{tr('Nächste Züge · Ergebnisse aus deiner Sicht')}</caption><thead><tr><th>{tr('Zug')}</th><th>{tr('Partien')}</th><th>{tr('Sieg %')}</th><th>{tr('Remis %')}</th><th>{tr('Niederlage %')}</th></tr></thead><tbody>{result.nextMoves.map(m=><tr key={m.move}><td>{m.move}</td><td>{m.count}</td><td>{m.winPct}%</td><td>{m.drawPct}%</td><td>{m.lossPct}%</td></tr>)}</tbody></table></div>}
   <ol className="vorbereitung-games">{result.games.map(g=><li key={g.id}><strong>{g.white}{g.whiteRating!=null?' ('+g.whiteRating+')':''} – {g.black}{g.blackRating!=null?' ('+g.blackRating+')':''}</strong><p>{g.date||'—'} · {g.event}</p><p>{g.result} · {tr(g.perspective==='white'?'Mit Weiß':'Mit Schwarz')} · {tr(g.outcome==='win'?'Sieg':g.outcome==='loss'?'Niederlage':g.outcome==='draw'?'Remis':'Ergebnis offen')}</p><p>Lichess broadcast · <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer">{tr('Quelldatei')}</a> · <a href={g.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></p><button type="button" onClick={()=>analyse(g.pgn,g.ply)}>{tr('In ChessAZ analysieren')}</button></li>)}</ol>
  </section>}
 </section>;
}
