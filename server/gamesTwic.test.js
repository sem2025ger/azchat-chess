'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {zipSync,strToU8}=require('fflate');
const {Chess}=require('chess.js');
const {normalizeName,positionHash,splitPgn,parseGame}=require('./src/games/twic/pgn');
const {targetGuard,extractPgn,boundedDownload,importIssue,QA_REF}=require('./src/games/twic/importer');
const {options}=require('./src/games/twic/cli');
const synthetic='[Event "Synthetic fixture"]\n[Site "Test"]\n[Date "2026.01.01"]\n[Round "1"]\n[White "Example Alpha"]\n[Black "Example Beta"]\n[Result "*"]\n\n1. Nf3 Nf6 2. g3 g6 *';
test('names normalize accents, sharp-s and punctuation',()=>assert.equal(normalizeName('  MÜLLER, Jörg--Straße '),'muller jorg strasse'));
test('signed 64-bit position hash is stable across transpositions and ignores counters',()=>{
 const a=new Chess(),b=new Chess();['Nf3','Nf6','g3','g6'].forEach(m=>a.move(m));['g3','g6','Nf3','Nf6'].forEach(m=>b.move(m));
 assert.equal(positionHash(a.fen()),positionHash(b.fen()));assert.equal(positionHash(a.fen()),positionHash(a.fen().replace(/0 3$/,'8 99')));
 const seen=new Set();const c=new Chess();seen.add(positionHash(c.fen()));for(const m of ['e4','e5','Nf3','Nc6','Bb5']){c.move(m);seen.add(positionHash(c.fen()));}assert.equal(seen.size,6);
});
test('PGN splitting ignores comment pseudo headers; hashes survive whitespace changes',()=>{
 const bad='[Event "Bad fixture"]\n[White "Example"]\n[Black "Other"]\n\n1. e9 *';
 assert.equal(splitPgn(synthetic+'\n'+bad+'\n'+synthetic).length,3);
 assert.equal(splitPgn(synthetic+'\n{\n[Event "inside comment"]\n}\n'+synthetic).length,2);
 assert.throws(()=>parseGame(bad,1));assert.equal(parseGame(synthetic,1).game_hash,parseGame(synthetic.replace('1. Nf3','1.   Nf3'),2).game_hash);
 assert.ok(parseGame(synthetic,1).positions.every(p=>p.ply<=24));
});
test('zip extraction is in-memory and only returns PGN, download obeys byte cap',async()=>{
 assert.match(extractPgn(zipSync({'fixture.pgn':strToU8(synthetic),'ignore.txt':strToU8('ignored')})),/Synthetic fixture/);
 await assert.rejects(boundedDownload('https://example.invalid',async()=>new Response('long-body'),3),/TWIC_SIZE_LIMIT/);
});
test('importer target and argument guards require explicit QA; backfill defaults to four',()=>{
 targetGuard('https://'+QA_REF+'.supabase.co',QA_REF);
 assert.throws(()=>targetGuard('https://production.supabase.co',QA_REF),/TARGET_MUST_BE_EXPLICIT_QA/);
 assert.throws(()=>targetGuard('https://'+QA_REF+'.supabase.co'),/TARGET_MUST_BE_EXPLICIT_QA/);
 assert.equal(options(['--backfill','--target-ref',QA_REF])['--backfill'],'4');
 assert.throws(()=>options(['--issue','1','--latest']),/CHOOSE_ONE/);
});
function fakeStore(){const hashes=new Set();let done=false,failed=false;return{hashes,get failed(){return failed;},async call(op,args={}){
 if(op==='start')return{done,size_bytes:1000};if(op==='size')return{size_bytes:1000};if(op==='batch'){let inserted=0;for(const g of args.p_games)if(!hashes.has(g.game_hash)){hashes.add(g.game_hash);inserted++;}return{inserted};}if(op==='done')done=true;if(op==='failed')failed=true;return{ok:true};
}};}
test('import skips malformed game, is idempotent and stops before oversized batch',async()=>{
 const store=fakeStore();const pgn=synthetic+'\n[Event "Broken"]\n\n1. e9 *';
 const first=await importIssue({issue:1,store,pgn});assert.equal(first.inserted,1);assert.equal(first.skipped,1);
 const second=await importIssue({issue:1,store,pgn});assert.equal(second.inserted,0);assert.equal(store.hashes.size,1);
 const small=fakeStore();await assert.rejects(importIssue({issue:1,store:small,pgn:synthetic,maxMb:0.001}),/DB_SIZE_LIMIT/);assert.equal(small.hashes.size,0);assert.equal(small.failed,true);
});
