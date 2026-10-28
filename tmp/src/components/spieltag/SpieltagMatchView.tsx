import { useState } from 'react';
import { useRegionalCopy } from '../../i18n/regionalCopy';
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
  const tr=useRegionalCopy();
  const [tab,setTab]=useState<SpieltagTab>(initialTab),[notes,setNotes]=useState(match.notes);
  const player=(name: string,id: string | number | null)=><>{name || tr('Noch nicht eingetragen')}{id && spielerAvailable && <button type="button" className="spieltag-link" onClick={()=>onCard(String(id))}>{tr('Spielerkarte')} Â· {id}</button>}</>;
  return <section className="spieltag-card" aria-label={tr("Mannschaftska¶»§q«^