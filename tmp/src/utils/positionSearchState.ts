const prefix='chessaz:position-search:v1:';
// A queued effect from the old session must not repopulate snapshots after logout.
let revision=0;
export function positionSearchRevision(){return revision;}
export function readPositionSearchState<T>(account:string,slot=''):T|null{try{const raw=sessionStorage.getItem(prefix+account+(slot?':'+slot:''));if(raw&&raw.length>1024*1024)return null;const value=JSON.parse(raw||'null');return value&&value.version===1&&value.payload&&typeof value.payload==='object'?value.payload as T:null;}catch{return null;}}
export function writePositionSearchState(account:string,payload:unknown,slot='',expectedRevision=revision){if(expectedRevision!==revision)return;try{const value=JSON.stringify({version:1,payload});if(value.length<=1024*1024)sessionStorage.setItem(prefix+account+(slot?':'+slot:''),value);}catch{/* Storage is optional (private mode or quota). */}}
export function clearPositionSearchState(){revision++;try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith(prefix))sessionStorage.removeItem(key);}}catch{/* No storage access. */}}
