'use strict';
// Server-side Stockfish 19 (lite, single-threaded WASM) for AI Coach evidence.
// The engine runs in a separate child process: a crash, hang or memory spike cannot
// block the Express/Socket.IO event loop, and a stuck search is ended by killing it.
const {spawn}=require('node:child_process');
const {createHash}=require('node:crypto');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const {Chess,validateFen}=require('chess.js');

const ENGINE_NAME='stockfish-19-lite';
const ENGINE_FILE='stockfish/bin/stockfish-19-lite-single.js';
// Pinned to the stockfish@19.0.1 npm package (same artefacts as tmp/scripts/prepareStockfish19.mjs).
const PINNED_SHA256={
 'stockfish-19-lite-single.js':'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a',
 'stockfish-19-lite-single.wasm':'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de'
};
const MAX_SAN_PLIES=10;
const engineError=(code)=>Object.assign(Error(code),{code});

function toWhite(value,turn){return turn==='w'?value:-value;}
// UCI reports score and WDL from the side to move. Normalize once to White.
function parseInfo(line,turn){
 if(!line.startsWith('info ')||!/ pv /.test(line)||!/ score /.test(line))return null;
 const num=(name)=>{const m=line.match(new RegExp(' '+name+' (-?\\d+)'));return m?Number(m[1]):null;};
 const score=line.match(/ score (cp|mate) (-?\d+)/);if(!score)return null;
 const wdl=line.match(/ wdl (\d+) (\d+) (\d+)/);
 const bound=/ score (?:cp|mate) -?\d+ (lowerbound|upperbound)/.exec(line)?.[1]||null;
 const [w,d,l]=wdl?wdl.slice(1).map(Number):[null,null,null];
 return {multipv:num('multipv')||1,depth:num('depth'),seldepth:num('seldepth'),nodes:num('nodes'),timeMs:num('time'),
  scoreKind:score[1],scoreWhite:toWhite(Number(score[2]),turn),bound,
  wdlWhite:wdl?(turn==='w'?[w,d,l]:[l,d,w]):null,uciPv:line.split(' pv ')[1].trim().split(/\s+/)};
}
// Replay every ply with chess.js from the exact root. One illegal ply rejects the whole line.
function sanLine(fen,uciPv){
 const board=new Chess(fen),san=[];
 for(const uci of uciPv.slice(0,MAX_SAN_PLIES)){
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))return null;
  try{san.push(board.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})}).san);}catch{return null;}
 }
 return san.length?san:null;
}
async function verifyFiles(enginePath,pinned){
 const dir=path.dirname(enginePath);
 for(const [name,sha] of Object.entries(pinned)){
  const bytes=await readFile(path.join(dir,name));
  if(createHash('sha256').update(bytes).digest('hex')!==sha)throw engineError('engine_unavailable');
 }
}

