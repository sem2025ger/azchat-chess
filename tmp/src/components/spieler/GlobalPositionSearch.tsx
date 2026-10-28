import {useEffect,useRef,useState,type FormEvent} from 'react';
import {DEFAULT_POSITION} from 'chess.js';
import {useNavigate} from 'react-router-dom';
import {useRegionalCopy} from '../../i18n/regionalCopy';
import {createSpielerApi,openSpielerAnalysis,type SpielerPlayer} from '../../services/spieler';
import {createPositionSearchApi,PositionSearchError,type PositionSearchResult,type PositionSide} from '../../services/positions';
import {readPositionSearchState,writePositionSearchState} from '../../utils/positionSearchState';
import type {PreparationBoardState} from '../../utils/preparationBoardState';
import PreparationBoard from './PreparationBoard';
import '../../screens/VorbereitungScreen.css';
import './GlobalPositionSearch.css';

type SavedSearch={fen:string;side:PositionSide;fideId:string;name:string;scope:'all'|'nrw';sort:'newest'|'strongest';nrwCount:number|null;players:SpielerPlayer[];result:PositionSearchResult|null;boardState?:PreparationBoardState};
export default function GlobalPositionSearch({token,accountId='guest'}:{token:string;accountId?:string}){
 const tr=useRegionalCopy(),navigate=useNavigate();
 const [saved]=useState(()=>readPositionSearchState<SavedSearch>(accountId));
 const [boardState,setBoardState]=useState(saved?.boardState);
 const [fen,setFen]=useState(saved?.fen||DEFAULT_POSITION),[side,setSide]=useState<PositionSide>(saved?.side||'any'),[fideId,setFideId]=useState(saved?.fideId||''),[name,setName]=useState(saved?.name||'');
 const [scope,setScope]=useState<'all'|'nrw'>(saved?.scope||'all'),[sort,setSort]=useState<'newest'|'strongest'>(saved?.sort||'newest'),[nrwCount,setNrwCount]=useState<number|null>(saved?.nrwCount??null);
 const [players,setPlayers]=useState<SpielerPlayer[]>(saved?.players||[]),[result,setResult]=useState<PositionSearchResult|null>(saved?.result||null),[busy,setBusy]=useState(false),[finding,setFinding]=useState(false),[error,setError]=useState('');
 useEffect(()=>{writePositionSearchState(accountId,{fen,side,fideId,name,scope,sort,nrwCount,players,result,boardState});},[accountId,fen,side,fideId,name,scope,sort,nrwCount,players,result,boardState]);
 const pending=useRef<AbortController|null>(null),lookup=useRef<AbortController|null>(null);
 useEffect(()=>()=>{pending.current?.abort();lookup.current?.abort();},[]);
 function invalidate(){pending.current?.abort();setBusy(false);setResult(null);setError('');}
 async function findPlayer(e:FormEvent){
  e.preventDefault();lookup.current?.abort();const c=new AbortController();lookup.current=c;setFinding(true);setError('');
  try{const found=await createSpielerApi(import.meta.env.VITE_SERVER_URL||'').search(name.trim(),token,c.signal);if(!c.signal.aborted)setPlayers(found);}
  catch{if(!c.signal.aborted)setError('Spielersuche derzeit nicht verfügbar.');}finally{if(!c.signal.aborted)setFinding(false);}
 }
 async function search(e?:FormEvent,nextScope=scope,nextSort=sort){
  e?.preventDefault();pending.current?.abort();const c=new AbortController();pending.current=c;setBusy(true);setError('');setResult(null);
  try{const data=await createPositionSearchApi(import.meta.env.VITE_SERVER_URL||'').search({fen,side,fideId,scope:nextScope,sort:nextSort},token,c.signal);if(!c.signal.aborted){setResult(data);setNrwCount(data.nrwCount);}}
  catch(e){if(!c.signal.aborted)setError(e instanceof PositionSearchError&&e.code==='index_warming'?'Die Suche wird vorbereitet. Bitte versuche es in wenigen Sekunden erneut.':e instanceof PositionSearchError&&e.code==='rate_limit'?'Zu viele Anfragen. Bitte warte eine Minute.':e instanceof PositionSearchError&&e.code==='invalid_fen'?'Ungültige Stellung':e instanceof PositionSearchError&&e.code==='authentication_required'?'Bitte zuerst anmelden':'Stellungssuche derzeit nicht verfügbar.');}
  finally{if(!c.signal.aborted)setBusy(false);}
 }
 function analyse(pgn:string,ply:number){try{navigate(openSpielerAnalysis(pgn,undefined,ply));}catch{setError('Diese Partie kann nicht geöffnet werden.');}}
 function gameList(games:PositionSearchResult['games']){return <ol className="vorbereitung-games">{games.map(g=><li key={g.id}><strong>{g.white}{g.whiteRating!=null?' ('+g.whiteRating+')':''} – {g.black}{g.blackRating!=null?' ('+g.blackRating+')':''}</strong><p>{g.date||'—'} · {g.event}</p><p>{g.result} · {tr(g.perspective==='white'?'Mit Weiß':'Mit Schwarz')} · {tr(g.outcome==='win'?'Sieg':g.outcome==='loss'?'Niederlage':g.outcome==='draw'?'Remis':'Ergebnis offen')}</p><p>Lichess broadcast · <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer">{tr('Quelldatei')}</a> · <a href={g.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></p><button type="button" onClick={()=>analyse(g.pgn,g.ply)}>{tr('In ChessAZ analysieren')}</button></li>)}</ol>;}
 function moveTable(moves:PositionSearchResult['nextMoves']){return !!moves.length&&<div className="vorbereitung-table"><table><caption>{tr('Nächste Züge · Ergebnisse aus deiner Sicht')}</caption><thead><tr><th>{tr('Zug')}</th><th>{tr('Partien')}</th><th>{tr('Sieg %')}</th><th>{tr('Remis %')}</th><th>{tr('Niederlage %')}</th></tr></thead><tbody>{moves.map(m=><tr key={m.move}><td>{m.move}</td><td>{m.count}</td><td>{m.winPct}%</td><td>{m.drawPct}%</td><td>{m.lossPct}%</td></tr>)}</tbody></table></div>;}
 return <section className="global-position-search vorbereitung-page section-card" aria-label={tr('Stellung in allen importierten Partien suchen')}>
  <header><h2>{tr('Stellung in allen importierten Partien suchen')}</h2><p>{tr('Die ersten 60 Halbzüge jeder importierten Partie. Neueste Partien zuerst.')}</p></header>
  <label>{tr('Suchbereich')}<select value={scope} onChange={e=>{const value=e.target.value as 'all'|'nrw';setScope(value);invalidate();if(token)void search(undefined,value);}}><option value="all">{tr('Gesamte Datenbank')}</option><option value="nrw">{tr('Nur NRW-Vereine')}</option></select></label>
  <p>{tr('NRW = Spieler, die ihr Profil und ihren NRW-Verein auf ChessAZ bestätigt haben.')} {tr('Bestätigte NRW-Spieler:')} {nrwCount??'—'}</p>
  {nrwCount===0&&<p role="status">{tr('Noch keine bestätigten NRW-Vereinsspieler.')}</p>}
  <div className="global-position-grid"><PreparationBoard fen={fen} initialState={boardState} onState={setBoardState} orientation={side==='black'?'b':'w'} onFen={value=>{invalidate();setFen(value);}}/>
   <div className="global-position-controls">
    <form onSubmit={e=>void search(e)}><label>{tr('Meine Farbe')}<select value={side} onChange={e=>{invalidate();setSide(e.target.value as PositionSide);}}><option value="black">{tr('Schwarz')}</option><option value="white">{tr('Weiß')}</option><option value="any">{tr('Beide Farben')}</option></select></label><label>{tr('FIDE-ID (optional)')}<input value={fideId} pattern="[1-9][0-9]{0,9}" maxLength={10} onChange={e=>{invalidate();setFideId(e.target.value);}}/></label><button disabled={busy||!token}>{tr('Stellung in der Datenbank suchen')}</button></form>
    <details className="section-info"><summary>{tr('Spielerfilter (optional)')}</summary><form onSubmit={findPlayer}><label>{tr('Nachname')}<input minLength={2} maxLength={100} required value={name} onChange={e=>{lookup.current?.abort();setFinding(false);setName(e.target.value);setPlayers([]);}}/></label><button disabled={finding||!token}>{tr('Spieler finden')}</button></form><ul>{players.map(p=><li key={p.fide_id}><button type="button" aria-pressed={fideId===String(p.fide_id)} onClick={()=>{invalidate();setFideId(String(p.fide_id));}}>{p.name} · FIDE {p.fide_id}</button></li>)}</ul></details>
    <p>{tr('Ohne Spielerfilter gilt die gewählte Farbe für die Ergebniswertung. Bei beiden Farben zählt die Seite am Zug; mit Spielerfilter die Farbe des Spielers.')}</p>
    {!token&&<p role="status">{tr('Bitte zuerst anmelden')}</p>}{busy&&<p role="status">{tr('Stellung wird gesucht …')}</p>}{error&&<p role="alert">{tr(error)}</p>}
   </div>
  </div>
  <label>{tr('Sortierung')}<select value={sort} onChange={e=>{const value=e.target.value as 'newest'|'strongest';setSort(value);invalidate();if(token)void search(undefined,scope,value);}}><option value="newest">{tr('Neueste zuerst')}</option><option value="strongest">{tr('Stärkste zuerst')}</option></select></label>
  {result&&<section className="global-position-results" aria-label={tr('Suchergebnisse')}>
   <h3>{result.total} {tr('passende Partien')}</h3><p>{tr(sort==='strongest'?'Stärkste zuerst':'Neueste zuerst')} · {tr('Angezeigt:')} {result.games.length}</p>
   {result.scope==='nrw'&&!result.games.length&&<div role="status"><p>{tr('Keine Partien von NRW-Vereinsspielern in dieser Stellung.')}</p><button type="button" onClick={()=>{setScope('all');void search(undefined,'all');}}>{tr('Gesamte Datenbank anzeigen')}</button></div>}
   {!result.fallback&&result.scope!=='nrw'&&!result.games.length&&<p role="status">{tr('Keine Partien erreichten diese Stellung.')}</p>}
   {moveTable(result.nextMoves)}
   {gameList(result.games)}
   {result.fallback&&<section className="position-fallback" aria-label={tr('Partien anderer Spieler · gesamte Datenbank')}>
    {!!result.playerStats?.total&&<div className="position-player-stats"><h4>{tr('Spielerstatistik')}</h4><p>{tr('Indexierte Partien:')} {result.playerStats.total}</p>{(['firstWhite','replyE4','replyD4'] as const).map((key,i)=><p key={key}>{tr(['Erster Zug mit Weiß','Antwort auf 1.e4 mit Schwarz','Antwort auf 1.d4 mit Schwarz'][i])}: {result.playerStats![key].map(m=>m.move+' ('+m.count+')').join(', ')||'—'}</p>)}</div>}
    <p role="status">{tr(result.playerStats?.total?'Keine Partien dieses Spielers erreichten diese Stellung. Hier sind aktuelle Partien anderer Spieler in derselben Stellung.':'Keine Partien dieses Spielers in unserer Datenbank. Hier sind aktuelle Partien anderer Spieler in derselben Stellung.')}</p>
    <h3>{tr('Partien anderer Spieler · gesamte Datenbank')} · {result.fallbackTotal}</h3>
    {!result.fallbackGames.length&&<p>{tr('Keine Partien erreichten diese Stellung.')}</p>}
    {moveTable(result.fallbackNextMoves)}
    {gameList(result.fallbackGames)}
   </section>}

  </section>}
 </section>;
}
