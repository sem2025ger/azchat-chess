'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {Chess}=require('chess.js');
const {createCoachEngine,parseInfo,sanLine}=require('./coachEngine');

const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SICILIAN_BLACK='rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const WHITE_MATES='6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
const BLACK_MATES='r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1';

// Fake UCI child: `script(command, emit)` decides what the "engine" prints.
function fakeSpawn(script,{onSpawn}={}){
 return ()=>{
  const child=new EventEmitter(),stdout=new PassThrough(),stdin=new PassThrough();
  child.stdout=stdout;child.stdin=stdin;child.pid=4242;child.killed=false;
  child.kill=()=>{child.killed=true;setImmediate(()=>child.emit('exit',null,'SIGKILL'));};
  let rest='';
  stdin.on('data',(chunk)=>{rest+=chunk;let i;while((i=rest.indexOf('\n'))>=0){const cmd=rest.slice(0,i);rest=rest.slice(i+1);script(cmd,(line)=>stdout.write(line+'\n'),child);}});
  onSpawn?.(child);
  return child;
 };
}
function standardScript(lines){
 return (cmd,emit)=>{
  if(cmd==='uci'){emit('option name EvalFile type string default nn-test.nnue');emit('uciok');}
  if(cmd==='isready')emit('readyok');
  if(cmd.startsWith('go'))setImmediate(()=>{for(const line of lines)emit(line);});
 };
}
const noVerify=async()=>{};

test('parseInfo normalizes cp, mate, bound and WDL to White perspective',()=>{
 const white=parseInfo('info depth 12 seldepth 18 multipv 2 score cp 35 wdl 80 900 20 nodes 1000 nps 1 time 50 pv e2e4 e7e5','w');
 assert.deepEqual([white.multipv,white.depth,white.scoreKind,white.scoreWhite,white.bound,white.wdlWhite],[2,12,'cp',35,null,[80,900,20]]);
 const black=parseInfo('info depth 12 multipv 1 score cp 35 wdl 80 900 20 nodes 1 time 5 pv e7e5','b');
 assert.equal(black.scoreWhite,-35);assert.deepEqual(black.wdlWhite,[20,900,80]);
 const mate=parseInfo('info depth 9 multipv 1 score mate 2 lowerbound nodes 1 time 5 pv a1a8','b');
 assert.deepEqual([mate.scoreKind,mate.scoreWhite,mate.bound],['mate',-2,'lowerbound']);
 assert.equal(parseInfo('info depth 3 currmove e2e4 currmovenumber 1','w'),null);
});

test('sanLine replays every ply and rejects an illegal line',()=>{
 assert.deepEqual(sanLine(START,['e2e4','e7e5','g1f3']),['e4','e5','Nf3']);
 assert.equal(sanLine(START,['e2e4','e2e4']),null);
 assert.equal(sanLine(START,['zz99']),null);
 assert.deepEqual(sanLine('8/P6k/8/8/8/8/8/K7 w - - 0 1',['a7a8q']),['a8=Q']);
 // The whole PV is validated, not only the displayed first ten plies.
 const knights=['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8','g1f3','g8f6'];
 assert.equal(sanLine(START,knights).length,10);
 assert.equal(sanLine(START,[...knights,'e1e3']),null,'illegal 11th ply rejects the line');
 assert.equal(sanLine(START,[...knights,'f3e5']).length,10,'legal 11th ply is validated, SAN capped at 10');
});

test('only a complete exact MultiPV set from one depth is used',async()=>{
 const engine=createCoachEngine({verify:noVerify,spawnImpl:fakeSpawn(standardScript([
  'info depth 10 multipv 1 score cp 30 wdl 50 920 30 nodes 10 time 10 pv e2e4 e7e5',
  'info depth 10 multipv 2 score cp 20 wdl 40 930 30 nodes 10 time 10 pv d2d4 d7d5',
  'info depth 10 multipv 3 score cp 10 wdl 30 940 30 nodes 10 time 10 pv c2c4',
  'info depth 11 multipv 1 score cp 33 upperbound nodes 11 time 11 pv e2e4',
  'info depth 11 multipv 2 score cp 25 nodes 11 time 11 pv d2d4',
  'bestmove e2e4'
 ])),movetimeMs:50});
 const result=await engine.analyze(START);
 engine.close();
 assert.deepEqual(result.lines.map(l=>[l.depth,l.scoreWhite,l.sanPv.join(' ')]),[[10,30,'e4 e5'],[10,20,'d4 d5'],[10,10,'c4']]);
 assert.equal(result.nnue,'nn-test.nnue');assert.equal(result.engine,'stockfish-19-lite');
});

