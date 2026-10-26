'use strict';
const { Chess }=require('chess.js');
const { createHash }=require('node:crypto');
const MAX_BYTES=2*1024*1024;
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
 constructor({fetchImpl=fetch,twic=async()=>[]}={}){this.fetch=fetchImpl;this.twic=twic;}
 async get(url,accept){return readBounded(await this.fetch(url,{headers:{Accept:accept},redirect:'error',signal:AbortSignal.timeout(8000)}));}
 async games({source,nickname,fideId}){
  if(!['lichess','chesscom','twic'].includes(source))throw Error('invalid_provider');
  if(source!=='twic'&&(typeof nickname!=='string'||!/^[A-Za-z0-9_-]{2,30}$/.test(nickname)))throw Error('invalid_nickname');
  if(!/^[1-9]\d{0,9}$/.test(fideId))throw Error('invalid_fide_id');
  let raw=[];
  if(source==='lichess'){
   const url=new URL('https://lichess.org/api/games/user/'+encodeURIComponent(nickname));url.search=new URLSearchParams({max:'25',opening:'true',clocks:'false',evals:'false',literate:'false'}).toString();
   raw=splitPgn(await this.get(url.toString(),'application/x-chess-pgn'));
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
}
module.exports={GamesProvider,normalizeGame,splitPgn,readBounded,MAX_BYTES};
