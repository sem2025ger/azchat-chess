'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateFen,Chess}=require('chess.js');
const {buildCases,run,MAX_MODEL_CALLS}=require('./scripts/classicsQaReview');

test('classics QA review defines exactly 12 legal positions across all six languages',()=>{
 const cases=buildCases();
 assert.equal(cases.length,12);
 assert.equal(MAX_MODEL_CALLS,24);
 const langs=new Set(cases.map(c=>c.lang));
 for(const code of ['de','en','ru','uk','az','tr'])assert.ok(langs.has(code),`missing language ${code}`);
 for(const tc of cases)assert.ok(validateFen(tc.fen).ok,`invalid FEN ${tc.id}`);
});

test('classics QA review dry run produces sanitized 12-position OFF/ON report without network or key',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chessaz-classics-qa-'));
 const mdOutput=path.join(dir,'classics-qa-review.md');
 const jsonOutput=path.join(dir,'classics-qa-review.json');
 try{
  const data=await run({dryRun:true,model:'gpt-6-sol',movetimeMs:300,mdOutput,jsonOutput});
  assert.equal(data.meta.dryRun,true);
  assert.equal(data.meta.modelCalls,24);
  assert.equal(data.meta.totalPositions,12);
  assert.equal(data.meta.allComparableEngine,true);
  assert.equal(data.meta.allSucceeded,true);
  for(const rec of data.records){
   assert.equal(rec.runs.OFF.classicsKnowledge.length,0);
   // Structural retrieval attaches at most 2 items, each with a stated match, or nothing at all.
   assert.ok(rec.runs.ON.classicsKnowledge.length<=2,rec.tc.id);
   assert.ok(rec.runs.ON.evidenceBytes<16*1024);
  }
  const md=fs.readFileSync(mdOutput,'utf8');
  assert.match(md,/DRY RUN: synthetic provider and stub engine/);
  assert.equal(md.includes('DRY_RUN_NOT_A_KEY'),false,'never write key placeholder to report');
  assert.equal(md.includes('Bearer '),false,'never write auth headers to report');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('every classics QA question is about the side to move and does not presuppose a false result',()=>{
 for(const tc of buildCases()){
  const turn=new Chess(tc.fen).turn()==='w'?'white':'black';
  assert.equal(tc.side,turn,`${tc.id}: question about ${tc.side}, but ${turn} is to move`);
 }
 const dragon=buildCases().find(c=>c.id==='10-dragon-exch');
 assert.ok(new Chess(dragon.fen).moves().includes('Rxc3'),'the asked exchange sacrifice must be legal now');
 const kp=buildCases().find(c=>c.id==='12-opposition');
 assert.doesNotMatch(kp.question,/^Wie gewinnt/,'the K+P position is a draw; the question must not assume a win');
});
