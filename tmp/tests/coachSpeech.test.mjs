import test from 'node:test';
import assert from 'node:assert/strict';
import {readCoachSpeech,MAX_SPEECH_BYTES} from '../src/services/coachSpeech.ts';
const frame=pcm=>JSON.stringify({type:'audio',delta:Buffer.from(pcm).toString('base64')})+'\n';
const end=bytes=>JSON.stringify({type:'done',bytes,sampleRate:24000})+'\n';
const response=parts=>new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(new TextEncoder().encode(p));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}});
test('stream parser forwards frames immediately and assembles a complete replayable WAV across split lines',async()=>{
 const pcm=new Uint8Array(4800),line=frame(pcm),seen=[];
 const blob=await readCoachSpeech(response([line.slice(0,7),line.slice(7),line+end(9600)]),b=>seen.push(b));assert.equal(seen.length,2);assert.equal(blob.size,9644);const wave=Buffer.from(await blob.arrayBuffer());assert.equal(wave.toString('ascii',0,4),'RIFF');assert.equal(wave.readUInt32LE(24),24000);assert.equal(wave.readUInt32LE(40),9600);
});
test('speech longer than 44 seconds is accepted within the new finite output budget',async()=>{
 const chunk=new Uint8Array(48000),parts=Array(50).fill(frame(chunk));parts.push(end(2400000));const blob=await readCoachSpeech(response(parts),()=>{});assert.equal(blob.size,2400044);assert.ok(blob.size>2*1024*1024);
});
test('truncated, mismatched, malformed, oversized and error streams fail without a fake ready state',async()=>{
 for(const [parts,code]of [[[frame([0,0])],'speech_incomplete'],[[frame([0,0]),end(8)],'provider_unavailable'],[['broken\n'],'SyntaxError'],[[JSON.stringify({type:'error',code:'speech_timeout'})+'\n'],'speech_timeout'],[[frame([0])],'provider_unavailable'],[[end(0)],'provider_unavailable']]){
  await assert.rejects(readCoachSpeech(response(parts),()=>{}),e=>code==='SyntaxError'?e instanceof SyntaxError:e.message===code);
 }
 await assert.rejects(readCoachSpeech(new Response('',{headers:{'Content-Type':'audio/wav','Content-Length':String(MAX_SPEECH_BYTES+45)}}),()=>{}),/speech_too_long/);
});
