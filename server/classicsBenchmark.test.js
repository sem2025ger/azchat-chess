'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {run,loadBenchmark,validateBenchmark,deterministicChecks,sanTokens,blindOrders,THEMES,LANGUAGES}=require('./scripts/classicsBenchmark');

test('classics benchmark v1: 40 new + 4 book-control positions pass every validity rule',()=>{
 const bench=loadBenchmark();
 assert.deepEqual(validateBenchmark(bench),[]);
 const fresh=bench.positions.filter(p=>p.group==='new');
 assert.equal(fresh.length,40);
 assert.equal(bench.positions.filter(p=>p.group==='book-control').length,4);
 for(const t of THEMES)assert.ok(fresh.filter(p=>p.theme===t).length>=5,t);
 for(const l of LANGUAGES)assert.ok(fresh.some(p=>p.language===l),l);
});

test('benchmark validator rejects the defects found in the first live QA set',()=>{
 const bench=loadBenchmark();
 const mutate=(id,patch)=>({...bench,positions:bench.positions.map(p=>p.id===id?{...p,...patch}:p)});
 // Question about the side that is not to move (old cases 05 and 10).
 assert.ok(validateBenchmark(mutate('n01-iqp-white',{side:'black'})).some(e=>/n01-iqp-white: question is about black but white is to move/.test(e)));
 // A "new" position that is actually in the books (old cases 05/07/08/11 counted as ordinary tests).
 const book=bench.positions.find(p=>p.id==='c03-alekhine-g55');
 assert.ok(validateBenchmark(mutate('n01-iqp-white',{fen:book.fen,moves:undefined,side:book.side})).some(e=>/n01-iqp-white: new position is in the classics knowledge/.test(e)));
 // Stored FEN must match its move sequence.
 assert.ok(validateBenchmark(mutate('n02-iqp-black',{moves:'e4 c6'})).some(e=>/n02-iqp-black: fen does not match moves/.test(e)));
 // Side not to move in check (crashes Stockfish; first draft of n15).
 assert.ok(validateBenchmark(mutate('n15-bad-bishop-white',{fen:'8/5k2/4p1p1/1p1pPn1p/1P1P1P1P/2B3K1/8/8 b - - 0 1'})).some(e=>/n15-bad-bishop-white: side not to move is in check/.test(e)));
 // Book control must really be in the books.
 assert.ok(validateBenchmark(mutate('c03-alekhine-g55',{fen:bench.positions[0].fen,side:'white',bookRef:undefined})).some(e=>/c03-alekhine-g55: book-control position is not in the classics knowledge/.test(e)));
});

test('deterministic checks find the recommended move, top-3 membership and unverified moves',()=>{
 const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const lines=[{moves:['e4','e5','Nf3']},{moves:['d4','d5']},{moves:['Nf3','Nf6']}];
 const a=deterministicChecks(fen,'The d5 square matters. Play 1. e4 and later Nf3; Qh5xf7 is not serious, but Bb5 can come, and Qa4 too.',lines);
 assert.equal(a.recommendedMove,'e4');
 assert.equal(a.recommendedInTop3,true);
 assert.equal(a.recommendedIsTop1,true);
 assert.deepEqual(a.unverifiedMoves,['Qh5xf7','Qa4'],'Bb5 is legal along the e4 e5 line, so it is not unverified');
 const b=deterministicChecks(fen,'I suggest Nc3 here.',lines);
 assert.equal(b.recommendedMove,'Nc3');
 assert.equal(b.recommendedInTop3,false);
 const c=deterministicChecks(fen,'Kontrolliere das Feld e4 mit Figuren. Alekhine spielte so.',lines);
 assert.equal(c.recommendedMove,null,'a bare square without a move number is not a recommendation');
 assert.equal(c.mentionsClassicAuthor,true);
 assert.equal(deterministicChecks(fen,'Алёхин',lines).mentionsClassicAuthor,true);
 assert.deepEqual(sanTokens('O-O and 0-0-0, exd5, e8=Q+').map(t=>t.san),['O-O','O-O-O','exd5','e8=Q']);
});

test('blind A/B order is reproducible from the seed and uses both orders',()=>{
 const ids=loadBenchmark().positions.map(p=>p.id);
 assert.deepEqual(blindOrders(ids,7),blindOrders(ids,7));
 assert.notDeepEqual(blindOrders(ids,7),blindOrders(ids,8));
 const v=Object.values(blindOrders(ids,20261119));
 assert.ok(v.includes('OFF_A')&&v.includes('ON_A'));
});

test('benchmark dry run scores all 44 positions with 176 model calls and no key in the report',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chessaz-classics-bench-'));
 const mdOutput=path.join(dir,'b.md'),jsonOutput=path.join(dir,'b.json');
 try{
  const r=await run({dryRun:true,movetimeMs:300,mdOutput,jsonOutput});
  assert.equal(r.meta.dryRun,true);
  assert.equal(r.meta.modelCalls,176);
  assert.equal(r.meta.maxModelCalls,176);
  assert.equal(r.meta.partial,false);
  assert.equal(r.meta.allSameEngineEvidence,true);
  assert.equal(r.groups.new.scored,40);
  assert.equal(r.groups['book-control'].scored,4);
  for(const rec of r.records){
   assert.equal(rec.runs.OFF.classics.length,0,rec.id);
   assert.ok(rec.runs.ON.answer.startsWith('DRY RUN ON'),rec.id);
   assert.ok(rec.scores&&rec.preferred,rec.id);
  }
  const md=fs.readFileSync(mdOutput,'utf8');
  assert.match(md,/DRY RUN: synthetic provider and stub engine/);
  assert.equal(md.includes('DRY_RUN_NOT_A_KEY'),false);
  assert.equal(md.includes('Bearer '),false);
  assert.equal(fs.readFileSync(jsonOutput,'utf8').includes('DRY_RUN_NOT_A_KEY'),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('benchmark aborts after two consecutive provider failures and reports PARTIAL without retries',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chessaz-classics-bench-'));
 let calls=0;
 const failing=async()=>{calls++;return new Response('{}',{status:500});};
 try{
  const r=await run({dryRun:false,apiKey:'test-not-a-key',movetimeMs:200,concurrency:4,fetchImpl:failing,mdOutput:path.join(dir,'b.md'),jsonOutput:path.join(dir,'b.json')});
  assert.equal(r.meta.partial,true);
  assert.match(r.meta.partialReason,/2 consecutive provider failures/);
  assert.ok(calls<=5,`at most one in-flight call per worker plus one, got ${calls}`);
  assert.ok(r.records.filter(x=>x.runs.OFF.error==='not_run').length>=30,'remaining positions are not run');
  assert.match(fs.readFileSync(path.join(dir,'b.md'),'utf8'),/PARTIAL RESULT/);
  assert.equal(fs.readFileSync(path.join(dir,'b.md'),'utf8').includes('test-not-a-key'),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
