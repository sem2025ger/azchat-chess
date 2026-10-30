import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {DEFAULT_POSITION} from 'chess.js';
import {useNavigate} from 'react-router-dom';
import {useRegionalCopy} from '../../i18n/regionalCopy';
import {createSpielerApi,openSpielerAnalysis,type SpielerPlayer} from '../../services/spieler';
import {createPositionSearchApi,PositionSearchError,type PositionSearchResult,type PositionSide} from '../../services/positions';
import {readPositionSearchState,writePositionSearchState,positionSearchRevision} from '../../utils/positionSearchState';
import type {PreparationBoardState} from '../../utils/preparationBoardState';
import PreparationBoard from './PreparationBoard';
import CoachChat from './CoachChat';
import '../../screens/VorbereitungScreen.css';
import './GlobalPositionSearch.css';

type SavedSearch={fen:string;side:PositionSide;coachColor?:'white'|'black';fideId:string;name:string;scope:'all'|'nrw';sort:'newest'|'strongest';nrwCount:number|null;players:SpielerPlayer[];result:PositionSearchResult|null;boardState?:PreparationBoardState};
export default function GlobalPositionSearch({token,accountId='guest',coach}:{token:string;accountId?:string;coach?:(color:'white'|'black',onColorChange:(color:'white'|'black')=>void)=>ReactNode}){
 const tr=useRegionalCopy(),navigate=useNavigate();
 const [storageRevision]=useState(positionSearchRevision);
 const [saved]=useState(()=>readPositionSearchState<SavedSearch>(accountId));
 const [coachColor,setCoachColor]=useState<'white'|'black'>(()=>{const color=saved?.coachColor??readPositionSearchState<{color?:'white'|'black'}>(accountId,'preparation')?.color;return color==='white'?'white':'black';});
 const [boardState,setBoardState]=useState(saved?.boardState);
 const [fen,setFen]=useState(saved?.fen||DEFAULT_POSITION),[side,setSide]=useState<PositionSide>(saved?.side||'any'),[fideId,setFideId]=useState(saved?.fideId||''),[name,setName]=useState(saved?.name||'');
 const [scope,setScope]=useState<'all'|'nrw'>(saved?.scope||'all'),[sort,setSort]=useState<'newest'|'strongest'>(saved?.sort||'newest'),[nrwCount,setNrwCount]=useState<number|null>(saved?.nrwCount??null);
 const [players,setPlayers]=useState<SpielerPlayer[]>(saved?.players||[]),[result,setResult]=useState<PositionSearchResult|null>(saved?.result||null),[busy,setBusy]=useState(false),[finding,setFinding]=useState(false),[error,setError]=useState('');
 useEffect(()=>{writePositionSearchState(accountId,{fen,side,coachColor,fideId,name,scope,sort,nrwCount,players,result,boardState},'',storageRevision);},[storageRevision,accountId,fen,side,coachColor,fideId,name,scope,sort,nrwCount,players,result,boardState]);
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
  <header className="position-card-header"><h2>{tr('Partien nach Stellung suchen')}</h2></header>
  <div className="global-position-grid"><PreparationBoard showModeSwitcher={false} showMoveSearch={false} fen={fen} initialState={boardState} onState={setBoardState} orientation={side==='black'?'b':'w'} onFen={value=>{invalidate();setFen(value);}}/>
   <div className="global-position-right-rail">{coach?.(coachColor,setCoachColor)}<CoachChat fen={fen} side={coach?coachColor:side} token={token} accountId={accountId}/><div className="global-position-controls">
    <details className="section-info position-advanced-settings"><summary>{tr('Suchfilter')}</summary><div className="position-advanced-content"><fieldset className="position-segment" data-control="side"><legend>{tr('Meine Farbe')}</legend><div>{(['white','black','any'] as const).map(value=><button type="button" key={value} data-value={value} aria-pressed={side===value} onClick={()=>{invalidate();setSide(value);}}>{tr(value==='white'?'Weiß':value==='black'?'Schwarz':'Beide Farben')}</button>)}</div></fieldset>
    <fieldset className="position-segment" data-control="scope"><legend>{tr('Suchbereich')}</legend><div>{(['all','nrw'] as const).map(value=><button type="button" key={value} data-value={value} aria-pressed={scope===value} onClick={()=>{setScope(value);invalidate();if(token)void search(undefined,value);}}>{tr(value==='all'?'Gesamte Datenbank':'Nur NRW-Vereine')}{value==='nrw'&&<span className="position-count" aria-label={tr('Bestätigte NRW-Spieler:')}>{nrwCount??'—'}</span>}</button>)}</div></fieldset>
    {nrwCount===0&&<p className="position-empty-nrw" role="status">{tr('Noch keine bestätigten NRW-Vereinsspieler.')}</p>}
    <details className="section-info position-player-filter"><summary>{tr('Nur Partien eines bestimmten Spielers')}</summary><label>{tr('FIDE-ID (optional)')}<input form="global-position-form" value={fideId} pattern="[1-9][0-9]{0,9}" maxLength={10} onChange={e=>{invalidate();setFideId(e.target.value);}}/></label><form onSubmit={findPlayer}><label>{tr('Nachname')}<input minLength={2} maxLength={100} required value={name} placeholder={tr('Lateinische Buchstaben, z. B. Huseynov')} onChange={e=>{lookup.current?.abort();setFinding(false);setName(e.target.value);setPlayers([]);}}/></label><button disabled={finding||!token}>{tr('Spieler finden')}</button></form><ul>{players.map(p=><li key={p.fide_id}><button type="button" aria-pressed={fideId===String(p.fide_id)} onClick={()=>{invalidate();setFideId(String(p.fide_id));}}>{p.name} · FIDE {p.fide_id}</button></li>)}</ul></details></div></details>
    {busy&&<p role="status">{tr('Stellung wird gesucht …')}</p>}{error&&<p role="alert">{tr(error)}</p>}
    <form id="global-position-form" className="position-submit" onSubmit={e=>void search(e)}><button className="global-position-primary" disabled={busy||!token}><span className="position-search-metal-label">{tr('Stellung suchen')}</span></button></form>
   </div>
   </div>
  </div>
  {result&&<section className="global-position-results" aria-label={tr('Suchergebnisse')}>
   <header className="position-results-header"><h3>{result.total} {tr('Partien')}</h3>{(result.total>0||result.fallbackTotal>0)&&<fieldset className="position-segment position-sort" data-control="sort"><legend>{tr('Sortierung')}</legend><div>{(['newest','strongest'] as const).map(value=><button type="button" key={value} data-value={value} aria-pressed={sort===value} onClick={()=>{setSort(value);void search(undefined,scope,value);}}>{tr(value==='newest'?'Neueste':'Stärkste')}</button>)}</div></fieldset>}</header>
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
