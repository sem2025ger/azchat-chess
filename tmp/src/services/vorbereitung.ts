import type { PreparationGame } from '../../../shared/vorbereitung.mjs';
export type { PreparationGame } from '../../../shared/vorbereitung.mjs';
export function vorbereitungEnabled(value:unknown){return value==='true';}
export class VorbereitungError extends Error {code:string;retryAfter:number;constructor(code:string,retryAfter=0){super(code);this.code=code;this.retryAfter=retryAfter;}}
export function createVorbereitungApi(base:string,fetchImpl:typeof fetch=fetch){
 const root=new URL(base);if(root.protocol!=='https:'&&!(root.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(root.hostname)))throw new VorbereitungError('configuration');
 return {async named({fideId,name}:{fideId?:string|null;name?:string|null},token:string,signal:AbortSignal):Promise<{fideId:string|null;name:string|null;games:PreparationGame[];rejected:number;candidates:{fideId:string;name:string}[];ambiguous?:boolean}>{
  if(!token)throw new VorbereitungError('authentication_required');
  const query=new URLSearchParams();if(fideId){if(!/^[1-9]\d{0,9}$/.test(fideId))throw new VorbereitungError('invalid_query');query.set('fideId',fideId);}else if(name)query.set('name',name);
  const r=await fetchImpl(new URL('/api/vorbereitung/player?'+query,root),{signal,cache:'no-store',headers:{Authorization:'Bearer '+token}});const data=await r.json();
  if(!r.ok)throw new VorbereitungError(data.code||'provider_unavailable');return data;
 },async load(username:string,token:string,signal:AbortSignal):Promise<{nickname:string;games:PreparationGame[];rejected:number}>{
  if(!token)throw new VorbereitungError('authentication_required');if(!/^[A-Za-z0-9_-]{2,30}$/.test(username))throw new VorbereitungError('invalid_query');
  const response=await fetchImpl(new URL('/api/vorbereitung/'+encodeURIComponent(username),root),{signal,cache:'no-store',headers:{Authorization:'Bearer '+token}});
  const data=await response.json();if(!response.ok)throw new VorbereitungError(typeof data.code==='string'?data.code:'provider_unavailable',Number(data.retryAfter)||0);
  if(!Array.isArray(data.games)||data.games.length>200)throw new VorbereitungError('provider_unavailable');return data;
 }};
}
