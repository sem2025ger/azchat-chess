'use strict';
const { Chess }=require('chess.js');
const { createHash }=require('node:crypto');
const MAX_BYTES=2*1024*1024;
const PREPARATION_BYTES=8*1024*1024;
const LICHESS_AGENT='ChessAZ/1.0 (+https://github.com/sem2025ger/azchat-chess/issues)';
function cooldownError(seconds=60){return Object.assign(Error('lichess_rate_limit'),{code:'lichess_rate_limit',retryAfter:seconds});}
function createLichessAccess({now=Date.now}={}){
 let tail=Promise.resolve(),waiting=0,blockedUntil=0;
 return {now,cache:new Map(),pending:new Map(),
  async run(fetchImpl,url,accept,consume){
   if(waiting>=16)throw Object.assign(Error('provider_busy'),{code:'provider_busy'});
   waiting++;const before=tail;let release;tail=new Promise(r=>{release=r;});
   await before;
   try{
    if(now()<blockedUntil)throw cooldownError(Math.ceil((blockedUntil-now())/1000));
    const response=await fetchImpl(url,{headers:{Accept:accept,'User-Agent':LICHESS_AGENT},redirect:'error',signal:AbortSignal.timeout(30000)});
    if(response.status===429){blockedUntil=now()+60000;await response.body?.cancel().catch(()=>{});throw cooldownError();}
    try{return await consume(response);}finally{await response.body?.cancel().catch(()=>{});}
   }finally{waiting--;release();}
  }};
}
const sharedLichess=createLichessAccess();
async function readPreparation(response,nickname){
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error('provider_unavailable');}
 if(Number(response.headers.get('content-length'))>PREPARATION_BYTES){await response.body?.cancel().catch(()=>{});throw Error('provider_too_large');}
 const reader=response.body?.getReader();if(!reader)throw Error('provider_unavailable');
 const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,buffer='',lines=0,rejected=0;const games=new Map();
 function line(text){
  if(!text.trim())return;
  if(Buffer.byteLength(text)>131072)throw Error('provider_too_large');
  lines++;const raw=JSON.parse(text);
  try{
   const white=raw.players?.white?.user?.id?.toLowerCase(),black=raw.players?.black?.user?.id?.toLowerCase();
   const color=white===nickname?'white':black===nickname?'black':null;
   if(!color||white===black||raw.variant!=='standard'||!['mate','resign','stalemate','timeout','outoftime','draw','variantEnd'].includes(raw.status))throw Error();
   const g=normalizeGame(raw.pgn,'lichess');
   if(!['1-0','0-1','1/2-1/2'].includes(g.result)||!Number.isFinite(raw.createdAt)||!/^[a-zA-Z0-9]{8}$/.test(raw.id))throw Error();
   if(raw.winner&&g.result!==(raw.winner==='white'?'1-0':'0-1'))throw Error();
   if(!['ultraBullet','bullet','blitz','rapid','classical','correspondence'].includes(raw.speed))throw Error();
   const timeControl=raw.clock&&Number.isFinite(raw.clock.initial)&&Number.isFinite(raw.clock.increment)?raw.clock.initial+'+'+raw.clock.increment:'correspondence';
   if(!games.has(raw.id))games.set(raw.id,{...g,id:'lichess:'+raw.id,lichessId:raw.id,color,speed:raw.speed,timeControl,createdAt:raw.createdAt,
    opening:typeof raw.opening?.name==='string'?raw.opening.name.slice(0,200):'Unbekannte Eröffnung',
    eco:/^[A-E]\d\d$/.test(raw.opening?.eco||'')?raw.opening.eco:null});
  }catch{rejected++;}
 }
 try{
  while(lines<200){const {value,done}=await reader.read();if(done){buffer+=decoder.decode();if(buffer.trim())line(buffer);break;}
   bytes+=value.byteLength;if(bytes>PREPARATION_BYTES)throw Error('provider_too_large');buffer+=decoder.decode(value,{stream:true});
   let i;while(lines<200&&(i=buffer.indexOf('\n'))>=0){line(buffer.slice(0,i));buffer=buffer.slice(i+1);}
   if(lines<200&&Buffer.byteLength(buffer)>131072)throw Error('provider_too_large');
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return {nickname,games:[...games.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,200),rejected};
}
async function readBounded(response){
 if(!response.ok)throw Error('provider_unavailable');
 if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('provider_too_large');
 const reader=response.body?.getReader();if(!reader)throw Error('provider_unavailable');
 let size=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw Error('provider_too_large');chunks.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
function splitPgn(text){return text.trim().split(/\n\s*\n(?=\[Event\s)/).filter(Boolean);}
function normalizeGame(pgn,source){
 if(typeof pgn!=='string'||Buffer.byteLength(pgn)>65536||!pgn.trim())throw Error('invalid_pgn');
 const game=new Chess();game.loadPgn(pgn);const h=game.getHeaders(),moves=game.history();
 if(h.Variant&&!['Standard','standard','Chess'].includes(h.Variant))throw Error('unsupported_variant');
 if(!moves.length||moves.length>2048)throw Error('invalid_pgn');
 const clean=game.pgn();return {id:createHash('sha256').update(source+'\n'+clean).digest('hex'),source,pgn:clean,
  white:(h.White||'—').slice(0,150),black:(h.Black||'—').slice(0,150),result:h.Result||'*',date:h.Date||'—',
  eco:/^[A-E]\d\d$/.test(h.ECO||'')?h.ECO:null,
  opening:h.Opening?String(h.Opening).slice(0,150):'Züge: '+moves.slice(0,8).join(' '),
  whiteFideId:/^[1-9]\d{0,9}$/.test(h.WhiteFideId||'')?h.WhiteFideId:null,
  blackFideId:/^[1-9]\d{0,9}$/.test(h.BlackFideId||'')?h.BlackFideId:null};
}
class GamesProvider{
 constructor({fetchImpl=fetch,twic=async()=>[],lichessAccess=sharedLichess}={}){this.fetch=fetchImpl;this.twic=twic;this.lichess=lichessAccess;}
 async get(url,accept){return readBounded(await this.fetch(url,{headers:{Accept:accept},redirect:'error',signal:AbortSignal.timeout(8000)}));}
 async games({source,nickname,fideId}){
  if(!['lichess','chesscom','twic'].includes(source))throw Error('invalid_provider');
  if(source!=='twic'&&(typeof nickname!=='string'||!/^[A-Za-z0-9_-]{2,30}$/.test(nickname)))throw Error('invalid_nickname');
  if(!/^[1-9]\d{0,9}$/.test(fideId))throw Error('invalid_fide_id');
  let raw=[];
  if(source==='lichess'){
   const url=new URL('https://lichess.org/api/games/user/'+encodeURIComponent(nickname));url.search=new URLSearchParams({max:'25',opening:'true',clocks:'false',evals:'false',literate:'false'}).toString();
   raw=splitPgn(await this.lichess.run(this.fetch,url.toString(),'application/x-chess-pgn',readBounded));
  }else if(source==='chesscom'){
   const base='https://api.chess.com/pub/player/'+encodeURIComponent(nickname.toLowerCase())+'/games/';
   const data=JSON.parse(await this.get(base+'archives','application/json'));
   const archives=Array.isArray(data.archives)?data.archives:[];
   const latest=archives.filter(u=>typeof u==='string'&&u.startsWith(base)&&/^\d{4}\/\d{2}$/.test(u.slice(base.length))).sort().at(-1);
   if(latest){const month=JSON.parse(await this.get(latest,'application/json'));raw=(Array.isArray(month.games)?month.games:[]).filter(g=>g.rules==='chess'&&typeof g.pgn==='string').slice(-25).reverse().map(g=>g.pgn);}
  }else{
   raw=(await this.twic(fideId)).slice(0,25).map(g=>g.pgn);
  }
  let rejected=0;const unique=new Map();
  for(const pgn of raw.slice(0,25)){try{const game=normalizeGame(pgn,source);
   // Public nickname exports are deliberately not claimed as verified real identity.
   if(source==='twic'&&game.whiteFideId!==fideId&&game.blackFideId!==fideId){rejected++;continue;}
   unique.set(game.id,game);
  }catch{rejected++;}}
  const games=[...unique.values()],counts=new Map();for(const g of games){const key=(g.eco?g.eco+' · ':'')+g.opening;counts.set(key,(counts.get(key)||0)+1);}
  return {source,nickname:source==='twic'?null:nickname,games,rejected,
   openings:[...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))};
 }
 async preparation(nickname){
  if(typeof nickname!=='string'||!/^[A-Za-z0-9_-]{2,30}$/.test(nickname))throw Object.assign(Error('invalid_nickname'),{code:'invalid_nickname'});
  nickname=nickname.toLowerCase();const access=this.lichess,now=access.now();
  for(const [k,v]of access.cache)if(now-v.at>=900000)access.cache.delete(k);
  const cached=access.cache.get(nickname);if(cached)return cached.data;
  if(access.pending.has(nickname))return access.pending.get(nickname);
  if(access.pending.size>=16)throw Object.assign(Error('provider_busy'),{code:'provider_busy'});
  const task=(async()=>{
   const url=new URL('https://lichess.org/api/games/user/'+encodeURIComponent(nickname));
   url.search=new URLSearchParams({max:'200',opening:'true',pgnInJson:'true',moves:'true',clocks:'false',evals:'false',ongoing:'false',finished:'true',sort:'dateDesc',perfType:'ultraBullet,bullet,blitz,rapid,classical,correspondence'}).toString();
   const data=await access.run(this.fetch,url.toString(),'application/x-ndjson',r=>readPreparation(r,nickname));
   const size=Buffer.byteLength(JSON.stringify(data));
   let total=[...access.cache.values()].reduce((n,v)=>n+v.size,0);
   while(access.cache.size&&(access.cache.size>=32||total+size>16*1024*1024)){const key=access.cache.keys().next().value;total-=access.cache.get(key).size;access.cache.delete(key);}
   if(size<=16*1024*1024)access.cache.set(nickname,{at:access.now(),data,size});
   return data;
  })();access.pending.set(nickname,task);
  try{return await task;}finally{access.pending.delete(nickname);}
 }
}
module.exports={GamesProvider,normalizeGame,splitPgn,readBounded,MAX_BYTES,createLichessAccess,readPreparation,PREPARATION_BYTES,LICHESS_AGENT};
