#!/usr/bin/env node
'use strict';
// Official monthly broadcast archives only; local/QA target guard shared with
// the existing importer. CC BY-SA 4.0, as specifically stated for broadcasts.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto'),{Readable,Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const {spawn}=require('node:child_process');const readline=require('node:readline');
const {assertTarget}=require('./importFideGer');
const {fullNameKey}=require('../../shared/playerNames.mjs');
const LICENSE='https://creativecommons.org/licenses/by-sa/4.0/';
const FILTER_FORMAT=3;
function sourceUrl(month){if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid month');return 'https://database.lichess.org/broadcast/lichess_db_broadcast_'+month+'.pgn.zst';}
function stripComments(pgn){
 const lines=pgn.split('\n');let i=0;while(i<lines.length&&(!lines[i].trim()||lines[i].startsWith('[')))i++;
 const header=lines.slice(0,i).join('\n');let out='',braces=0,rav=0,semicolon=false;
 for(const c of lines.slice(i).join('\n')){if(c==='\n')semicolon=false;if(semicolon)continue;if(c===';'&&!braces){semicolon=true;continue;}if(c==='{'){braces++;continue;}if(c==='}'&&braces){braces--;continue;}if(braces)continue;if(c==='('){rav++;continue;}if(c===')'&&rav){rav--;continue;}if(!rav)out+=c;}
 if(braces||rav)throw Error('Truncated annotation');return header+'\n'+out.replace(/\$\d+/g,'');
}
function broadcastRow(pgn,month){
 const url=sourceUrl(month);if(Buffer.byteLength(pgn)>1024*1024)throw Error('Oversized PGN');
 const clean=stripComments(pgn);
 const header=name=>clean.match(new RegExp('^\\['+name+' "([^"\\n]*)"\\]','m'))?.[1]||'';
 const white=header('White'),black=header('Black'),result=header('Result');
 const variant=header('Variant');if(variant&&!['Standard','standard','Chess'].includes(variant))throw Error('Unsupported variant');
 if(!['1-0','0-1','1/2-1/2'].includes(result)||!white||!black||white.length>150||black.length>150||Buffer.byteLength(clean)>65536)throw Error('Unfinished or unnamed game');
 const movetext=clean.split('\n').filter(l=>!l.startsWith('[')).join(' ').replace(/\d+\.(?:\.\.)?/g,' ').trim();
 if(!/[a-h][1-8]/.test(movetext)||movetext.split(/\s+/).length>2055)throw Error('Missing/oversized moves');
 // Archives are checksum-verified official data. Import metadata/mainline without
 // replaying millions of plies. GamesProvider validates legal PGN on retrieval,
 // and position search validates/replays every game it actually examines.
 const day=[header('UTCDate'),header('Date')].find(v=>/^\d{4}\.\d{2}\.\d{2}$/.test(v));
 const iso=day?.replaceAll('.','-');const date=iso&&Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null;
 const gameUrl=header('GameURL');const id=createHash('sha256').update('broadcast\n'+(/^https:\/\/lichess\.org\/broadcast\//.test(gameUrl)?gameUrl:clean)).digest('hex');
 const fide=key=>/^[1-9]\d{0,9}$/.test(header(key))?header(key):null;
 return {id,source_month:month,source_url:url,license_url:LICENSE,pgn:movetext,
  white_name:white,black_name:black,white_key:fullNameKey(white),black_key:fullNameKey(black),
  white_fide_id:fide('WhiteFideId'),black_fide_id:fide('BlackFideId'),event:header('Event').slice(0,250),game_date:date,
  eco:/^[A-E]\d\d$/.test(header('ECO'))?header('ECO'):null,opening:header('Opening').slice(0,200)||null,time_control:header('TimeControl').slice(0,60)||'?'};
}
async function* streamGames(input){let buffer='';for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
 if(line.startsWith('[Event ')&&buffer.trim()){yield buffer;buffer='';}buffer+=line+'\n';if(Buffer.byteLength(buffer)>1024*1024)throw Error('Oversized archive record');
 }if(buffer.trim())yield buffer;}
async function officialArchive(month,dir,fetchImpl=fetch){
 const url=sourceUrl(month),file=path.join(dir,path.basename(new URL(url).pathname));await fsp.mkdir(dir,{recursive:true});
 const manifest=await fetchImpl('https://database.lichess.org/broadcast/sha256sums.txt',{redirect:'error'});if(!manifest.ok)throw Error('Checksum manifest unavailable');
 const hashes=await manifest.text();if(hashes.length>100000)throw Error('Oversized manifest');
 const expected=hashes.split('\n').map(l=>l.trim().split(/\s+/)).find(v=>v[1]===path.basename(file))?.[0];if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Month absent from official manifest');
 if(!fs.existsSync(file)){
  const response=await fetchImpl(url,{redirect:'error'});if(!response.ok||!response.body)throw Error('Official archive unavailable');let bytes=0;
  const cap=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;done(bytes>256*1024*1024?Error('Archive byte limit'):null,chunk);}});
  try{await pipeline(Readable.fromWeb(response.body),cap,fs.createWriteStream(file));}catch(e){await fsp.rm(file,{force:true});throw e;}
 }
 const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 if(hash.digest('hex')!==expected)throw Error('Official archive checksum mismatch');return {file,url,sha256:expected};
}