test('one illegal PV rejects the whole set instead of returning a partial verified set',async()=>{
 const engine=createCoachEngine({verify:noVerify,spawnImpl:fakeSpawn(standardScript([
  'info depth 10 multipv 1 score cp 30 nodes 10 time 10 pv e2e4 e7e5',
  'info depth 10 multipv 2 score cp 20 nodes 10 time 10 pv d2d4 d7d5',
  'info depth 10 multipv 3 score cp 10 nodes 10 time 10 pv e2e5',
  'bestmove e2e4'
 ])),movetimeMs:50});
 await assert.rejects(engine.analyze(START),{code:'engine_unavailable'});
 engine.close();
});

// Controllable async checksum step for start-up race tests.
function gate(){let open;const promise=new Promise(r=>{open=r;});return {verify:()=>promise,open};}
const goodScript=(onGo)=>(cmd,emit)=>{
 if(cmd==='uci')emit('uciok');if(cmd==='isready')emit('readyok');
 if(cmd.startsWith('go')){onGo?.();emit('info depth 5 multipv 1 score cp 1 nodes 1 time 1 pv e2e4');emit('info depth 5 multipv 2 score cp 0 nodes 1 time 1 pv d2d4');emit('info depth 5 multipv 3 score cp 0 nodes 1 time 1 pv c2c4');emit('bestmove e2e4');}
};

test('abort during engine start-up never runs an orphaned search',async()=>{
 const g=gate();let searches=0;
 const engine=createCoachEngine({verify:g.verify,movetimeMs:20,spawnImpl:fakeSpawn(goodScript(()=>searches++))});
 const abort=new AbortController();
 const pendingResult=engine.analyze(START,{signal:abort.signal});
 abort.abort();
 await assert.rejects(pendingResult,{code:'engine_cancelled'});
 g.open();
 await new Promise(r=>setTimeout(r,50));
 assert.equal(searches,0);assert.equal(engine.status().searching,false);
 const result=await engine.analyze(START);
 assert.equal(result.lines.length,3);assert.equal(searches,1);
 engine.close();
});

test('abandoned queued jobs are removed at once and never cause engine_busy',async()=>{
 const g=gate();
 const engine=createCoachEngine({verify:g.verify,maxQueue:2,movetimeMs:20,spawnImpl:fakeSpawn(goodScript())});
 const first=engine.analyze(START);
 for(let n=2;n<12;n++){
  const abort=new AbortController(),p=engine.analyze(START.replace(/ 1$/,' '+n),{signal:abort.signal});
  abort.abort();await assert.rejects(p,{code:'engine_cancelled'});
 }
 assert.equal(engine.status().queued,0,'cancelled jobs do not occupy queue slots');
 const second=engine.analyze(START.replace(/ 1$/,' 99'));
 g.open();
 assert.equal((await first).lines.length,3);assert.equal((await second).lines.length,3);
 engine.close();
});

test('a new request right after the last caller aborts a running search gets its own result',async()=>{
 let searches=0;
 const engine=createCoachEngine({verify:noVerify,movetimeMs:20,spawnImpl:fakeSpawn((cmd,emit)=>{
  if(cmd==='uci')emit('uciok');if(cmd==='isready')emit('readyok');
  if(cmd.startsWith('go')&&++searches>1){emit('info depth 5 multipv 1 score cp 1 nodes 1 time 1 pv e2e4');emit('info depth 5 multipv 2 score cp 0 nodes 1 time 1 pv d2d4');emit('info depth 5 multipv 3 score cp 0 nodes 1 time 1 pv c2c4');emit('bestmove e2e4');}
 })});
 const abort=new AbortController();
 const first=engine.analyze(START,{signal:abort.signal});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(engine.status().searching,true,'first search is running and never answers');
 abort.abort();
 const second=engine.analyze(START); // same FEN, synchronously after the abort
 await assert.rejects(first,{code:'engine_cancelled'});
 const result=await second;
 assert.equal(result.lines.length,3);assert.equal(searches,2);
 engine.close();
});

