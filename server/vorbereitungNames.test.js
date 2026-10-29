'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const {broadcastRow,stripComments,sourceUrl,streamGames,loadGermanFideList}=require('./scripts/importBroadcast');
const {assertTarget}=require('./scripts/importFideGer');
const {GamesProvider,rebuildBroadcastPgn}=require('./spielerGamesProvider');const {fullNameKey}=require('../shared/playerNames.mjs');
const pgn='[Event "Bochum (Open)"]\n[White "Huseynov, Sabir"]\n[Black "Guest, Player"]\n[WhiteFideId "13404431"]\n[UTCDate "2026.09.12"]\n[TimeControl "5400+30"]\n[ECO "B90"]\n[Opening "Sicilian Defense: Najdorf Variation"]\n[Result "1-0"]\n\n1. e4 { [%eval 0.1] } c5 (1... e5) 2. Nf3 d6 3. d4 1-0';
test('official broadcast metadata, source restriction, actual license and exact full-name keys',async()=>{
 const row=broadcastRow(pgn,'2026-09');assert.equal(row.white_fide_id,'13404431');assert.equal(row.white_key,'huseynov, sabir');assert.equal(row.event,'Bochum (Open)');assert.equal(row.game_date,'2026-09-12');assert.equal(row.eco,'B90');assert.equal(row.time_control,'5400+30');assert.equal(row.license_url,'https://creativecommons.org/licenses/by-sa/4.0/');assert.ok(!row.pgn.includes('%eval'));assert.ok(!row.pgn.includes('[Event'));assert.ok(!row.pgn.includes('{'));assert.ok(row.pgn.includes('1-0'));assert.ok(!row.pgn.includes('1... e5'));
 assert.equal(sourceUrl('2026-09'),'https://database.lichess.org/broadcast/lichess_db_broadcast_2026-09.pgn.zst');assert.throws(()=>sourceUrl('../2026'));
 assert.throws(()=>assertTarget('qa','https://kmwfvvliundhuovoakoa.supabase.co'));assert.throws(()=>broadcastRow(pgn.replace('[Result "1-0"]','[Result "*"]'),'2026-09'));
 assert.equal(fullNameKey(' Huseynov ,  Sabir '),'huseynov, sabir');assert.equal(fullNameKey('Huseynov'),null);assert.notEqual(fullNameKey('Huseynov, S.'),fullNameKey('Huseynov, Sabir'));
 const games=[];for await(const game of streamGames(Readable.from([pgn+'\n\n'+pgn])))games.push(game);assert.equal(games.length,2);assert.ok(stripComments(pgn).includes('Bochum (Open)'));
});
test('official archive staging verifies source and staged checksums; interrupted/corrupted output is rebuilt atomically',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{zstdCompressSync}=require('node:zlib'),{createHash}=require('node:crypto');const {stageMonth}=require('./scripts/importBroadcast');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chessaz-broadcast-'));try{
  const compressed=zstdCompressSync(Buffer.from(pgn)),sha=createHash('sha256').update(compressed).digest('hex'),filename='lichess_db_broadcast_2026-09.pgn.zst';await fs.writeFile(path.join(dir,filename),compressed);
  const options={month:'2026-09',dir,target:'local',url:'http://127.0.0.1:54321',fetchImpl:async url=>{assert.equal(url,'https://database.lichess.org/broadcast/sha256sums.txt');return new Response(sha+'  '+filename);}};
  const fixtureFilter={sha256:'a'.repeat(64),eligible:()=>true};options.filter=fixtureFilter;
  const report=await stageMonth(options);assert.equal(report.accepted,1);assert.equal(report.seen,1);assert.equal(report.staged_sha256,createHash('sha256').update(await fs.readFile(report.staged_file)).digest('hex'));
  await fs.writeFile(report.staged_file,'truncated');const repaired=await stageMonth(options);assert.equal(repaired.staged_sha256,report.staged_sha256);assert.equal((await fs.readFile(report.staged_file,'utf8')).split('\n').filter(Boolean).length,1);
  await fs.writeFile(path.join(dir,filename),'corrupt');await assert.rejects(stageMonth(options),/checksum mismatch/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('GamesProvider reuses legal normalization for named TWIC/broadcast games; fallback stays marked and candidates are not guessed',async()=>{
 const row={...broadcastRow(pgn,'2026-09'),source:'lichess-broadcast',color:'white',link_basis:'fide_id'};
 const provider=new GamesProvider({candidates:async()=>[{fide_id:13404431}],namedPage:async({fideId})=>{assert.equal(fideId,'13404431');return [row,{...row,id:'other',link_basis:'name',pgn:pgn.replace('3. d4','3. Nc3')}];}});
 const result=await provider.namedPreparation({name:'Huseynov, Sabir'});assert.equal(result.fideId,'13404431');assert.equal(result.games.length,2);assert.equal(result.games[1].link_basis,'name');assert.ok(result.games.every(g=>g.speed==='classical'));
 const ambiguous=new GamesProvider({candidates:async()=>[{fide_id:1},{fide_id:2}],namedPage:async()=>{throw Error('must choose');}});assert.equal((await ambiguous.namedPreparation({name:'Same, Name'})).candidates.length,2);
 const fallback=new GamesProvider({candidates:async()=>[],namedPage:async()=>[{...row,link_basis:'name'}]});assert.equal((await fallback.namedPreparation({name:'Huseynov, Sabir'})).games[0].link_basis,'name');
 await assert.rejects(fallback.namedPreparation({name:'Huseynov'}),e=>e.code==='invalid_query');
});

test('QA German FIDE snapshot: FIDE match first, no surname-only; SAN-only reconstructs standard PGN for analysis',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'fide-qa-'));
 try{const f=path.join(tmp,'names.tsv');await fs.writeFile(f,'13404431\tHuseynov, Sabir\n1234567\tMuller, Alice\n');const list=loadGermanFideList(f);
 assert.equal(list.players,2);assert.equal(list.eligible(pgn),true);
 assert.equal(list.eligible(pgn.replace('13404431','999999')),false);
 assert.equal(list.eligible(pgn.replace('[WhiteFideId "13404431"]','')),true);
 assert.equal(list.eligible(pgn.replace('Sabir','S.').replace('[WhiteFideId "13404431"]','')),false);
 const row={...broadcastRow(pgn,'2026-09'),source:'lichess-broadcast'};
 const full=rebuildBroadcastPgn(row);assert.match(full,/\[Event "Bochum \(Open\)"\]/);assert.match(full,/\[Result "1-0"\]/);assert.match(full,/\[WhiteFideId "13404431"\]/);
 const {normalizeGame}=require('./spielerGamesProvider');const parsed=normalizeGame(full,'lichess-broadcast');assert.equal(parsed.result,'1-0');assert.equal(parsed.white,'Huseynov, Sabir');
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});

test('checksum-valid non-Zstandard archive fails safely without publishing partial staging',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
 const {stageMonth}=require('./scripts/importBroadcast');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chessaz-broadcast-invalid-'));
 try{
  const file='lichess_db_broadcast_2026-09.pgn.zst',garbage=Buffer.from('not a Zstandard frame');
  await fs.writeFile(path.join(dir,file),garbage);
  const sha=createHash('sha256').update(garbage).digest('hex');
  await assert.rejects(stageMonth({month:'2026-09',dir,target:'local',url:'http://127.0.0.1:54321',
   filter:{sha256:'a'.repeat(64),eligible:()=>true},
   fetchImpl:async()=>new Response(sha+'  '+file)}),/Zstandard archive decode failed/);
  await assert.rejects(fs.stat(path.join(dir,'2026-09.jsonl')));
  await assert.rejects(fs.stat(path.join(dir,'2026-09.report.json')));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
