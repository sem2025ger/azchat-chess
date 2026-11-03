'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),express=require('express');
const {speakAnswer,MAX_SPEECH_BYTES}=require('./aiCoachOpenAI');
const {installAiCoach}=require('./aiCoach');
function provider({bytes=3*1024*1024,hold=false,status='completed'}={}){
 let release,terminated=false;
 return {get release(){return release;},get terminated(){return terminated;},socketFactory:()=>{
  const socket=new EventEmitter();socket.terminate=()=>{terminated=true;};
  socket.send=raw=>{const event=JSON.parse(raw);queueMicrotask(()=>{
   if(terminated)return;if(event.type==='session.update')socket.emit('message',Buffer.from('{"type":"session.updated"}'));
   else{let sent=0;const send=()=>{if(terminated)return;const chunk=Buffer.alloc(Math.min(4800,bytes-sent));sent+=chunk.length;socket.emit('message',Buffer.from(JSON.stringify({type:'response.output_audio.delta',delta:chunk.toString('base64')})));if(sent<bytes)setImmediate(send);else socket.emit('message',Buffer.from(JSON.stringify({type:'response.done',response:{status}})));};
    if(hold){socket.emit('message',Buffer.from(JSON.stringify({type:'response.output_audio.delta',delta:Buffer.alloc(4800).toString('base64')})));release=()=>{bytes-=4800;send();};}else send();}
  });};queueMicrotask(()=>socket.emit('open'));return socket;
 }};
}
test('long speech exceeds the former 2 MiB cap without truncation and still has a hard bound',async()=>{
 const p=provider(),audio=await speakAnswer('Длинный ответ с шахматной нотацией.','ru',{apiKey:'synthetic',socketFactory:p.socketFactory});assert.equal(audio.length,3*1024*1024+44);assert.equal(p.terminated,true);
 const large=provider({bytes:MAX_SPEECH_BYTES+4800});await assert.rejects(speakAnswer('Hello','en',{apiKey:'synthetic',socketFactory:large.socketFactory}),{code:'speech_too_long'});assert.equal(large.terminated,true);
});
test('stream callback delivers PCM before completion and avoids returning a buffered WAV',async()=>{
 const p=provider({hold:true,bytes:9600}),chunks=[];let complete=false;
 const task=speakAnswer('Nf3','en',{apiKey:'synthetic',socketFactory:p.socketFactory,onAudio:b=>chunks.push(b)}).then(result=>{complete=true;return result;});
 for(let i=0;i<50&&!p.release;i++)await new Promise(r=>setTimeout(r,2));assert.equal(chunks.length,1);assert.equal(complete,false);p.release();assert.deepEqual(await task,{bytes:9600,sampleRate:24000});assert.equal(Buffer.concat(chunks).length,9600);
});
test('HTTP stream is authenticated, progressive, terminates explicitly and aborts its socket on disconnect',async()=>{
 const p=provider({hold:true,bytes:9600}),app=express();installAiCoach(app,{enabled:true,verifyToken:async t=>t==='fixture'?{id:'one'}:null,openaiApiKey:'synthetic',socketFactory:p.socketFactory});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/api/ai-coach/speech';
 const post=(token,signal)=>fetch(url,{method:'POST',signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({text:'Nxe5+','language':'ru'})});
 try{
  assert.equal((await post('wrong')).status,401);const abort=new AbortController(),response=await post('fixture',abort.signal);assert.ok(response.headers.get('content-type').startsWith('application/x-ndjson'));const reader=response.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.equal(JSON.parse(first.trim()).type,'audio');abort.abort();await reader.cancel().catch(()=>{});
  for(let i=0;i<100&&!p.terminated;i++)await new Promise(r=>setTimeout(r,2));assert.equal(p.terminated,true);
 }finally{await new Promise(r=>server.close(r));}
});
test('incomplete provider speech is reported distinctly without exposing upstream error details',async()=>{
 const p=provider({status:'incomplete',bytes:4800});await assert.rejects(speakAnswer('Hello','en',{apiKey:'synthetic',socketFactory:p.socketFactory}),{code:'speech_incomplete'});assert.equal(p.terminated,true);
});
test('speech has an idle deadline and a separate total deadline even while events keep arriving',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const p=provider({hold:true,bytes:9600});const idle=assert.rejects(speakAnswer('Hello','en',{apiKey:'synthetic',socketFactory:p.socketFactory}),{code:'speech_timeout'});
 for(let i=0;i<8;i++)await Promise.resolve();t.mock.timers.tick(20001);await idle;assert.equal(p.terminated,true);
 let socket,terminated=false;
 const total=assert.rejects(speakAnswer('Hello','en',{apiKey:'synthetic',socketFactory:()=>{socket=new EventEmitter();socket.send=()=>{};socket.terminate=()=>{terminated=true;};return socket;}}),{code:'speech_timeout'});
 for(let i=0;i<6;i++){t.mock.timers.tick(15000);socket.emit('message',Buffer.from('{"type":"heartbeat"}'));}
 await total;assert.equal(terminated,true);
});
test('HTTP streams end with verified metadata or a redacted error after their audio frames',async()=>{
 for(const status of ['completed','incomplete']){
  const p=provider({status,bytes:9600}),app=express();installAiCoach(app,{enabled:true,verifyToken:async()=>({id:'one'}),openaiApiKey:'synthetic',socketFactory:p.socketFactory});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/ai-coach/speech',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({text:'Nf3',language:'en'})});const frames=(await response.text()).trim().split('\n').map(JSON.parse);assert.equal(frames[0].type,'audio');assert.deepEqual(frames.at(-1),status==='completed'?{type:'done',bytes:9600,sampleRate:24000}:{type:'error',code:'speech_incomplete'});assert.equal(p.terminated,true);assert.equal(response.headers.get('cache-control'),'no-store, no-transform');}
  finally{await new Promise(r=>server.close(r));}
 }
});
