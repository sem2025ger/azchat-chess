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
test('A1/A2/A3 return disjoint own/fallback lists in one HTTP request and top-three player opening statistics',async()=>{
 const rows=[row('a','e4 c5 1-0',undefined,'101','202'),row('b','d4 d5 0-1',undefined,'303','101'),row('c','e4 e5 0-1',undefined,'404','101'),row('d','d4 Nf6 1-0',undefined,'303','101')];
 const index=await indexed(rows);const search=id=>index.search({fen:fen('e4 c5'),fideId:id,side:'any'});
 const a1=await search('101');assert.equal(a1.fallback,false);assert.equal(a1.games.length,1);assert.deepEqual(a1.fallbackGames,[]);
 const a2=await search('303');assert.equal(a2.fallback,true);assert.deepEqual(a2.games,[]);assert.deepEqual(a2.fallbackGames.map(g=>g.id),['a']);assert.equal(a2.playerStats.total,2);assert.deepEqual(a2.playerStats.firstWhite,[{move:'d4',count:2}]);
 const a3=await search('999');assert.equal(a3.fallback,true);assert.equal(a3.playerStats.total,0);assert.equal(a3.fallbackScope,'all');assert.deepEqual(a3.games,[]);
 const stats=(await index.search({fen:fen('a3'),fideId:'101'})).playerStats;assert.equal(stats.total,4);assert.deepEqual(stats.firstWhite,[{move:'e4',count:1}]);assert.deepEqual(stats.replyE4,[{move:'e5',count:1}]);assert.deepEqual(stats.replyD4,[{move:'d5',count:1},{move:'Nf6',count:1}]);
 const many=await indexed(['e4','d4','c4','Nf3','g3'].map((m,i)=>row(String(i),m+' 1-0')));assert.equal((await many.search({fen:fen('a3'),fideId:'101'})).playerStats.firstWhite.length,3);
 await http({enabled:true,index,verifyToken:async()=>({id:'user'})},async base=>{const response=await fetch(base+'/api/positions/search?'+new URLSearchParams({fen:fen('e4 c5'),fideId:'999',scope:'nrw',sort:'strongest'}),{headers:{Authorization:'Bearer synthetic'}});assert.equal(response.status,200);const r=await response.json();assert.equal(r.fallback,true);assert.equal(r.playerStats.total,0);assert.equal(r.fallbackGames.length,1);assert.equal(r.games.length,0);});
});
test('strength uses both FIDE ratings once per build, unknown averages last; newest tie-break and fallback limit',async()=>{
 let reads=0;const provider=source([row('a',undefined,'2026-09-30','101','202'),row('b',undefined,'2026-01-01','303','404'),row('c',undefined,'2026-10-01','101','999')]);provider.ratings=async()=>{reads++;return new Map([['101',2000],['202',2200],['303',2400],['404',2600]]);};
 const index=new PositionIndex(provider,{log(){}});await index.start();const strongest=await index.search({fen:DEFAULT_POSITION,sort:'strongest'});assert.deepEqual(strongest.games.map(g=>g.id),['b','a','c']);assert.equal(strongest.games[0].whiteRating,2400);assert.equal(strongest.games[2].blackRating,null);
 assert.deepEqual((await index.search({fen:DEFAULT_POSITION})).games.map(g=>g.id),['c','a','b']);const fallback=await index.search({fen:DEFAULT_POSITION,sort:'strongest',fideId:'888',limit:1});assert.equal(fallback.fallbackGames[0].id,'b');assert.equal(fallback.fallbackGames.length,1);assert.equal(fallback.fallbackTotal,3);assert.equal(reads,1);
});
test('NRW rechecks verified membership on every cached search, side/any, empty set, privacy and whole-database fallback',async()=>{
 const hidden=new Set(),nrw=new Set(['101']);const provider=source([row('a'),row('b',undefined,undefined,'303','101'),row('c',undefined,undefined,'303','404')],hidden);provider.nrw=async()=>new Set(nrw);const index=new PositionIndex(provider,{log(){}});await index.start();
 const find=(side='any',fideId=null)=>index.search({fen:DEFAULT_POSITION,scope:'nrw',side,fideId});
 assert.deepEqual((await find('white')).games.map(g=>g.id),['a']);assert.deepEqual((await find('black')).games.map(g=>g.id),['b']);assert.equal((await find()).total,2);assert.equal((await find()).nrwCount,1);
 nrw.clear();const empty=await find();assert.equal(empty.total,0);assert.equal(empty.nrwCount,0);nrw.add('404');assert.deepEqual((await find()).games.map(g=>g.id),['c']);
 const fallback=await find('white','101');assert.equal(fallback.total,0);assert.equal(fallback.fallback,true);assert.equal(fallback.fallbackGames.length,3);assert.equal(fallback.fallbackScope,'all');
 hidden.add('404');assert.equal((await find()).total,0);assert.equal((await find('white','101')).fallbackGames.length,2);provider.nrw=async()=>{throw Error('unavailable');};await assert.rejects(find());
});
test('Supabase NRW lookup requires verified claim and inner published club; ratings and membership reads are bounded',async()=>{
 const calls=[];const client={from(table){const q={};for(const method of ['select','order','range','eq'])q[method]=(...args)=>{calls.push([table,method,...args]);return q;};q.abortSignal=async()=>({data:table==='spieler_claims'?[{fide_id:101}]:[{fide_id:101,fide_rating:2300},{fide_id:202,fide_rating:null}],error:null});return q;}};
 const provider=supabasePositionSource(client);assert.deepEqual(await provider.nrw(),new Set(['101']));assert.equal((await provider.ratings()).get('101'),2300);assert.equal((await provider.ratings()).has('202'),false);
 assert.ok(calls.some(c=>c[0]==='spieler_claims'&&c[1]==='select'&&c[2]==='fide_id,clubs_nrw!inner(published)'));assert.ok(calls.some(c=>c[1]==='eq'&&c[2]==='status'&&c[3]==='verified'));assert.ok(calls.some(c=>c[1]==='eq'&&c[2]==='clubs_nrw.published'&&c[3]===true));assert.ok(calls.some(c=>c[1]==='range'&&c[2]===0&&c[3]===499));
});
test('NRW source excludes pending/rejected claims and unpublished clubs from a synthetic joined set',async()=>{
 const records=[{fide_id:101,status:'verified',clubs_nrw:{published:true}},{fide_id:202,status:'pending',clubs_nrw:{published:true}},{fide_id:303,status:'rejected',clubs_nrw:{published:true}},{fide_id:404,status:'verified',clubs_nrw:{published:false}},{fide_id:505,status:'verified',clubs_nrw:null}];
 const provider=supabasePositionSource({from(table){assert.equal(table,'spieler_claims');const filters=[];let inner=false;const q={select(value){inner=value.includes('!inner');return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(){return q;},async abortSignal(){return {data:records.filter(row=>(!inner||row.clubs_nrw)&&filters.every(([k,v])=>k==='status'?row.status===v:row.clubs_nrw?.published===v)),error:null};}};return q;}});
 assert.deepEqual(await provider.nrw(),new Set(['101']));
});
