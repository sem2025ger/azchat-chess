import { useState } from 'react';
import OpponentPreparation from './OpponentPreparation';
import VorbereitungLink from '../spieler/VorbereitungLink';
import type { SpieltagBoard, SpieltagMatch } from '../../services/spieltag';
const spieltagTabs = [{id:'lineup',label:'Aufstellung'},{id:'opponent',label:'Gegner'},{id:'round',label:'Nach der Runde'}] as const;
type SpieltagTab = typeof spieltagTabs[number]['id'];
export default function SpieltagMatchView({match,boards,captain,busy,spielerAvailable,onCard,onEdit,onDelete,onResult,onNotes,onLichess,initialTab='lineup'}: {
  match: SpieltagMatch; boards: SpieltagBoard[]; captain: boolean; busy: boolean; spielerAvailable: boolean;
  onCard: (id: string) => void; onEdit: (board: SpieltagBoard) => void; onDelete: (board: SpieltagBoard) => void;
  onResult: (board: SpieltagBoard,result: string | null) => void; onNotes: (notes: string) => void; initialTab?: SpieltagTab;
  onLichess?: (board:SpieltagBoard,username:string|null)=>void;
}) {
  const [tab,setTab]=useState<SpieltagTab>(initialTab),[notes,setNotes]=useState(match.notes);
  const player=(name: string,id: string | number | null)=><>{name || 'Noch nicht eingetragen'}{id && spielerAvailable && <button type="button" className="spieltag-link" onClick={()=>onCard(String(id))}>Spielerkarte · {id}</button>}</>;
  return <section className="spieltag-card" aria-label="Mannschaftskampf">
    <h2>{match.round_label} · {match.opponent_name}</h2>
    <p>{new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(match.starts_at))} (Berlin){match.venue?' · '+match.venue:''}</p>
    <div role="tablist" aria-label="Spieltag" className="spieltag-tabs" onKeyDown={e=>{
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();const index=spieltagTabs.findIndex(t=>t.id===tab);
      const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowLeft'?2:1))%3;
      setTab(spieltagTabs[next].id);document.getElementById('spieltag-tab-'+spieltagTabs[next].id)?.focus();
    }}>{spieltagTabs.map(t=><button key={t.id} id={'spieltag-tab-'+t.id} role="tab" aria-controls={'spieltag-panel-'+t.id} aria-selected={tab===t.id} tabIndex={tab===t.id?0:-1} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
    <div role="tabpanel" id={'spieltag-panel-'+tab} aria-labelledby={'spieltag-tab-'+tab}>
      {tab==='lineup' && <><h3>Eigene Aufstellung</h3><ol className="spieltag-boards">{boards.map(b=><li key={b.board_number}><strong>Brett {b.board_number}</strong>{player(b.home_name,b.home_fide_id)}{captain&&<div className="spieltag-actions"><button disabled={busy} onClick={()=>onEdit(b)}>Bearbeiten</button><button disabled={busy} onClick={()=>onDelete(b)}>Brett entfernen</button></div>}</li>)}</ol></>}
      {tab==='opponent' && <><h3>{match.opponent_name}</h3><ol className="spieltag-boards">{boards.map(b=><li key={b.board_number}><strong>Brett {b.board_number}</strong>{player(b.opponent_name,b.opponent_fide_id)}{import.meta.env.VITE_VORBEREITUNG_ENABLED==='true'&&<><VorbereitungLink fideId={b.opponent_fide_id} playerName={b.opponent_name}/><OpponentPreparation key={b.board_number+':'+b.opponent_lichess_username} username={b.opponent_lichess_username||null} captain={captain} busy={busy} onSave={value=>onLichess?.(b,value)}/></>}</li>)}</ol><p>FIDE-Verknüpfungen werden manuell eingetragen. Eine Verknüpfung bestätigt keine Identität.</p></>}
      {tab==='round' && <><h3>Ergebnisse aus eigener Mannschaftssicht</h3><ol className="spieltag-boards">{boards.map(b=><li key={b.board_number}><strong>Brett {b.board_number} · {b.home_name} – {b.opponent_name || 'Gegner offen'}</strong>{captain?<label>Ergebnis<select disabled={busy} value={b.result || ''} onChange={e=>onResult(b,e.target.value || null)}><option value="">Noch offen</option><option value="1-0">1–0 · eigener Sieg</option><option value="0-1">0–1 · eigene Niederlage</option><option value="1/2-1/2">½–½ · Remis</option><option value="not_played">Nicht gespielt</option></select></label>:<span>{b.result==='not_played'?'Nicht gespielt':b.result || 'Noch offen'}</span>}</li>)}</ol>
        {captain?<form className="spieltag-form" onSubmit={e=>{e.preventDefault();onNotes(notes);}}><label>Kurze Notizen<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button disabled={busy}>Notizen speichern</button></form>:<div className="spieltag-notes"><h3>Kurze Notizen</h3><p>{match.notes || 'Noch keine Notizen.'}</p></div>}
        <p>Manuell gepflegt. Keine Übertragung in Online-Partien, Ratings oder Ligatabellen.</p></>}
      {!boards.length&&<p>Noch keine Bretter eingetragen.</p>}
    </div>
  </section>;
}
