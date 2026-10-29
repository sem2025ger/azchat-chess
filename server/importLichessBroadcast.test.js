'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {guardDatabaseUrl,validateArgs,validateRow,batchReservation,upsertBatch,MAX_DB_BYTES,runMonth}=require('./scripts/importLichessBroadcast');
const {LICENSE,sourceUrl}=require('./scripts/importBroadcast');
const row={id:'a'.repeat(64),source_month:'2026-04',source_url:sourceUrl('2026-04'),
 license_url:LICENSE,pgn:'e4 e5 Nf3 Nc6 1-0',white_name:'Sample, White',black_name:'Sample, Black'};
test('QA database guard refuses production, other projects, unsafe URLs and non-TLS',()=>{
 assert.equal(guardDatabaseUrl('postgresql://postgres:secret@db.iukmpcytsuofqhxsumbu.supabase.co:5432/postgres'),true);
 assert.equal(guardDatabaseUrl('postgresql://postgres.iukmpcytsuofqhxsumbu:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'),true);
 for(const url of ['postgresql://postgres:secret@db.kmwfvvliundhuovoakoa.supabase.co:5432/postgres',
 'postgresql://postgres.kmwfvvliundhuovoakoa:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
 'postgresql://postgres:secret@evil.example:5432/postgres','postgresql://postgres@db.iukmpcytsuofqhxsumbu.supabase.co/postgres',
 'postgresql://postgres:secret@db.iukmpcytsuofqhxsumbu.supabase.co/postgres?sslmode=disable'])
  assert.throws(()=>guardDatabaseUrl(url));
});
test('one month only; QA only; require absolute directory',()=>{
 assert.deepEqual(validateArgs(['--month=2026-04','--target=qa','--dir=/tmp/lichess']),{month:'2026-04',target:'qa',dir:'/tmp/lichess'});
 for(const a of [['--month=2026-04','--target=production','--dir=/tmp/x'],
 ['--month=2026-04','--months=6','--target=qa','--dir=/tmp/x'],
 ['--month=2026-13','--target=qa','--dir=/tmp/x'],
 ['--month=2026-04','--target=qa','--dir=relative']])assert.throws(()=>validateArgs(a));
});
test('SAN-only, official attribution and archive date enforced',()=>{
 assert.equal(validateRow(row,'2026-04'),row);
 for(const p of ['[Event "Fake"]\n1. e4 e5 1-0','e4 {comment} e5 1-0','e4 e5 *'])
  assert.throws(()=>validateRow({...row,pgn:p},'2026-04'));
 assert.throws(()=>validateRow({...row,source_url:'https://unapproved'},'2026-04'));
 assert.throws(()=>validateRow({...row,license_url:'CC0'},'2026-04'));
});
test('reserve conservative space before write, roll back on guard; conflict idempotent',async()=>{
 const events=[];let size=30000000,insert=true;
 const db={async query(sql){
  events.push(sql);
  if(sql.includes('pg_database_size'))return {rows:[{bytes:size}]};
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {};
  if(sql.startsWith('INSERT INTO'))return {rowCount:insert?1:0,rows:insert?[{inserted:true}]:[]};
  throw Error('unexpected query');
 }};
 assert.ok(batchReservation([row])>2000000);
 assert.deepEqual(await upsertBatch(db,[row]),{inserted:1,updated:0,bytes:size});
 insert=false;assert.deepEqual(await upsertBatch(db,[row]),{inserted:0,updated:0,bytes:size});
 await assert.rejects(upsertBatch(db,[row],{limit:size+1}),/150 MB/);
 assert.equal(events.at(-1),'ROLLBACK');
 size=MAX_DB_BYTES;await assert.rejects(upsertBatch(db,[row]),/150 MB/);
 assert.equal(events.at(-1),'ROLLBACK');
});
test('month runner reads German FIDE snapshot from QA and does not write in dry-run',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'chessaz-month-test-'));let stageCalls=0;
 try{
  const db={async query(sql){assert.match(sql,/^(SELECT)/);if(sql.includes('pg_database_size'))return {rows:[{bytes:29810000}]};
   assert.match(sql,/public.spieler_players/);return {rows:[{fide_id:'13404431',name:'Huseynov, Sabir'}]};}};
  const result=await runMonth({month:'2026-04',dir,target:'qa',url:'https://iukmpcytsuofqhxsumbu.supabase.co',db,
   stage:async({filter})=>{stageCalls++;assert.equal(filter.eligible('[White "Huseynov, Sabir"]\n[Black "Nobody, Person"]\n[WhiteFideId "13404431"]'),true);
    return {seen:10,accepted:3,rejected:0,excluded:7};}});
  assert.equal(stageCalls,1);assert.equal(result.inserted,0);assert.equal(result.filtered,3);assert.equal(result.database_bytes,29810000);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('CLI reports safe failure stage and allowlisted code, never provider secrets',async()=>{
 const {main,safeFailure}=require('./scripts/importLichessBroadcast');
 const secret='postgresql://postgres:DO_NOT_LOG@db.iukmpcytsuofqhxsumbu.supabase.co:5432/postgres';
 const messages=[];let ended=false;
 const ok=await main({argv:['--month=2026-04','--target=qa','--dir=/tmp/fixture'],
  env:{SUPABASE_URL:'https://iukmpcytsuofqhxsumbu.supabase.co',QA_DATABASE_URL:secret},
  ClientImpl:class{async connect(){throw Object.assign(Error(secret),{code:'28P01',detail:secret});}async end(){ended=true;}},
  logError:v=>messages.push(v)});
 assert.equal(ok,false);assert.equal(ended,true);
 assert.deepEqual(JSON.parse(messages[0]),{error:'broadcast_import_failed',phase:'database_connect',code:'28P01'});
 assert.ok(!messages.join('').includes('DO_NOT_LOG'));
 assert.equal(safeFailure({code:secret,cause:{code:'SELF_SIGNED_CERT_IN_CHAIN'}},'database_connect').code,'SELF_SIGNED_CERT_IN_CHAIN');
 assert.equal(safeFailure({message:secret,code:secret},'database_connect').code,'UNCLASSIFIED');
});

test('Supabase CA and strict TLS survive pg connection-string parsing',()=>{
 const {databaseConfig}=require('./scripts/importLichessBroadcast');
 const {Client}=require('pg');
 const {X509Certificate}=require('node:crypto');
 const fs=require('node:fs'),path=require('node:path');
 const ca=fs.readFileSync(path.join(__dirname,'certs/supabase-root-ca.crt'),'utf8');
 const cert=new X509Certificate(ca);
 assert.equal(cert.ca,true);assert.ok(cert.subject.includes('Supabase Root 2021 CA'));
 assert.equal(cert.verify(cert.publicKey),true);
 for(const suffix of ['', '?sslmode=require','?sslmode=verify-full']){
  const config=databaseConfig('postgresql://postgres.iukmpcytsuofqhxsumbu:fixture%40pass@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'+suffix);
  const client=new Client(config);
  assert.equal(config.ssl.ca,ca);assert.equal(config.ssl.rejectUnauthorized,true);
  assert.equal(client.connectionParameters.ssl.ca,ca);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized,true);
  assert.equal(client.connectionParameters.ssl.checkServerIdentity,undefined);
  assert.equal(client.connectionParameters.password,'fixture@pass');
 }
 assert.throws(()=>databaseConfig('postgresql://postgres:fixture@db.iukmpcytsuofqhxsumbu.supabase.co/postgres?sslmode=disable'));
});