function createCoachEngine({
 enginePath=(()=>{try{return require.resolve(ENGINE_FILE);}catch{return null;}})(),
 pinned=PINNED_SHA256,movetimeMs=900,multiPv=3,hashMb=16,maxQueue=4,deadlineMs=8000,
 startupMs=10000,cacheSize=500,spawnImpl=spawn,verify=verifyFiles,now=Date.now
}={}){
 const cache=new Map(),pending=new Map(),queue=[];
 let child=null,ready=null,buffer='',listener=null,running=null,active=null,disabled=false,nnue=null,closed=false;
 const budget={movetimeMs,multiPv,hashMb};
 const keyOf=(fen)=>[ENGINE_NAME,movetimeMs,multiPv,hashMb,fen].join('|');

 function send(line){child.stdin.write(line+'\n');}
 function kill(){
  const current=child;child=null;ready=null;buffer='';listener=null;
  if(current){current.stdout?.removeAllListeners('data');try{current.kill('SIGKILL');}catch{}}
 }
 function start(){
  if(disabled||closed)return Promise.reject(engineError('engine_unavailable'));
  if(ready)return ready;
  ready=(async()=>{
   if(!enginePath)throw engineError('engine_unavailable');
   try{await verify(enginePath,pinned);}catch{disabled=true;throw engineError('engine_unavailable');}
   const proc=spawnImpl(process.execPath,[enginePath],{stdio:['pipe','pipe','ignore'],cwd:path.dirname(enginePath)});
   child=proc;
   proc.stdout.setEncoding('utf8');
   proc.stdout.on('data',(chunk)=>{
    buffer+=chunk;let i;
    while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(line&&listener)listener(line);}
    if(buffer.length>65536)buffer='';
   });
   proc.stdin.on('error',()=>{});
   proc.once('exit',()=>{if(child===proc){const job=running;kill();if(job)job.fail(engineError('engine_unavailable'));}});
   proc.once('error',()=>{if(child===proc){const job=running;kill();if(job)job.fail(engineError('engine_unavailable'));}});
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{listener=null;reject(engineError('engine_unavailable'));},startupMs);
    listener=(line)=>{
     const evalFile=line.match(/^option name EvalFile type string default (\S+)/);if(evalFile)nnue=evalFile[1];
     if(line==='uciok'){send('setoption name Hash value '+hashMb);send('setoption name MultiPV value '+multiPv);send('setoption name UCI_ShowWDL value true');send('isready');}
     if(line==='readyok'){clearTimeout(timer);listener=null;resolve();}
    };
    proc.once('exit',()=>{clearTimeout(timer);reject(engineError('engine_unavailable'));});
    send('uci');
   });
  })();
  ready.catch(()=>kill());
  return ready;
 }

 function search(job){
  const fen=job.fen,turn=fen.split(' ')[1],legal=new Chess(fen).moves().length,want=Math.min(multiPv,legal);
  return new Promise((resolve,reject)=>{
   const current={},started=now();let complete=null,finished=false;
   const finish=(fn,value)=>{if(finished)return;finished=true;clearTimeout(timer);listener=null;running=null;fn(value);};
   const timer=setTimeout(()=>{kill();finish(reject,engineError('engine_timeout'));},movetimeMs+2000);
   running={fail:(e)=>finish(reject,e),stop:()=>{kill();finish(reject,engineError('engine_cancelled'));}};
   listener=(line)=>{
    const info=parseInfo(line,turn);
    if(info&&info.multipv<=want){
     current[info.multipv]=info;
     // Keep only a complete, exact set from one depth; never mix depths or bound scores.
     const set=Array.from({length:want},(_,k)=>current[k+1]);
     if(set.every(x=>x&&x.depth===set[0].depth&&!x.bound))complete=set;
     return;
    }
    if(line.startsWith('bestmove')){
     if(!complete)return finish(reject,engineError('engine_unavailable'));
     const lines=complete.flatMap((x)=>{const san=sanLine(fen,x.uciPv);return san?[{...x,uciPv:x.uciPv.slice(0,MAX_SAN_PLIES),sanPv:san}]:[];});
     finish(resolve,{fen,engine:ENGINE_NAME,nnue,budget,elapsedMs:now()-started,lines});
    }
   };
   send('ucinewgame');send('position fen '+fen);send('go movetime '+movetimeMs);
  });
 }

 async function pump(){
  if(active||!queue.length)return;
  const job=queue.shift();
  if(!job.subscribers.size){pending.delete(job.key);return pump();}
  active=job;
  try{
   await start();
   const result=await search(job);
   if(result.lines.length){cache.set(job.key,result);if(cache.size>cacheSize)cache.delete(cache.keys().next().value);}
   job.settle(null,result);
  }catch(e){job.settle(e);}
  finally{pending.delete(job.key);active=null;pump();}
 }

 function analyze(fen,{signal}={}){
  if(typeof fen!=='string'||fen.length>200||!validateFen(fen).ok)return Promise.reject(engineError('invalid_position'));
  try{if(new Chess(fen).moves().length===0)return Promise.reject(engineError('terminal_position'));}catch{return Promise.reject(engineError('invalid_position'));}
  if(disabled||closed)return Promise.reject(engineError('engine_unavailable'));
  if(signal?.aborted)return Promise.reject(engineError('engine_cancelled'));
  const key=keyOf(fen);
  const hit=cache.get(key);
  if(hit){cache.delete(key);cache.set(key,hit);return Promise.resolve({...hit,cached:true});}
  let job=pending.get(key);
  if(!job){
   if(queue.length>=maxQueue)return Promise.reject(engineError('engine_busy'));
   job={key,fen,subscribers:new Set(),settle(error,value){for(const s of [...this.subscribers])s(error,value);this.subscribers.clear();}};
   pending.set(key,job);queue.push(job);
  }
  return new Promise((resolve,reject)=>{
   const deadline=setTimeout(()=>done(engineError('engine_timeout')),deadlineMs);
   const onAbort=()=>done(engineError('engine_cancelled'));
   function done(error,value){
    clearTimeout(deadline);signal?.removeEventListener('abort',onAbort);
    if(!job.subscribers.delete(subscriber))return;
    if(!job.subscribers.size&&active===job&&running)running.stop();
    error?reject(error):resolve(value);
   }
   const subscriber=(error,value)=>done(error,value);
   job.subscribers.add(subscriber);
   signal?.addEventListener('abort',onAbort,{once:true});
   pump();
  });
 }

 function close(){closed=true;for(const job of queue.splice(0))job.settle(engineError('engine_unavailable'));if(running)running.stop();kill();}
 function status(){return {engine:ENGINE_NAME,budget,started:!!child,disabled,queued:queue.length,searching:!!active,cached:cache.size,pid:child?.pid??null};}
 return {analyze,close,status};
}

module.exports={createCoachEngine,parseInfo,sanLine,ENGINE_NAME,PINNED_SHA256};
