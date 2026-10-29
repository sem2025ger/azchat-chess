const prefix='chessaz:position-search:v1:';
export function readPositionSearchState<T>(account:string):T|null{try{const value=JSON.parse(sessionStorage.getItem(prefix+account)||'null');return value&&value.version===1&&value.payload&&typeof value.payload==='object'?value.payload as T:null;}catch{return null;}}
export function writePositionSearchState(account:string,payload:unknown){try{sessionStorage.setItem(prefix+account,JSON.stringify({version:1,payload}));}catch{/* Storage is optional (private mode or quota). */}}
export function clearPositionSearchState(){try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith(prefix))sessionStorage.removeItem(key);}}catch{/* No storage access. */}}
