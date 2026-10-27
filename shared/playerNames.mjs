// Exact full-name fallback only. Do not strip accents, expand initials or guess
// name order. Official PGN/FIDE records use "Surname, Given name".
export function fullNameKey(value){
 if(typeof value!=='string'||value.length>150)return null;
 const parts=value.normalize('NFC').trim().split(',');
 if(parts.length!==2||parts.some(p=>!p.trim()))return null;
 return parts.map(p=>p.trim().replace(/\s+/g,' ').toLowerCase()).join(', ');
}
