#!/usr/bin/env node
'use strict';
// Official Lichess broadcast PGNs, CC BY-SA 4.0. Strict QA-only monthly importer.
// Reuses the existing archive checksum/parser/filter; no staging DB tables.
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const readline=require('node:readline');
const {randomUUID}=require('node:crypto');
const {Client}=require('pg');
const {assertTarget}=require('./importFideGer');
const {sourceUrl,stageMonth,loadGermanFideList,LICENSE}=require('./importBroadcast');

const QA='iukmpcytsuofqhxsumbu';
const MAX_DB_BYTES=150000000; // Strict decimal MB, not MiB.
const BATCH_SIZE=200;
const COLS=['id','source_month','source_url','license_url','pgn',
 'white_name','black_name','white_key','black_key','white_fide_id','black_fide_id',
 'event','game_date','eco','opening','time_control'];
const TYPES=['text','text','text','text','text','text','text','text','text',
 'bigint','bigint','text','date','text','text','text'];
const DDL=COLS.map((c,i)=>c+' '+TYPES[i]).join(', ');
const UPDATE=COLS.slice(1).map(c=>c+' = EXCLUDED.'+c).join(', ');
const ROW_TARGET=COLS.slice(1).map(c=>'spieler_broadcast_games.'+c).join(', ');
const ROW_EXCLUDED=COLS.slice(1).map(c=>'EXCLUDED.'+c).join(', ');
const INSERT_SQL='INSERT INTO public.spieler_broadcast_games ('+COLS.join(', ')+') '+
 'SELECT '+COLS.join(', ')+' FROM jsonb_to_recordset($1::jsonb) AS incoming('+DDL+') '+
 'ON CONFLICT (id) DO UPDATE SET '+UPDATE+
 ' WHERE ROW('+ROW_TARGET+') IS DISTINCT FROM ROW('+ROW_EXCLUDED+') '+
 'RETURNING (xmax = 0) AS inserted';

