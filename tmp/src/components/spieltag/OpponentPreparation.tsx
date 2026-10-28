import { useRegionalCopy } from '../../i18n/regionalCopy';
import {useState} from 'react';
import VorbereitungLink from '../spieler/VorbereitungLink';
export default function OpponentPreparation({username,captain,busy,onSave}:{username:string|null;captain:boolean;busy:boolean;onSave:(value:string|null)=>void}){
 const tr=useRegionalCopy();
 const [value,setValue]=useState(username||'');
 return <div>{username&&<><p>{tr('Lichess-Konto')}: {username} {tr('(nicht verifiziert)')}</p><VorbereitungLink username={username}/></>}
  {captain&&<form className="spieltag-form" onSubmit={e=>{e.preventDefault();onSave(value.trim()||null);}}><label>{tr('Lichess-Benutzername des Gegners (nicht verifiziert)')}<input value={value} onChange={e=>setValue(e.target.value)} pattern="[A-Za-z0-9_-]{2,30}" maxLength={30} autoComplete="off"/></label><button disabled={busy}>{tr('Lichess-Zuordnung speichern')}</button><p>{tr('Nur für deine Mannschaft. Ein leerer Name entfernt die Zuordnung.')}</p></form>}
 </div>;
}