function loadGermanFideList(file){
 if(typeof file!=='string'||!file)throw Error('German FIDE list path required');
 const raw=fs.readFileSync(file,'utf8');const ids=new Set(),names=new Set();
 for(const line of raw.split('\n')){
  if(!line.trim())continue;
  const [id,...parts]=line.replace(/\r$/,'').split('\t');
  if(!/^[1-9]\d{0,9}$/.test(id)||parts.length===0)throw Error('Invalid Spieler snapshot');
  ids.add(id);
  const key=fullNameKey(parts.join('\t'));if(key)names.add(key);
 }
 if(!ids.size)throw Error('Empty German Spieler snapshot');
 const sha256=createHash('sha256').update(raw).digest('hex');
 const eligible=(pgn)=>{
  const tag=name=>pgn.match(new RegExp('^\\['+name+' "([^"\\n]*)"\\]','m'))?.[1]||'';
  const whiteId=tag('WhiteFideId'),blackId=tag('BlackFideId');
  return ids.has(whiteId)||ids.has(blackId)
    ||(!whiteId&&names.has(fullNameKey(tag('White'))))
    ||(!blackId&&names.has(fullNameKey(tag('Black'))));
 };
 return {eligible,sha256,players:ids.size};
}

async function stageMonth({month,dir,target,url,fetchImpl=fetch,filter}){
 if(!filter||typeof filter.eligible!=='function'||!/^[a-f0-9]{64}$/.test(filter.sha256))throw Error('Spieler snapshot filter required');
 assertTarget(target,url);const archive=await officialArchive(month,dir,fetchImpl),out=path.join(dir,month+'.jsonl');
 const reportFile=path.join(dir,month+'.report.json');
 if(fs.existsSync(reportFile)&&fs.existsSync(out)){const prior=JSON.parse(await fsp.readFile(reportFile,'utf8'));if(prior.parser_version===FILTER_FORMAT&&prior.filter_sha256===filter.sha256&&prior.sha256===archive.sha256&&prior.staged_sha256){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(out))hash.update(chunk);if(hash.digest('hex')===prior.staged_sha256)return prior;}}
 const partial=out+'.partial',hash=createHash('sha256'),output=fs.createWriteStream(partial);
 // Node's experimental Zstd stream can reject valid official Lichess frames.
 // Use the system Zstandard decoder; do not shell-execute the archive path.
 const decoder=spawn('zstd',['--decompress','--stdout','--',archive.file],{stdio:['ignore','pipe','ignore']});
 const completed=new Promise((resolve,reject)=>{
  decoder.once('error',reject);
  decoder.once('close',(code,signal)=>code===0?resolve():reject(Error('Zstandard archive decode failed')));
 });
 const stream=decoder.stdout;let seen=0,accepted=0,rejected=0,excluded=0;
 try{for await(const pgn of streamGames(stream)){seen++;if(!filter.eligible(pgn)){excluded++;continue;}try{const row=broadcastRow(pgn,month),line=JSON.stringify(row)+'\n';hash.update(line);if(!output.write(line))await new Promise(r=>output.once('drain',r));accepted++;}catch{rejected++;}
  if(seen%10000===0)console.log(JSON.stringify({month,seen,accepted,rejected}));}
  await completed;
 }catch(e){
  decoder.kill();await completed.catch(()=>{});
  await fsp.rm(partial,{force:true});throw e;
 }finally{await new Promise((r,j)=>{output.once('error',j);output.end(r);});}
 await fsp.rename(partial,out);
 const report={parser_version:FILTER_FORMAT,filter_sha256:filter.sha256,excluded,month,source_url:archive.url,sha256:archive.sha256,staged_sha256:hash.digest('hex'),license_url:LICENSE,seen,accepted,rejected,staged_file:out};await fsp.writeFile(reportFile+'.partial',JSON.stringify(report,null,2));await fsp.rename(reportFile+'.partial',reportFile);return report;
}
async function applyRows({file,target,url,client}){assertTarget(target,url);if(!client)throw Error('Import client required');let batch=[],written=0;
 for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){if(!line.trim())continue;const row=JSON.parse(line);if(typeof row.pgn!=='string'||row.pgn.startsWith('[')||row.pgn.includes('{')||row.pgn.includes('}'))throw Error('SAN-only staging required');batch.push(row);if(batch.length===500){const r=await client.from('spieler_broadcast_games').upsert(batch,{onConflict:'id',ignoreDuplicates:true});if(r.error)throw Error('QA import write failed');written+=batch.length;batch=[];}}
 if(batch.length){const r=await client.from('spieler_broadcast_games').upsert(batch,{onConflict:'id',ignoreDuplicates:true});if(r.error)throw Error('QA import write failed');written+=batch.length;}return written;
}
async function main(){const args={};for(const s of process.argv.slice(2)){const m=s.match(/^--(target|end|months|dir|fide-list)=(.+)$/);if(m)args[m[1]]=m[2];else if(s==='--apply')args.apply=true;else throw Error('Invalid arguments');}
 const url=process.env.SUPABASE_URL||'';assertTarget(args.target,url);const filter=loadGermanFideList(args['fide-list']);sourceUrl(args.end);const n=Number(args.months||6);if(!Number.isInteger(n)||n<1||n>6)throw Error('One to six months required');
 if(args.apply&&!process.env.SUPABASE_SERVICE_KEY)throw Error('Server credential required');
 const client=args.apply?require('@supabase/supabase-js').createClient(url,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
 const [year,month]=args.end.split('-').map(Number),reports=[];
 for(let i=n-1;i>=0;i--){const d=new Date(Date.UTC(year,month-1-i,1)),m=d.toISOString().slice(0,7);const report=await stageMonth({month:m,dir:args.dir,target:args.target,url,filter});if(client)report.submitted=await applyRows({file:report.staged_file,target:args.target,url,client});reports.push(report);console.log(JSON.stringify(report));}
 await fsp.writeFile(path.join(args.dir,'manifest.json'),JSON.stringify(reports,null,2));
}
if(require.main===module)main().catch(e=>{console.error('Official broadcast import failed: '+e.message);process.exitCode=1;});
module.exports={sourceUrl,stripComments,broadcastRow,streamGames,officialArchive,stageMonth,applyRows,loadGermanFideList,LICENSE};
