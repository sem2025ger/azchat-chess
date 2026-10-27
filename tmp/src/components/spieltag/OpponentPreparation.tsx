import {useState} from 'react';
import VorbereitungLink from '../spieler/VorbereitungLink';
export default function OpponentPreparation({username,captain,busy,onSave}:{username:string|null;captain:boolean;busy:boolean;onSave:(value:string|null)=>void}){
 const [value,setValue]=useState(username||'');
 return <div>{username&&<><p>Lichess-Konto: {username} (nicht verifiziert)</p><VorbereitungLink username={username}/></>}
  {captain&&<form className="spieltag-form" onSubmit={e=>{e.preventDefault();onSave(value.trim()||null);}}><label>Lichess-Benutzername des Gegners (nicht verifiziert)<input value={value} onChange={e=>setValue(e.target.value)} pattern="[A-Za-z0-9_-]{2,30}" maxLength={30} autoComplete="off"/></label><button disabled={busy}>Lichess-Zuordnung speichern</button><p>Nur für deine Mannschaft. Ein leerer Name entfernt die Zuordnung.</p></form>}
 </div>;
}