test('close during checksum verification spawns no process and rejects callers',async()=>{
 const g=gate();let spawned=0;
 const engine=createCoachEngine({verify:g.verify,spawnImpl:fakeSpawn(goodScript(),{onSpawn:()=>spawned++})});
 const pendingResult=engine.analyze(START);
 engine.close();
 g.open();
 await assert.rejects(pendingResult,{code:'engine_unavailable'});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(spawned,0);assert.equal(engine.status().pid,null);
 await assert.rejects(engine.analyze(SICILIAN_BLACK),{code:'engine_unavailable'});
});

test('close while the engine starts kills the child and runs no search',async()=>{
 let searches=0,child=null,ready=null;
 const engine=createCoachEngine({verify:noVerify,spawnImpl:fakeSpawn((cmd,emit)=>{
  if(cmd==='uci')emit('uciok');
  if(cmd==='isready')ready=()=>emit('readyok');
  if(cmd.startsWith('go'))searches++;
 },{onSpawn:(c)=>{child=c;}})});
 const pendingResult=engine.analyze(START);
 await new Promise(r=>setTimeout(r,20));
 assert.ok(child&&ready,'engine was spawned and is waiting for readyok');
 engine.close();
 await assert.rejects(pendingResult,{code:'engine_unavailable'});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(child.killed,true);assert.equal(searches,0);assert.equal(engine.status().pid,null);
});

test('wrong checksum makes the engine unavailable without spawning',async()=>{
 let spawned=0;
 const engine=createCoachEngine({pinned:{'stockfish-19-lite-single.wasm':'0'.repeat(64)},spawnImpl:()=>{spawned++;throw Error('must not spawn');}});
 await assert.rejects(engine.analyze(START),{code:'engine_unavailable'});
 await assert.rejects(engine.analyze(START),{code:'engine_unavailable'});
 assert.equal(spawned,0);assert.equal(engine.status().disabled,true);
 engine.close();
});

test('bounded queue rejects with engine_busy; identical FENs are coalesced',async()=>{
 let searches=0;
 const engine=createCoachEngine({verify:noVerify,maxQueue:2,movetimeMs:20,spawnImpl:fakeSpawn((cmd,emit)=>{
  if(cmd==='uci')emit('uciok');if(cmd==='isready')emit('readyok');
  if(cmd.startsWith('go')){searches++;setTimeout(()=>{emit('info depth 5 multipv 1 score cp 1 nodes 1 time 1 pv e2e4');emit('info depth 5 multipv 2 score cp 0 nodes 1 time 1 pv d2d4');emit('info depth 5 multipv 3 score cp 0 nodes 1 time 1 pv c2c4');emit('bestmove e2e4');},30);}
 })});
 const fens=[1,2,3,4].map(n=>START.replace(/ 1$/,' '+n));
 const a=engine.analyze(fens[0]),a2=engine.analyze(fens[0]);
 const b=engine.analyze(fens[1]),c=engine.analyze(fens[2]);
 await assert.rejects(engine.analyze(fens[3]),{code:'engine_busy'});
 const [ra,ra2]=await Promise.all([a,a2]);assert.equal(ra,ra2);
 await Promise.all([b,c]);
 assert.equal(searches,3);
 const cached=await engine.analyze(fens[0]);assert.equal(cached.cached,true);assert.equal(searches,3);
 engine.close();
});

