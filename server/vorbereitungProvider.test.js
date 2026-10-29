'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GamesProvider,createLichessAccess,PREPARATION_BYTES,LICHESS_AGENT}=require('./spielerGamesProvider');
const {analysePreparation}=require('../shared/vorbereitung.mjs');
const {game}=require('./test-support/vorbereitungFixture.cjs');
const ndjson=rows=>rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
test('Vorbereitung official NDJSON export, anonymous contact header, opening metadata, identity and latest order',async()=>{
 const calls=[],rows=[game({id:'abcdefgh',createdAt:2}),game({id:'abcd1234',color:'black',result:'0-1',createdAt:3}),game({id:'other111',username:'not-target'}),{...game(),variant:'chess960'},game({id:'abcdefgh'})];
 const p=new GamesProvider({lichessAccess:createLichessAccess(),fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(ndjson(rows));}});
 const data=await p.preparation('TARGET');assert.equal(data.games.length,2);assert.equal(data.rejected,2);assert.equal(data.games[0].color,'black');
 assert.equal(data.games[0].opening,'Sicilian Defense: Najdorf Variation');assert.equal(data.games[0].eco,'B90');
 const url=new URL(calls[0].url);assert.equal(url.origin,'https://lichess.org');assert.equal(url.pathname,'/api/games/user/target');
 for(const [key,value]of Object.entries({max:'200',opening:'true',pgnInJson:'true',ongoing:'false',finished:'true',sort:'dateDesc'}))assert.equal(url.searchParams.get(key),value);
 assert.equal(calls[0].options.headers.Accept,'application/x-ndjson');assert.equal(calls[0].options.headers['User-Agent'],LICHESS_AGENT);assert.ok(LICHESS_AGENT.includes('https://github.com/sem2025ger/azchat-chess/issues'));
 assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[0].options.redirect,'error');
 await assert.rejects(p.preparation('../evil'));assert.equal(calls.length,1);
});
test('Vorbereitung one shared request at a time includes streaming and existing Spieler Lichess access',async()=>{
 const access=createLichessAccess();let active=0,maximum=0,release;let opened;
 const started=new Promise(r=>opened=r);
 const p=new GamesProvider({lichessAccess:access,fetchImpl:async(url,options)=>{active++;maximum=Math.max(maximum,active);
  return new Response(new ReadableStream({async start(controller){if(options.headers.Accept==='application/x-ndjson'){opened();await new Promise(r=>release=r);controller.enqueue(new TextEncoder().encode(ndjson([game()])));}else controller.enqueue(new TextEncoder().encode(game().pgn));active--;controller.close();}}));}});
 const a=p.preparation('target');await started;const b=p.games({source:'lichess',nickname:'second',fideId:'13404431'});
 await Promise.resolve();assert.equal(active,1);release();await Promise.all([a,b]);assert.equal(maximum,1);assert.equal(active,0);
});
test('Vorbereitung global 429 cooldown forbids all Lichess requests for full 60 seconds, then recovers',async()=>{
 let time=0,calls=0;const access=createLichessAccess({now:()=>time});
 const p=new GamesProvider({lichessAccess:access,fetchImpl:async()=>{calls++;return calls===1?new Response('',{status:429}):new Response(ndjson([game()]));}});
 await assert.rejects(p.preparation('target'),e=>e.code==='lichess_rate_limit'&&e.retryAfter===60);
 time=59999;await assert.rejects(p.preparation('target'),e=>e.code==='lichess_rate_limit');
 await assert.rejects(p.games({source:'lichess',nickname:'another',fideId:'1'}),e=>e.code==='lichess_rate_limit');assert.equal(calls,1);
 time=60000;assert.equal((await p.preparation('target')).games.length,1);assert.equal(calls,2);
});
test('Vorbereitung coalesces case-insensitive username requests; 15-minute bounded cache and no cached failures',async()=>{
 let time=0,calls=0;const p=new GamesProvider({lichessAccess:createLichessAccess({now:()=>time}),fetchImpl:async()=>{calls++;return new Response(ndjson([game()]));}});
 const data=await Promise.all([p.preparation('target'),p.preparation('TARGET')]);assert.equal(calls,1);assert.deepEqual(data[0],data[1]);
 time=899999;await p.preparation('target');assert.equal(calls,1);time=900000;await p.preparation('target');assert.equal(calls,2);
 const fail=new GamesProvider({lichessAccess:createLichessAccess(),fetchImpl:async()=>{calls++;return new Response('unavailable',{status:503});}});
 await assert.rejects(fail.preparation('target'));await assert.rejects(fail.preparation('target'));assert.equal(calls,4);
 const bounded=createLichessAccess(),many=new GamesProvider({lichessAccess:bounded,fetchImpl:async()=>new Response('')});
 for(let i=0;i<35;i++)await many.preparation('name'+i);assert.equal(bounded.cache.size,32);
});
test('Vorbereitung streaming game/byte/line caps cancel upstream and malformed streams are not accepted',async()=>{
 let cancelled=false;const rows=Array.from({length:201},(_,i)=>game({id:i.toString(36).padStart(8,'0'),createdAt:i}));
 const p=new GamesProvider({lichessAccess:createLichessAccess(),fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(ndjson(rows)));},cancel(){cancelled=true;}}))});
 assert.equal((await p.preparation('target')).games.length,200);assert.equal(cancelled,true);
 for(const response of [()=>new Response('x',{headers:{'content-length':String(PREPARATION_BYTES+1)}}),()=>new Response(' '.repeat(PREPARATION_BYTES+1)),()=>new Response('x'.repeat(131073)),()=>new Response('invalid-json\n')]){
  const bad=new GamesProvider({lichessAccess:createLichessAccess(),fetchImpl:async()=>response()});await assert.rejects(bad.preparation('target'));assert.equal(bad.lichess.cache.size,0);
 }
});
test('Vorbereitung variation name/ECO and colour/time controls use only target games, correct W/D/L denominators and empty result',async()=>{
 const rows=[game({id:'whitewin',result:'1-0'}),game({id:'whitedrw',result:'1/2-1/2'}),game({id:'whitelos',result:'0-1'}),
  game({id:'blackwin',color:'black',result:'0-1'}),game({id:'blackdrw',color:'black',result:'1/2-1/2'}),game({id:'blacklos',color:'black',result:'1-0'}),
  game({id:'ruylopez',opening:'Ruy Lopez',eco:'C60',speed:'rapid'}),game({id:'notmine1',username:'someoneelse'})];
 const p=new GamesProvider({lichessAccess:createLichessAccess(),fetchImpl:async()=>new Response(ndjson(rows))});const {games}=await p.preparation('target');
 const name=analysePreparation(games,{variation:' nAjDoRf '}),eco=analysePreparation(games,{variation:'b90'});assert.equal(name.games.length,6);assert.deepEqual(name,eco);
 for(const color of ['white','black'])assert.deepEqual(name.byColor[color],{games:3,wins:1,draws:1,losses:1,winPct:33.3,drawPct:33.3,lossPct:33.3});
 const filtered=analysePreparation(games,{variation:'B90',color:'black',speed:'blitz',timeControl:'300+0'});assert.equal(filtered.games.length,3);assert.equal(filtered.byColor.white.games,0);
 assert.equal(analysePreparation(games,{variation:'Najdorf',speed:'rapid'}).games.length,0);
 const empty=analysePreparation(games,{variation:'B99'});assert.equal(empty.games.length,0);assert.equal(empty.openings.length,0);assert.equal(empty.byColor.black.winPct,0);
});
