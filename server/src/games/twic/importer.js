'use strict';
const { Unzip, UnzipInflate } = require('fflate');
const { splitPgn, parseGame } = require('./pgn');
const QA_REF='iukmpcytsuofqhxsumbu';
const CAP=50*1024*1024;
function targetGuard(url,ref){
  let host;try{host=new URL(url).hostname;}catch{throw new Error('INVALID_TARGET');}
  const configured=host.endsWith('.supabase.co')?host.split('.')[0]:null;
  if(!ref || configured!==ref || ref!==QA_REF)throw new Error('TARGET_MUST_BE_EXPLICIT_QA');
}
async function boundedDownload(url,fetchImpl=fetch,limit=CAP){
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(30000),redirect:'error',headers:{'User-Agent':'ChessAZ/1.0 (+https://chessaz.de)'}});
  if(!response.ok)throw new Error('TWIC_DOWNLOAD_FAILED');
  if(Number(response.headers.get('content-length'))>limit)throw new Error('TWIC_SIZE_LIMIT');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('TWIC_SIZE_LIMIT');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
function extractPgn(zip){
  const chunks=[];let total=0,files=0,failure;
  const unzip=new Unzip(file=>{
    if(!/\.pgn$/i.test(file.name))return;
    files++;if(files>4){failure=new Error('TWIC_FILE_LIMIT');return;}
    file.ondata=(error,data)=>{if(error){failure=new Error('TWIC_INVALID_ZIP');return;}total+=data.length;if(total>CAP){failure=new Error('TWIC_SIZE_LIMIT');file.terminate();return;}chunks.push(Buffer.from(data));};file.start();
  });
  unzip.register(UnzipInflate);
  // Push small compressed slices so decompression cannot allocate an unbounded output.
  for(let at=0;at<zip.length;at+=1024){unzip.push(zip.subarray(at,at+1024),at+1024>=zip.length);if(failure)throw failure;}
  if(!files || !total)throw new Error('TWIC_NO_PGN');
  return Buffer.concat(chunks).toString('utf8');
}
async function latestIssue(fetchImpl=fetch){
  const html=(await boundedDownload('https://theweekinchess.com/twic',fetchImpl,2*1024*1024)).toString('utf8');
  const issues=[...html.matchAll(/\/zips\/twic(\d+)g\.zip/g)].map(m=>Number(m[1]));
  if(!issues.length)throw new Error('TWIC_LATEST_UNAVAILABLE');return Math.max(...issues);
}
async function importIssue({issue,store,maxMb=300,fetchImpl=fetch,pgn}){
  if(!Number.isInteger(issue)||issue<1||!Number.isFinite(maxMb)||maxMb<=0||maxMb>300)throw new Error('INVALID_IMPORT_OPTIONS');
  const start=await store.call('start',{p_issue:issue,p_max_mb:maxMb});
  if(start.done)return {inserted:0,skipped:0,alreadyDone:true,sizeBefore:start.size_bytes,sizeAfter:start.size_bytes};
  let inserted=0,skipped=0;
  try{
    const text=pgn??extractPgn(await boundedDownload(`https://theweekinchess.com/zips/twic${issue}g.zip`,fetchImpl));
    let batch=[];
    const save=async()=>{
      if(!batch.length)return;
      const estimate=Buffer.byteLength(JSON.stringify(batch))*4+batch.length*24*512;
      const size=await store.call('size');if(Number(size.size_bytes)+estimate>maxMb*1024*1024)throw new Error('DB_SIZE_LIMIT');
      const value=await store.call('batch',{p_issue:issue,p_games:batch,p_max_mb:maxMb});inserted+=value.inserted;skipped+=batch.length-value.inserted;batch=[];
    };
    for(const source of splitPgn(text)){
      try{batch.push(parseGame(source,issue));}catch{skipped++;continue;}
      if(batch.length>=25)await save();
    }
    await save();
    await store.call('done',{p_issue:issue,p_skipped:skipped});
    const after=await store.call('size');return {inserted,skipped,sizeBefore:start.size_bytes,sizeAfter:after.size_bytes};
  }catch(error){
    const code=['DB_SIZE_LIMIT','TWIC_SIZE_LIMIT','TWIC_DOWNLOAD_FAILED','TWIC_INVALID_ZIP','TWIC_NO_PGN','TWIC_FILE_LIMIT'].includes(error.message)?error.message:'TWIC_IMPORT_FAILED';
    await store.call('failed',{p_issue:issue,p_error:code,p_skipped:skipped});throw new Error(code);
  }
}
module.exports={targetGuard,boundedDownload,extractPgn,latestIssue,importIssue,QA_REF};
