'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {Chess,DEFAULT_POSITION}=require('chess.js');
const {PositionIndex,MAX_INDEXED_PLIES,normalizedPositionKey,positionHash,supabasePositionSource}=require('./positionIndex');
const {installPositions,installPositionsFromEnv}=require('./positions');
const fen=moves=>{const game=new Chess();for(const move of moves.split(' ').filter(Boolean))game.move(move);return game.fen();};
const row=(id,pgn='e4 c5 Nf3 d6 1-0',date='2026-09-01',white='101',black='202')=>({id,pgn,game_date:date,white_name:'White '+id,black_name:'Black '+id,white_fide_id:white,black_fide_id:black,event:'Synthetic',source_url:'https://database.lichess.org/broadcast/lichess_db_broadcast_2026-09.pgn.zst',license_url:'https://creativecommons.org/licenses/by-sa/4.0/'});
function source(rows,hidden=new Set()) {return {page:async(cursor,limit)=>rows.filter(r=>!cursor||r.id>cursor).slice(0,limit),hidden:async()=>new Set(hidden)};}
async function indexed(rows,hidden=new Set(),options={}){const index=new PositionIndex(source(rows,hidden),{log(){},...options});await index.start();assert.equal(index.status,'ready');return index;}
async function http(options,run){const app=express();installPositions(app,options);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}}
test('position key/hash ignore counters, normalize en passant, preserve turn/castling and join transpositions',()=>{
 const a=fen('Nf3 d5 g3 Nf6'),b=fen('g3 d5 Nf3 Nf6');
 assert.equal(normalizedPositionKey(a),normalizedPositionKey(b));assert.equal(positionHash(normalizedPositionKey(a)),positionHash(normalizedPositionKey(b)));
 assert.equal(normalizedPositionKey(a.replace(/\d+ \d+$/,'78 105')),normalizedPositionKey(a));
 assert.notEqual(normalizedPositionKey(DEFAULT_POSITION),normalizedPositionKey(DEFAULT_POSITION.replace(' w ',' b ')));
 assert.notEqual(normalizedPositionKey(DEFAULT_POSITION),normalizedPositionKey(DEFAULT_POSITION.replace('KQkq','KQ')));
 assert.equal(normalizedPositionKey(fen('e4')),normalizedPositionKey(fen('e4').replace(' - ',' e3 ')));
 const ep=fen('e4 a6 e5 d5');assert.notEqual(normalizedPositionKey(ep),normalizedPositionKey(ep.replace(' d6 ',' - ')));
});
test('typed index build from pages, 60-ply cap, first occurrence and transpositions',async()=>{
 const repeat=Array(17).fill('Nf3 Nf6 Ng1 Ng8').join(' ');
 const index=await indexed([row('a','Nf3 d5 g3 Nf6 Bg2 1-0'),row('b','g3 d5 Nf3 Nf6 Bg2 0-1'),row('c',repeat+' 1/2-1/2')]);
 assert.ok(index.hashes instanceof BigUint64Array);assert.ok(index.gameIdx instanceof Uint32Array);assert.ok(index.ply instanceof Uint8Array);
 assert.equal(Math.max(...index.ply),MAX_INDEXED_PLIES);assert.equal(index.hashes.length,6+6+61);
 for(let i=1;i<index.hashes.length;i++)assert.ok(index.hashes[i-1]<=index.hashes[i]);
 const result=await index.search({fen:fen('Nf3 d5 g3 Nf6')});assert.deepEqual(result.games.map(g=>g.id),['a','b']);assert.ok(result.games.every(g=>g.ply===4));
 assert.equal((await index.search({fen:DEFAULT_POSITION})).games.find(g=>g.id==='c').ply,0);
 assert.equal(index.metrics.games,3);assert.ok(Number.isFinite(index.metrics.build_ms));
});
test('forced 64-bit collision is reverified against the full key; malformed game leaves no partial index',async()=>{
 const index=await indexed([row('a'),row('b','d4 d5 0-1'),row('c','e4 notSAN 1-0')],new Set(),{hash:()=>1n});
 const result=await index.search({fen:fen('e4 c5')});assert.deepEqual(result.games.map(g=>g.id),['a']);assert.equal(result.games[0].ply,2);assert.equal(index.metrics.rejected,1);
 assert.equal((await index.search({fen:fen('d4 d5')})).games[0].id,'b','cache must use full position key, not hash');
});
test('newest first with ascending id ties; side/FIDE filtering, chosen-side WDL, all candidates before limit',async()=>{
 const index=await indexed([row('a','e4 c5 Nf3 d6 1-0','2026-08-01'),row('b','e4 c5 Nc3 d6 0-1','2026-09-01'),row('c','e4 c5 Nf3 d6 1/2-1/2','2026-09-01','202','101')]);
 const black=await index.search({fen:fen('e4 c5'),side:'black',limit:1});assert.deepEqual(black.games.map(g=>g.id),['b']);assert.equal(black.total,3);
 assert.deepEqual(black.nextMoves.find(m=>m.move==='Nf3'),{move:'Nf3',count:2,winPct:0,drawPct:50,lossPct:50});
 const white=await index.search({fen:fen('e4 c5'),side:'white'});assert.equal(white.nextMoves.find(m=>m.move==='Nf3').winPct,50);
 assert.deepEqual((await index.search({fen:fen('e4 c5'),side:'black',fideId:'101'})).games.map(g=>g.id),['c']);
 assert.deepEqual((await index.search({fen:fen('e4 c5'),side:'white',fideId:'101'})).games.map(g=>g.id),['b','a']);
 const both=await index.search({fen:fen('e4 c5'),side:'any',fideId:'101'});assert.equal(both.total,3);assert.equal(both.perspective,'player');
 assert.equal((await index.search({fen:fen('e4 c5'),side:'any'})).perspective,'white');
});
test('opt-out excludes either player at build and rechecks after a cached search, failing closed on privacy read error',async()=>{
 const hidden=new Set(['303']),rows=[row('a'),row('b',undefined,undefined,'303','404')],index=await indexed(rows,hidden);
 assert.equal(index.metrics.excluded,1);assert.equal((await index.search({fen:DEFAULT_POSITION})).total,1);
 hidden.add('202');assert.equal((await index.search({fen:DEFAULT_POSITION})).total,0);
 index.source.hidden=async()=>{throw Error('unavailable');};await assert.rejects(index.search({fen:DEFAULT_POSITION}));
});
test('503 warming with Retry-After until background build completes; flag defaults off, invalid FEN 400, limit capped at 50',async()=>{
 let release;const index=new PositionIndex({hidden:async()=>new Set(),page:async()=>new Promise(resolve=>{release=()=>resolve([]);})},{log(){}});const building=index.start();
 await http({enabled:true,index,verifyToken:async()=>({id:'user'})},async base=>{
  const get=query=>fetch(base+'/api/positions/search?'+new URLSearchParams(query),{headers:{Authorization:'Bearer synthetic'}});
  const warming=await get({fen:DEFAULT_POSITION});assert.equal(warming.status,503);assert.equal(warming.headers.get('Retry-After'),'5');assert.equal((await warming.json()).code,'index_warming');
  const bad=await get({fen:'not fen'});assert.equal(bad.status,400);
  for(const query of [{fen:DEFAULT_POSITION,side:'blue'},{fen:DEFAULT_POSITION,fideId:'1 OR 1'},{fen:DEFAULT_POSITION,limit:'0'}])assert.equal((await get(query)).status,400);
  release();await building;assert.equal((await get({fen:DEFAULT_POSITION})).status,200);
 });
 await http({verifyToken:async()=>{throw Error('must not authenticate');}},async base=>assert.equal((await fetch(base+'/api/positions/search')).status,404));
 const many=await indexed(Array.from({length:55},(_,i)=>row(String(i).padStart(3,'0'))));
 await http({enabled:true,index:many,verifyToken:async()=>({id:'user'})},async base=>{const r=await fetch(base+'/api/positions/search?'+new URLSearchParams({fen:DEFAULT_POSITION,limit:'99'}),{headers:{Authorization:'Bearer synthetic'}});assert.equal(r.status,200);const body=await r.json();assert.equal(body.games.length,50);assert.equal(body.total,55);});
 const app=express();assert.equal(installPositionsFromEnv(app,async()=>null,{}),null);
});
test('coarse IP pre-limit bounds invalid-token verification and per-user limit follows authentication',async()=>{
 let verifies=0;
 await http({enabled:true,verifyToken:async()=>{verifies++;return null;}},async base=>{for(let i=0;i<121;i++){const r=await fetch(base+'/api/positions/search',{headers:{Authorization:'Bearer invalid'}});assert.equal(r.status,i<120?401:429);}assert.equal(verifies,120);});
 await http({enabled:true,index:await indexed([]),verifyToken:async()=>({id:'user'})},async base=>{for(let i=0;i<13;i++){const r=await fetch(base+'/api/positions/search?'+new URLSearchParams({fen:DEFAULT_POSITION}),{headers:{Authorization:'Bearer synthetic'}});assert.equal(r.status,i<12?200:429);}});
});
test('Supabase source uses bounded id pages and only active opt-out statuses, without writes',async()=>{
 const calls=[];const client={from(table){const q={};for(const method of ['select','order','limit','gt','in','range'])q[method]=(...args)=>{calls.push([table,method,...args]);return q;};q.abortSignal=async()=>({data:table==='spieler_opt_out'?[{fide_id:123}]:[],error:null});return q;}};
 const provider=supabasePositionSource(client);await provider.page('abc',250);assert.deepEqual(await provider.hidden(),new Set(['123']));
 assert.ok(calls.some(c=>c[1]==='gt'&&c[2]==='id'&&c[3]==='abc'));assert.ok(calls.some(c=>c[1]==='in'&&c[2]==='status'&&c[3].join(',')==='hidden_pending_review,approved'));
});
