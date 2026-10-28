import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createSpieltagApi,spieltagEnabled,SpieltagError,scheduleFromMatch,boardInput,type SpieltagTeam,type SpieltagClub,type SpieltagMatch,type SpieltagBoard,type SpieltagSchedule,type SpieltagBoardInput } from '../services/spieltag';
import { createSpielerApi,type SpielerPlayer } from '../services/spieler';
import SpielerCard from '../components/spieler/SpielerCard';
import SpieltagMatchView from '../components/spieltag/SpieltagMatchView';
import { BoardForm,ScheduleForm } from '../components/spieltag/SpieltagForms';
import './SpielerScreen.css';
import './SpieltagScreen.css';
import '../styles/sections.css';

function message(error: unknown) {
  if (error instanceof SpieltagError) {
    if (error.code==='feature_disabled') return 'Spieltag ist derzeit deaktiviert.';
    if (error.code==='authentication_required') return 'Bitte melde dich erneut an.';
    if (error.code==='not_allowed' || error.code==='not_found') return 'Kein Zugriff. Bitte prüfe deine Mannschaftszuordnung.';
    if (error.code==='already_exists') return 'Dieses Brett ist bereits eingetragen. Bitte bearbeite den vorhandenen Eintrag.';
    if (error.code==='invalid_input') return 'Bitte prüfe die Eingaben und gegebenenfalls die FIDE-ID.';
    if (error.code==='rate_limit') return 'Bitte warte kurz und versuche es erneut.';
  }
  return 'Spieltag konnte nicht geladen oder gespeichert werden. Bitte erneut versuchen.';
}
export default function SpieltagScreen() {
  const {session}=useAuth();
  if (!spieltagEnabled(import.meta.env.VITE_SPIELTAG_ENABLED)) return <p role="status">Spieltag ist noch nicht aktiviert.</p>;
  if (!session) return <section className="spieltag-page"><h1>Spieltag</h1><Link to="/profile">Bitte zuerst anmelden</Link></section>;
  // Remounting on identity/token change immediately discards private state and
  // aborts every pending load/save/card request from the previous session.
  return <SpieltagWorkspace key={session.access_token} token={session.access_token}/>;
}
function SpieltagWorkspace({token}: {token: string}) {
  const [teams,setTeams]=useState<SpieltagTeam[]>([]),[clubs,setClubs]=useState<SpieltagClub[]>([]);
  const [teamId,setTeamId]=useState(''),[matches,setMatches]=useState<SpieltagMatch[]>([]),[matchId,setMatchId]=useState('');
  const [boards,setBoards]=useState<SpieltagBoard[]>([]),[refresh,setRefresh]=useState(0);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [scheduleEdit,setScheduleEdit]=useState<SpieltagMatch | null | undefined>(),[boardEdit,setBoardEdit]=useState<SpieltagBoard | null | undefined>();
  const [player,setPlayer]=useState<SpielerPlayer | null>(null),[cardError,setCardError]=useState('');
  const operations=useRef(new Set<AbortController>()),cardRequest=useRef<AbortController | null>(null);
  const team=teams.find(t=>t.id===teamId),match=matches.find(m=>m.id===matchId),captain=team?.role==='captain';
  const api=useCallback(()=>createSpieltagApi(import.meta.env.VITE_SERVER_URL || '',token),[token]);
  useEffect(()=>{const pending=operations.current;return()=>{for(const c of pending)c.abort();cardRequest.current?.abort();};},[]);
  useEffect(()=>{
    const c=new AbortController();setLoading(true);
    void (async()=>{try{const [t,cl]=await Promise.all([api().teams(c.signal),api().clubs(c.signal)]);if(!c.signal.aborted){setTeams(t);setClubs(cl);setTeamId(t[0]?.id || '');}}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setLoading(false);}})();
    return()=>c.abort();
  },[api]);
  useEffect(()=>{
    const c=new AbortController();setMatches([]);setMatchId('');setBoards([]);setPlayer(null);setScheduleEdit(undefined);setBoardEdit(undefined);setNotice('');
    if(teamId){setLoading(true);void (async()=>{try{const rows=await api().matches(teamId,c.signal);if(!c.signal.aborted){setMatches(rows);setMatchId(rows[0]?.id || '');}}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setLoading(false);}})();}
    return()=>c.abort();
  },[api,teamId]);
  useEffect(()=>{
    const c=new AbortController();setBoards([]);setPlayer(null);setCardError('');cardRequest.current?.abort();setBoardEdit(undefined);
    if(matchId){setLoading(true);void (async()=>{try{const rows=await api().boards(matchId,c.signal);if(!c.signal.aborted)setBoards(rows);}catch(e){if(!c.signal.aborted)setError(message(e));}finally{if(!c.signal.aborted)setLoading(false);}})();}
    return()=>c.abort();
  },[api,matchId,refresh]);
  async function mutate(action: (signal: AbortSignal) => Promise<void>) {
    if(busy || !captain)return;const c=new AbortController();operations.current.add(c);setBusy(true);setError('');setNotice('');
    try{await action(c.signal);if(!c.signal.aborted)setNotice('Gespeichert.');}catch(e){if(!c.signal.aborted)setError(message(e));}finally{operations.current.delete(c);if(!c.signal.aborted)setBusy(false);}
  }
  async function saveSchedule(value: SpieltagSchedule) {
    await mutate(async signal=>{const rows=await api().saveMatch(teamId,scheduleEdit?.id || null,value,signal);if(signal.aborted)return;
      setMatches(old=>[...old.filter(x=>x.id!==rows[0].id),...rows].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)));setMatchId(rows[0].id);setScheduleEdit(undefined);});
  }
  async function saveBoard(number: number,value: SpieltagBoardInput) {
    await mutate(async signal=>{await api().saveBoard(matchId,number,!!boardEdit,value,signal);if(!signal.aborted){setBoardEdit(undefined);setRefresh(n=>n+1);}});
  }
  async function openCard(id: string) {
    cardRequest.current?.abort();const c=new AbortController();cardRequest.current=c;setPlayer(null);setCardError('');
    try{const card=await createSpielerApi(import.meta.env.VITE_SERVER_URL || '').card(id,token,c.signal);if(!c.signal.aborted)setPlayer(card);}catch{if(!c.signal.aborted)setCardError('Spielerkarte nicht verfügbar. Das Profil kann ausgeblendet oder Spieler deaktiviert sein.');}
  }
  return <section className="spieltag-page section-page"><header><p className="spieler-eyebrow">Mannschaft intern</p><h1>Spieltag</h1><p>Termine, Aufstellung und Nachbesprechung deiner Mannschaft.</p></header>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{loading&&<p role="status">Wird geladen …</p>}
    {!loading&&!teams.length&&<p>Du bist noch keiner Mannschaft zugeordnet. Bitte wende dich an die Vereinsleitung.</p>}
    {!!teams.length&&<div className="spieltag-workspace"><section className="section-card spieltag-controls"><h2>Deine Mannschaft</h2><label>Mannschaft<select value={teamId} disabled={busy} onChange={e=>setTeamId(e.target.value)}>{teams.map(t=><option key={t.id} value={t.id}>{clubs.find(c=>c.id===t.club_id)?.name || 'Verein'} · {t.name}</option>)}</select></label>
      <p className="spieltag-role">{captain?'Du pflegst diese Mannschaft als Kapitänin oder Kapitän.':'Nur für bestätigte Mannschaftsmitglieder.'}</p>
      {captain&&<button disabled={busy||loading} onClick={()=>setScheduleEdit(null)}>Spieltermin eintragen</button>}
      {scheduleEdit!==undefined&&captain&&<ScheduleForm key={scheduleEdit?.id || 'new'} match={scheduleEdit} clubs={clubs} busy={busy} onSave={v=>void saveSchedule(v)} onCancel={()=>setScheduleEdit(undefined)}/>}
      {!!matches.length&&<label>Begegnung<select value={matchId} disabled={busy} onChange={e=>{setMatchId(e.target.value);setScheduleEdit(undefined);}}>{matches.map(m=><option key={m.id} value={m.id}>{m.round_label} · {m.opponent_name}</option>)}</select></label>}
      {!loading&&!matches.length&&<p>Noch keine Spieltermine eingetragen.</p>}
      {match&&captain&&<div className="spieltag-actions"><button disabled={busy} onClick={()=>setScheduleEdit(match)}>Termin bearbeiten</button><button disabled={busy||loading} onClick={()=>setBoardEdit(null)}>Brett hinzufügen</button></div>}
        {boardEdit!==undefined&&captain&&<BoardForm key={boardEdit?.board_number || 'new'} board={boardEdit} busy={busy} onSave={(n,v)=>void saveBoard(n,v)} onCancel={()=>setBoardEdit(undefined)}/>}
      <details className="section-info"><summary>Info</summary><p>Nur bestätigte Mannschaftsmitglieder können diese Vorbereitung lesen. Die Mannschaftsleitung pflegt Termine, Aufstellung und Ergebnisse. Keine Übertragung in Online-Partien, Ratings oder Ligatabellen.</p></details>
      </section>{match&&<>
        <SpieltagMatchView key={match.id} match={match} boards={boards} captain={!!captain} busy={busy||loading} spielerAvailable={import.meta.env.VITE_SPIELER_V1_ENABLED==='true'} onCard={id=>void openCard(id)} onEdit={setBoardEdit}
          onDelete={b=>{if(!window.confirm('Brett '+b.board_number+' aus dieser Aufstellung entfernen?'))return;void mutate(async signal=>{await api().deleteBoard(match.id,b.board_number,signal);if(!signal.aborted)setRefresh(n=>n+1);});}}
          onResult={(b,result)=>void mutate(async signal=>{const rows=await api().saveBoard(match.id,b.board_number,true,{...boardInput(b),result},signal);if(!signal.aborted)setBoards(old=>old.map(x=>x.board_number===b.board_number?rows[0]:x));})}
          onLichess={(b,username)=>void mutate(async signal=>{const rows=await api().saveLichess(match.id,b.board_number,username,signal);if(!signal.aborted)setBoards(old=>old.map(x=>x.board_number===b.board_number?rows[0]:x));})}
          onNotes={notes=>void mutate(async signal=>{const rows=await api().saveMatch(teamId,match.id,{...scheduleFromMatch(match),notes},signal);if(!signal.aborted)setMatches(old=>old.map(x=>x.id===match.id?rows[0]:x));})}/>
      </>}
    </div>}
    {cardError&&<p role="status">{cardError}</p>}{player&&<aside className="spieltag-card" aria-label="Spielerkarte"><button onClick={()=>{cardRequest.current?.abort();setPlayer(null);}}>Karte schließen</button><SpielerCard player={player}/></aside>}
  </section>;
}