test('a hung search times out and the engine is restarted for the next request',async()=>{
 let spawns=0,hang=true;
 const engine=createCoachEngine({verify:noVerify,movetimeMs:20,deadlineMs:5000,spawnImpl:fakeSpawn((cmd,emit)=>{
  if(cmd==='uci')emit('uciok');if(cmd==='isready')emit('readyok');
  if(cmd.startsWith('go')&&!hang){emit('info depth 5 multipv 1 score cp 1 nodes 1 time 1 pv e2e4');emit('info depth 5 multipv 2 score cp 0 nodes 1 time 1 pv d2d4');emit('info depth 5 multipv 3 score cp 0 nodes 1 time 1 pv c2c4');emit('bestmove e2e4');}
 },{onSpawn:()=>spawns++})});
 await assert.rejects(engine.analyze(START),{code:'engine_timeout'});
 hang=false;
 const result=await engine.analyze(START);
 assert.equal(result.lines.length,3);assert.equal(spawns,2);
 engine.close();
});

test('abort cancels the caller and stops an orphaned search; deadline rejects queued waiters',async()=>{
 let killed=0;
 const engine=createCoachEngine({verify:noVerify,movetimeMs:5000,deadlineMs:60,spawnImpl:fakeSpawn((cmd,emit)=>{
  if(cmd==='uci')emit('uciok');if(cmd==='isready')emit('readyok');
 },{onSpawn:(child)=>{const k=child.kill;child.kill=()=>{killed++;k();};}})});
 const abort=new AbortController();
 const running=engine.analyze(START,{signal:abort.signal});
 await new Promise(r=>setTimeout(r,20));
 abort.abort();
 await assert.rejects(running,{code:'engine_cancelled'});
 assert.equal(killed,1);
 await assert.rejects(engine.analyze(SICILIAN_BLACK),{code:'engine_timeout'});
 engine.close();
});

test('terminal and invalid positions never reach the engine',async()=>{
 const engine=createCoachEngine({verify:noVerify,spawnImpl:()=>{throw Error('must not spawn');}});
 await assert.rejects(engine.analyze('7k/5QQ1/8/8/8/8/8/K7 b - - 0 1'),{code:'terminal_position'});
 await assert.rejects(engine.analyze('not a fen'),{code:'invalid_position'});
 engine.close();
});

test('each search logs depth and timing as numbers only, never the position or moves',async()=>{
 const logs=[];
 const engine=createCoachEngine({verify:noVerify,movetimeMs:50,log:(e)=>logs.push(e),spawnImpl:fakeSpawn(standardScript([
  'info depth 12 seldepth 19 multipv 1 score cp 30 nodes 4321 time 48 pv e2e4 e7e5',
  'info depth 12 seldepth 21 multipv 2 score cp 20 nodes 4321 time 48 pv d2d4 d7d5',
  'info depth 12 seldepth 17 multipv 3 score cp 10 nodes 4321 time 48 pv c2c4',
  'bestmove e2e4'
 ]))});
 await engine.analyze(START);
 await engine.analyze(START); // cache hit: no second log line
 engine.close();
 assert.equal(logs.length,1);
 const [entry]=logs;
 assert.deepEqual(Object.keys(entry).sort(),['coldStart','depth','engine','engineTimeMs','event','lines','movetimeMs','multiPv','nodes','searchMs','seldepth','totalMs']);
 assert.deepEqual([entry.event,entry.engine,entry.movetimeMs,entry.multiPv,entry.lines,entry.depth,entry.seldepth,entry.nodes,entry.engineTimeMs,entry.coldStart],
  ['coach_engine_analysis','stockfish-19-lite',50,3,3,12,21,4321,48,true]);
 for(const value of Object.values(entry))assert.ok(['number','string','boolean'].includes(typeof value));
 const text=JSON.stringify(entry);
 for(const secret of ['rnbqkbnr','e2e4','e4','KQkq'])assert.ok(!text.includes(secret),secret);
});

