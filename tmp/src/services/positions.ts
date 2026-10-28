export type PositionSide='white'|'black'|'any';
export interface PositionGame {id:string;pgn:string;white:string;black:string;whiteFideId:string|null;blackFideId:string|null;whiteRating:number|null;blackRating:number|null;event:string;date:string|null;result:string;ply:number;perspective:'white'|'black';outcome:'win'|'draw'|'loss'|'unknown';source:string;sourceUrl:string;licenseUrl:string}
export interface PlayerPositionStats {total:number;firstWhite:{move:string;count:number}[];replyE4:{move:string;count:number}[];replyD4:{move:string;count:number}[]}
export interface PositionSearchResult {fallback:boolean;fallbackGames:PositionGame[];fallbackTotal:number;fallbackNextMoves:PositionSearchResult['nextMoves'];fallbackScope:'all'|null;playerStats:PlayerPositionStats|null;scope:'all'|'nrw';sort:'newest'|'strongest';nrwCount:number;games:PositionGame[];total:number;nextMoves:{move:string;count:number;winPct:number;drawPct:number;lossPct:number}[];side:PositionSide;perspective:'white'|'black'|'player';maxIndexedPlies:number;searchMs:number}
export class PositionSearchError extends Error {code:string;retryAfter:number;constructor(code:string,retryAfter=0){super(code);this.code=code;this.retryAfter=retryAfter;}}
export function positionSearchEnabled(value:unknown){return value==='true';}
export function createPositionSearchApi(base:string,fetchImpl:typeof fetch=fetch){
 const root=new URL(base);if(root.protocol!=='https:'&&!(root.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(root.hostname)))throw new PositionSearchError('configuration');
 return {async search({fen,side,fideId,scope='all',sort='newest'}:{fen:string;side:PositionSide;fideId:string;scope?:'all'|'nrw';sort?:'newest'|'strongest'},token:string,signal:AbortSignal):Promise<PositionSearchResult>{
  if(!token)throw new PositionSearchError('authentication_required');
  const query=new URLSearchParams({fen,side,scope,sort,limit:'10'});if(fideId)query.set('fideId',fideId);
  const response=await fetchImpl(new URL('/api/positions/search?'+query,root),{signal,cache:'no-store',headers:{Authorization:'Bearer '+token}}),data=await response.json();
  if(!response.ok)throw new PositionSearchError(typeof data.code==='string'?data.code:'index_unavailable',Number(response.headers.get('Retry-After'))||0);
  if(!Array.isArray(data.games)||data.games.length>50||!Array.isArray(data.nextMoves))throw new PositionSearchError('index_unavailable');
  return data;
 }};
}
