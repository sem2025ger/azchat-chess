import { useState, type FormEvent } from 'react';
import { useRegionalCopy } from '../../i18n/regionalCopy';
import type { SpieltagBoard, SpieltagBoardInput, SpieltagClub, SpieltagMatch, SpieltagSchedule } from '../../services/spieltag';
import { berlinDateTime,berlinDateTimeToIso } from '../../services/spieltag';
export function ScheduleForm({ match,clubs,busy,onSave,onCancel }: {
  match: SpieltagMatch | null; clubs: SpieltagClub[]; busy: boolean;
  onSave: (value: SpieltagSchedule) => void; onCancel: () => void;
}) {
  const tr=useRegionalCopy();
  const [date,setDate]=useState(match?berlinDateTime(match.starts_at):'');
  const [error,setError]=useState('');
  const [round,setRound]=useState(match?.round_label || '');
  const [opponent,setOpponent]=useState(match?.opponent_name || '');
  const [club,setClub]=useState(match?.opponent_club_id || '');
  const [venue,setVenue]=useState(match?.venue || '');
  function submit(e: FormEvent) {
    e.preventDefault();setError('');let startsAt: string;
    try { startsAt=berlinDateTimeToIso(date); } catch { setError(tr('Bitte wähle eine gültige, eindeutige Uhrzeit außerhalb der Zeitumstellung.'));return; }
    onSave({round_label:round,opponent_name:opponent,opponent_club_id:club || null,starts_at:startsAt,venue,notes:match?.notes || ''});
  }
  return <form className="spieltag-form" onSubmit={submit} aria-label="Spieltermin bearbeiten"><h3>{tr(match?'Termin bearbeiten':'Spieltermin eintragen')}</h3>
    <label>{tr("Runde")}<input required maxLength={80} value={round} onChange={e=>setRound(e.target.value)}/></label>
    <label>{tr("Gegnerische Mannschaft")}<input required minLength={2} maxLength={150} value={opponent} onChange={e=>setOpponent(e.target.value)}/></label>
    <label>{tr("Gegnerischer Verein (optional)")}<select value={club} onChange={e=>setClub(e.target.value)}><option value="">{tr("Ohne Verknüpfung")}</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>{tr("Datum und Uhrzeit (Deutschland)")}<input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>{tr("Spielort")}<input maxLength={250} value={venue} onChange={e=>setVenue(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}
    <div className="spieltag-actions"><button disabled={busy}>{tr("Termin speichern")}</button><button type="button" onClick={onCancel}>{tr("Abbrechen")}</button></div>
  </form>;
}
export function BoardForm({ board,busy,onSave,onCancel }: {
  board: SpieltagBoard | null; busy: boolean; onSave: (number: number,value: SpieltagBoardInput) => void; onCancel: () => void;
}) {
  const tr=useRegionalCopy();
  const [number,setNumber]=useState(board?.board_number || 1);
  const [home,setHome]=useState(board?.home_name || ''),[homeId,setHomeId]=useState(String(board?.home_fide_id || ''));
  const [opponent,setOpponent]=useState(board?.opponent_name || ''),[opponentId,setOpponentId]=useState(String(board?.opponent_fide_id || ''));
  return <form className="spieltag-form" aria-label={tr("Aufstellung bearbeiten")} onSubmit={e=>{e.preventDefault();onSave(number,{home_name:home,home_fide_id:homeId || null,opponent_name:opponent,opponent_fide_id:opponentId || null,result:board?.result || null});}}>
    <label>{tr("Brett")}<input type="number" required min={1} max={32} value={number} disabled={!!board} onChange={e=>setNumber(Number(e.target.value))}/></label>
    <label>{tr("Eigene Spielerin / eigener Spieler")}<input required maxLength={150} value={home} onChange={e=>setHome(e.target.value)}/></label>
    <label>{tr("Eigene FIDE-ID (optional)")}<input inputMode="numeric" pattern="[1-9][0-9]{0,9}" maxLength={10} value={homeId} onChange={e=>setHomeId(e.target.value)}/></label>
    <label>{tr("Gegnerin / Gegner")}<input maxLength={150} value={opponent} onChange={e=>setOpponent(e.target.value)}/></label>
    <label>{tr("Gegnerische FIDE-ID (optional)")}<input inputMode="numeric" pattern="[1-9][0-9]{0,9}" maxLength={10} value={opponentId} onChange={e=>setOpponentId(e.target.value)}/></label>
    <div className="spieltag-actions"><button disabled={busy}>{tr("Brett speichern")}</button><button type="button" onClick={onCancel}>{tr("Abbrechen")}</button></div>
  </form>;
}
