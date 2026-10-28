'use strict';
const {Chess}=require('chess.js');
const {createHash}=require('node:crypto');
const {setImmediate:yieldTurn}=require('node:timers/promises');
const {rebuildBroadcastPgn}=require('./spielerGamesProvider');

const MAX_INDEXED_PLIES=60;
const MAX_RSS_BYTES=350000000;
const PAGE_SIZE=250;
const keyOf=game=>game.fen().split(' ').slice(0,4).join(' ');
function normalizedPositionKey(fen){return keyOf(new Chess(fen));}
function positionHash(key){return createHash('sha256').update(key,'utf8').digest().readBigUInt64BE(0);}
function sanTokens(pgn){
 if(typeof pgn!=='string'||pgn.length>65536||/[\[\]{}()]/.test(pgn))throw Error('invalid_archive_game');
 return pgn.replace(/\d+\.(?:\.\.)?/g,' ').trim().split(/\s+/)
  .filter(t=>t&&!['1-0','0-1','1/2-1/2','*','...','e.p.'].includes(t)&&!/^\$\d+$/.test(t)).map(t=>t.replace(/[!?]+$/,''));
}
function resultOf(pgn){return pgn.trim().match(/(?:^|\s)(1-0|0-1|1\/2-1\/2)\s*$/)?.[1]||'*';}
function hiddenGame(game,hidden){return [game.white_fide_id,game.black_fide_id].some(id=>id!=null&&hidden.has(String(id)));}
function hashRange(hashes,hash){
 let lo=0,hi=hashes.length;
 while(lo<hi){const m=(lo+hi)>>>1;if(hashes[m]<hash)lo=m+1;else hi=m;}
 const start=lo;hi=hashes.length;
 while(lo<hi){const m=(lo+hi)>>>1;if(hashes[m]<=hash)lo=m+1;else hi=m;}
 return [start,lo];
}
function verifyPosition(prefix,ply,key){
 const game=new Chess(),moves=prefix?prefix.split(' '):[];
 try{
  if(ply>MAX_INDEXED_PLIES||ply>moves.length)return null;
  for(let i=0;i<ply;i++)game.move(moves[i],{strict:true});
  if(keyOf(game)!==key)return null;
  return {nextMove:moves[ply]?game.move(moves[ply],{strict:true}).san:null};
 }catch{return null;}
}
function outcome(result,side){return result==='1/2-1/2'?'draw':result==='1-0'?(side==='white'?'win':'loss'):result==='0-1'?(side==='black'?'win':'loss'):'unknown';}