function guardDatabaseUrl(connectionString){
 let u;
 try{u=new URL(connectionString);}catch{throw Error('QA database connection required');}
 const direct=u.hostname==='db.'+QA+'.supabase.co'&&u.username==='postgres'&&(!u.port||u.port==='5432');
 const pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)&&
  decodeURIComponent(u.username)==='postgres.'+QA&&['5432','6543'].includes(u.port);
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.password||u.pathname!=='/postgres'||
    u.hash||(!direct&&!pooler))throw Error('QA-only database URL required; production forbidden');
 if(u.search&&[...u.searchParams.keys()].some(k=>k!=='sslmode') )throw Error('Unexpected database URL parameter');
 if(u.searchParams.has('sslmode')&&!['require','verify-full'].includes(u.searchParams.get('sslmode')))throw Error('TLS required');
 return true;
}
function validateArgs(argv){
 const args={};
 for(const arg of argv){
  if(arg==='--apply'){if(args.apply)throw Error('Duplicate --apply');args.apply=true;continue;}
  const m=arg.match(/^--(month|dir|target)=(.+)$/);
  if(!m||args[m[1]])throw Error('Expected --month=YYYY-MM --dir=/absolute/path --target=qa [--apply]');
  args[m[1]]=m[2];
 }
 sourceUrl(args.month);
 if(args.target!=='qa'||!args.dir||!path.isAbsolute(args.dir))throw Error('QA target and absolute directory required');
 return args;
}
async function databaseBytes(db){
 const result=await db.query('SELECT pg_database_size(current_database())::bigint AS bytes');
 const bytes=Number(result.rows[0]?.bytes);
 if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('Database size unavailable');
 return bytes;
}
function batchReservation(rows){
 // Deliberately overestimate row, TOAST and index growth before *every* batch.
 const bytes=Buffer.byteLength(JSON.stringify(rows));
 return 2*1024*1024 + 4*bytes + rows.length*8192;
}
function validateRow(row,month){
 if(!row||row.source_month!==month||row.source_url!==sourceUrl(month)||
  row.license_url!==LICENSE||!/^[a-f0-9]{64}$/.test(row.id||'')||
  typeof row.pgn!=='string'||!row.pgn||Buffer.byteLength(row.pgn)>65536||
  /[\[\]{}]/.test(row.pgn)||!/(?:^|\s)(?:1-0|0-1|1\/2-1\/2)\s*$/.test(row.pgn))
  throw Error('Invalid SAN-only staged row');
 return row;
}
async function upsertBatch(db,rows,{limit=MAX_DB_BYTES}={}){
 if(!rows.length)return {inserted:0,updated:0,bytes:await databaseBytes(db)};
 await db.query('BEGIN');
 try{
  const before=await databaseBytes(db);
  if(before>=limit||before+batchReservation(rows)>limit)throw Error('150 MB database size guard');
  const result=await db.query(INSERT_SQL,[JSON.stringify(rows)]);
  const after=await databaseBytes(db);
  if(after>limit)throw Error('150 MB post-write database size guard');
  await db.query('COMMIT');
  const inserted=result.rows.filter(r=>r.inserted===true||r.inserted==='t').length;
  return {inserted,updated:result.rowCount-inserted,bytes:after};
 }catch(e){await db.query('ROLLBACK');throw e;}
}
async function buildFilter(db,dir){
 // Read the *current QA public.spieler_players* list: IDs and exact names only.
 const {rows}=await db.query('SELECT fide_id::text AS fide_id, name FROM public.spieler_players ORDER BY fide_id');
 if(rows.length===0||rows.length>100000||rows.some(r=>!/^[1-9]\d{0,9}$/.test(r.fide_id)||typeof r.name!=='string'||/[\r\n\t]/.test(r.name)))throw Error('Invalid QA Spieler snapshot');
 const filename=path.join(dir,'.spieler-filter-'+randomUUID()+'.tsv');
 await fsp.writeFile(filename,rows.map(r=>r.fide_id+'\t'+r.name).join('\n')+'\n',{flag:'wx',mode:0o600});
 try{return loadGermanFideList(filename);}finally{await fsp.rm(filename,{force:true});}
}
async function runMonth({month,dir,target='qa',url,db,apply=false,stage=stageMonth,progress=()=>{}}){
 assertTarget(target,url);
 if(target!=='qa')throw Error('QA only');
 progress('database_size');
 const startBytes=await databaseBytes(db);
 if(startBytes>=MAX_DB_BYTES)throw Error('150 MB database size guard');
 await fsp.mkdir(dir,{recursive:true});
 progress('spieler_snapshot');
 const filter=await buildFilter(db,dir);
 progress('archive_stage');
 const report=await stage({month,dir,target,url,filter});
 let imported=0,updated=0,submitted=0,batches=0,finalBytes=startBytes;
 if(apply){
  progress('database_import');
  const reader=readline.createInterface({input:fs.createReadStream(report.staged_file),crlfDelay:Infinity});
  let batch=[];
  for await(const line of reader){
   if(!line.trim())continue;
   batch.push(validateRow(JSON.parse(line),month));
   if(batch.length===BATCH_SIZE){
    const result=await upsertBatch(db,batch);
    imported+=result.inserted;updated+=result.updated;submitted+=batch.length;batches++;finalBytes=result.bytes;batch=[];
   }
  }
  if(batch.length){
   const result=await upsertBatch(db,batch);
   imported+=result.inserted;updated+=result.updated;submitted+=batch.length;batches++;finalBytes=result.bytes;
  }
  if(submitted!==report.accepted)throw Error('Staging row count changed during import');
 }
 finalBytes=await databaseBytes(db);
 if(finalBytes>MAX_DB_BYTES)throw Error('150 MB database size guard');
 return {month,seen:report.seen,filtered:report.accepted,rejected:report.rejected,
  excluded:report.excluded,submitted,inserted:imported,updated,batches,
  database_bytes:finalBytes,apply};
}
const SAFE_CODES=new Set(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT',
 'ENETUNREACH','EHOSTUNREACH','CERT_HAS_EXPIRED','SELF_SIGNED_CERT_IN_CHAIN',
 'DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID',
 '28P01','28000','3D000','42P01','42703','42501','53300','57P03']);
function safeFailure(error,phase){
 // Never serialize provider messages, stacks, SQL, URLs or arbitrary codes.
 let code='UNCLASSIFIED';
 for(const e of [error,error?.cause])if(SAFE_CODES.has(e?.code)){code=e.code;break;}
 return {error:'broadcast_import_failed',phase,code};
}
async function main({argv=process.argv.slice(2),env=process.env,ClientImpl=Client,
 run=runMonth,log=console.log,logError=console.error}={}){
 let phase='arguments',db;
 try{
  const args=validateArgs(argv);
  phase='qa_target';
  const url=env.SUPABASE_URL||'';
  assertTarget(args.target,url);
  phase='database_url';
  const connectionString=env.QA_DATABASE_URL||'';
  guardDatabaseUrl(connectionString);
  phase='database_connect';
  db=new ClientImpl({connectionString,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000});
  await db.connect();
  phase='month_processing';
  const result=await run({month:args.month,dir:args.dir,target:args.target,url,db,apply:!!args.apply,
   progress:value=>{phase=value;}});
  log(JSON.stringify(result));
  return true;
 }catch(error){logError(JSON.stringify(safeFailure(error,phase)));return false;}
 finally{if(db)await db.end().catch(()=>{});}
}
if(require.main===module)main().then(ok=>{if(!ok)process.exitCode=1;});
module.exports={QA,MAX_DB_BYTES,BATCH_SIZE,INSERT_SQL,guardDatabaseUrl,validateArgs,
 databaseBytes,batchReservation,validateRow,upsertBatch,buildFilter,runMonth,safeFailure,main};