test('failed searches log only a stable code; a throwing logger never breaks analysis',async()=>{
 const logs=[];let hang=true;
 const engine=createCoachEngine({verify:noVerify,movetimeMs:20,log:(e)=>{logs.push(e);throw Error('log sink down');},spawnImpl:fakeSpawn((cmd,emit)=>{
  if(cmd==='uci')emit('uciok');if(cmd==='isready')emit('readyok');
  if(cmd.startsWith('go')&&!hang){emit('info depth 5 multipv 1 score cp 1 nodes 1 time 1 pv e2e4');emit('info depth 5 multipv 2 score cp 0 nodes 1 time 1 pv d2d4');emit('info depth 5 multipv 3 score cp 0 nodes 1 time 1 pv c2c4');emit('bestmove e2e4');}
 })});
 await assert.rejects(engine.analyze(START),{code:'engine_timeout'});
 hang=false;
 assert.equal((await engine.analyze(START)).lines.length,3);
 engine.close();
 assert.deepEqual(logs.map(e=>[e.event,e.code??null,e.coldStart]),[['coach_engine_failed','engine_timeout',true],['coach_engine_analysis',null,true]]);
 assert.ok(!JSON.stringify(logs).includes('rnbqkbnr'));
});

// Real Stockfish 19 lite from the pinned npm package.
const real=createCoachEngine({movetimeMs:300});
test.after(()=>real.close());

test('[real] start position: three legal exact lines with cp score and depth',async()=>{
 const result=await real.analyze(START);
 assert.equal(result.lines.length,3);
 assert.match(result.nnue,/^nn-[0-9a-f]+\.nnue$/);
 for(const line of result.lines){
  assert.equal(line.scoreKind,'cp');assert.ok(line.depth>0);assert.equal(line.bound,null);
  const board=new Chess(START);for(const san of line.sanPv)board.move(san);
  assert.equal(line.wdlWhite.reduce((a,b)=>a+b,0),1000);
 }
 assert.ok(new Set(result.lines.map(l=>l.sanPv[0])).size===3);
});

test('[real] mate in one for White and for Black has the correct White-perspective sign',async()=>{
 const white=await real.analyze(WHITE_MATES);
 assert.deepEqual([white.lines[0].scoreKind,white.lines[0].scoreWhite,white.lines[0].sanPv[0]],['mate',1,'Ra8#']);
 const black=await real.analyze(BLACK_MATES);
 assert.deepEqual([black.lines[0].scoreKind,black.lines[0].scoreWhite,black.lines[0].sanPv[0]],['mate',-1,'Ra1#']);
 assert.equal(black.lines[0].wdlWhite[2],1000);
});

test('[real] Black to move: sign and WDL are swapped to White perspective',async()=>{
 const result=await real.analyze(SICILIAN_BLACK);
 const best=result.lines[0];
 assert.ok(best.scoreWhite>0,'White is better after 1.e4 c5 2.Nf3 in engine terms');
 assert.ok(best.wdlWhite[0]>best.wdlWhite[2],'White win share exceeds loss share');
 assert.equal(new Chess(SICILIAN_BLACK).move(best.sanPv[0]).color,'b');
});

test('[real] position with a single legal move returns one line',async()=>{
 const result=await real.analyze('7k/8/8/8/8/8/6q1/7K w - - 0 1');
 assert.equal(result.lines.length,1);assert.equal(result.lines[0].sanPv[0],'Kxg2');
});

test('prewarm initializes engine once without starting a position search',async()=>{
 let spawns=0,searches=0;
 const engine=createCoachEngine({verify:noVerify,spawnImpl:fakeSpawn(goodScript(()=>searches++),{onSpawn:()=>spawns++})});
 await Promise.all([engine.warmup(),engine.warmup()]);
 assert.equal(spawns,1);assert.equal(searches,0);assert.equal(engine.status().started,true);
 await engine.analyze(START);assert.equal(searches,1);engine.close();
});

test('cold initialization gets a bounded allowance without extending warm search timeout',async()=>{
 let release;
 const verify=()=>new Promise(r=>release=r);
 const engine=createCoachEngine({verify,spawnImpl:fakeSpawn(goodScript()),startupMs:200,deadlineMs:15,movetimeMs:20});
 const pending=engine.analyze(START);
 await new Promise(r=>setTimeout(r,30));
 release();const result=await pending;
 assert.equal(result.lines.length,3);engine.close();
});