class PositionIndex {
 constructor(source,{hash=positionHash,clock=()=>performance.now(),rss=()=>process.memoryUsage().rss,log=console.log}={}){
  this.source=source;this.hash=hash;this.clock=clock;this.rss=rss;this.log=log;
  this.status='warming';this.games=[];this.gameIds=[];this.hashes=new BigUint64Array();this.gameIdx=new Uint32Array();this.ply=new Uint8Array();
  this.verifiedCache=new Map();this.buildPromise=null;this.metrics=null;
 }
 start(){
  if(!this.buildPromise)this.buildPromise=this.build().catch(()=>{this.status='unavailable';this.log(JSON.stringify({event:'position_index_failed',code:'index_unavailable'}));});
  return this.buildPromise;
 }
 async build(){
  const started=this.clock(),rssBefore=this.rss(),hidden=await this.source.hidden();
  this.log(JSON.stringify({event:'position_index_building',rss_before:rssBefore,max_indexed_plies:MAX_INDEXED_PLIES}));
  let capacity=65536,count=0,rejected=0,excluded=0,cursor=null;
  let hashes=new BigUint64Array(capacity),gameIdx=new Uint32Array(capacity),ply=new Uint8Array(capacity);
  const append=(hash,index,p)=>{
   if(count===capacity){capacity*=2;const h=new BigUint64Array(capacity),g=new Uint32Array(capacity),v=new Uint8Array(capacity);h.set(hashes);g.set(gameIdx);v.set(ply);hashes=h;gameIdx=g;ply=v;}
   hashes[count]=hash;gameIdx[count]=index;ply[count++]=p;
  };
  for(;;){
   const rows=await this.source.page(cursor,PAGE_SIZE);
   if(!Array.isArray(rows)||rows.length>PAGE_SIZE)throw Error('invalid_archive_page');
   if(!rows.length)break;
   for(const row of rows){
    if(typeof row.id!=='string'||row.id<=String(cursor||''))throw Error('invalid_archive_order');
    cursor=row.id;
    if(hiddenGame(row,hidden)){excluded++;continue;}
    const start=count;
    try{
     const tokens=sanTokens(row.pgn),game=new Chess(),canonical=[];
     if(!tokens.length)throw Error('empty_archive_game');
     const index=this.games.length;append(this.hash(keyOf(game)),index,0);
     for(let i=0;i<Math.min(tokens.length,MAX_INDEXED_PLIES+1);i++){
      canonical.push(game.move(tokens[i]).san);
      if(i<MAX_INDEXED_PLIES)append(this.hash(keyOf(game)),index,i+1);
     }
     this.gameIds.push(row.id);this.games.push({...row,prefix:canonical.join(' '),result:resultOf(row.pgn)});
    }catch{count=start;rejected++;}
    if((this.games.length+rejected+excluded)%8===0)await yieldTurn();
    if(this.rss()>MAX_RSS_BYTES){this.log(JSON.stringify({event:'position_index_memory_limit',rss_before:rssBefore,rss_after:this.rss(),entries:count}));throw Error('index_memory_limit');}
   }
   if(rows.length<PAGE_SIZE)break;
  }
  // Only typed arrays per position. The temporary permutation is released after sorting.
  const order=Uint32Array.from({length:count},(_,i)=>i);
  order.sort((a,b)=>hashes[a]<hashes[b]?-1:hashes[a]>hashes[b]?1:gameIdx[a]-gameIdx[b]||ply[a]-ply[b]);
  const sortedHashes=new BigUint64Array(count),sortedGames=new Uint32Array(count),sortedPly=new Uint8Array(count);
  for(let i=0;i<count;i++){const at=order[i];sortedHashes[i]=hashes[at];sortedGames[i]=gameIdx[at];sortedPly[i]=ply[at];}
  this.hashes=sortedHashes;this.gameIdx=sortedGames;this.ply=sortedPly;
  const rssAfter=this.rss();
  this.metrics={event:'position_index_ready',build_ms:Math.round(this.clock()-started),games:this.games.length,entries:count,rejected,excluded,rss_before:rssBefore,rss_after:rssAfter,max_indexed_plies:MAX_INDEXED_PLIES};
  if(rssAfter>MAX_RSS_BYTES){this.log(JSON.stringify({...this.metrics,event:'position_index_memory_limit'}));throw Error('index_memory_limit');}
  this.status='ready';this.log(JSON.stringify(this.metrics));
 }
 async verified(key){
  // Cache by the FULL key, never by hash. Snapshot data is immutable until restart;
  // privacy is deliberately re-read after this cache on EVERY search.
  if(this.verifiedCache.has(key))return this.verifiedCache.get(key);
  const [start,end]=hashRange(this.hashes,this.hash(key)),seen=new Set(),moveNames=[null],moveIds=new Map();
  const games=new Uint32Array(end-start),plies=new Uint8Array(end-start),moves=new Uint16Array(end-start);let count=0;
  for(let i=start;i<end;i++){
   const gameIdx=this.gameIdx[i];if(seen.has(gameIdx))continue;
   const found=verifyPosition(this.games[gameIdx].prefix,this.ply[i],key);
   if(found){
    seen.add(gameIdx);let moveId=0;
    if(found.nextMove){if(!moveIds.has(found.nextMove)){moveIds.set(found.nextMove,moveNames.length);moveNames.push(found.nextMove);}moveId=moveIds.get(found.nextMove);}
    games[count]=gameIdx;plies[count]=this.ply[i];moves[count++]=moveId;
   }
   if((i-start)%32===31)await yieldTurn();
  }
  const matches={gameIdx:games.slice(0,count),ply:plies.slice(0,count),moves:moves.slice(0,count),moveNames};
  if(count<=20000){if(this.verifiedCache.size>=4)this.verifiedCache.delete(this.verifiedCache.keys().next().value);this.verifiedCache.set(key,matches);}
  return matches;
 }
 async search({fen,side='any',fideId=null,limit=10}){
  if(this.status!=='ready')throw Object.assign(Error(),{code:this.status==='warming'?'index_warming':'index_unavailable'});
  const started=this.clock(),key=normalizedPositionKey(fen),turn=key.split(' ')[1]==='w'?'white':'black';
  const matches=await this.verified(key),hidden=await this.source.hidden(),rows=[],next=new Map();
  for(let i=0;i<matches.gameIdx.length;i++){
   const game=this.games[matches.gameIdx[i]];if(hiddenGame(game,hidden))continue;
   if(fideId&&!(side==='any'?[game.white_fide_id,game.black_fide_id]:[game[side+'_fide_id']]).some(id=>String(id)===fideId))continue;
   const perspective=side!=='any'?side:fideId?(String(game.white_fide_id)===fideId?'white':'black'):turn;
   const result=outcome(game.result,perspective);
   rows.push({game,ply:matches.ply[i],perspective,outcome:result});
   const nextMove=matches.moveNames[matches.moves[i]];
   if(nextMove){const value=next.get(nextMove)||{move:nextMove,count:0,win:0,draw:0,loss:0};value.count++;if(result!=='unknown')value[result]++;next.set(nextMove,value);}
  }
  rows.sort((a,b)=>(b.game.game_date||'').localeCompare(a.game.game_date||'')||a.game.id.localeCompare(b.game.id));
  const nextMoves=[...next.values()].map(m=>{const known=m.win+m.draw+m.loss;return {move:m.move,count:m.count,winPct:known?Math.round(m.win*1000/known)/10:0,drawPct:known?Math.round(m.draw*1000/known)/10:0,lossPct:known?Math.round(m.loss*1000/known)/10:0};}).sort((a,b)=>b.count-a.count||a.move.localeCompare(b.move));
  const games=rows.slice(0,Math.min(50,limit)).map(({game:g,ply,perspective,outcome})=>({id:g.id,pgn:rebuildBroadcastPgn({...g,source:'lichess-broadcast'}),white:g.white_name,black:g.black_name,whiteFideId:g.white_fide_id,blackFideId:g.black_fide_id,whiteRating:g.white_rating??null,blackRating:g.black_rating??null,event:g.event,date:g.game_date,result:g.result,ply,perspective,outcome,source:'lichess-broadcast',sourceUrl:g.source_url,licenseUrl:g.license_url}));
  return {games,total:rows.length,nextMoves,side,perspective:side==='any'?(fideId?'player':turn):side,maxIndexedPlies:MAX_INDEXED_PLIES,searchMs:Math.round((this.clock()-started)*10)/10};
 }
}

function supabasePositionSource(client){
 const checked=async query=>{const {data,error}=await query.abortSignal(AbortSignal.timeout(15000));if(error)throw Error('storage_unavailable');return data||[];};
 return {
  async page(cursor,limit){let q=client.from('spieler_broadcast_games').select('id,pgn,game_date,white_name,black_name,white_fide_id,black_fide_id,event,source_url,license_url').order('id').limit(limit);if(cursor)q=q.gt('id',cursor);return checked(q);},
  async hidden(){const hidden=new Set();for(let offset=0;;offset+=500){const rows=await checked(client.from('spieler_opt_out').select('fide_id').in('status',['hidden_pending_review','approved']).order('fide_id').range(offset,offset+499));for(const row of rows)hidden.add(String(row.fide_id));if(rows.length<500)return hidden;}}
 };
}
module.exports={MAX_INDEXED_PLIES,MAX_RSS_BYTES,PositionIndex,normalizedPositionKey,positionHash,verifyPosition,hashRange,supabasePositionSource,sanTokens};
