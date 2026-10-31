export const MAX_SPEECH_BYTES=6*1024*1024;
const speechError=(code='provider_unavailable')=>Error(code);

function wave(chunks:Uint8Array[],bytes:number){
 const output=new Uint8Array(44+bytes),view=new DataView(output.buffer);
 const label=(at:number,value:string)=>{for(let i=0;i<value.length;i++)output[at+i]=value.charCodeAt(i);};
 label(0,'RIFF');view.setUint32(4,bytes+36,true);label(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,bytes,true);
 let offset=44;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}
 return new Blob([output],{type:'audio/wav'});
}

// One fetch, bounded PCM frames. Reject truncated streams instead of presenting partial audio as complete.
export async function readCoachSpeech(response:Response,onAudio:(pcm:Uint8Array)=>void){
 const type=response.headers.get('content-type')||'',legacy=type.startsWith('audio/wav');
 if(!legacy&&!type.startsWith('application/x-ndjson')){await response.body?.cancel();throw speechError();}
 const max=MAX_SPEECH_BYTES+(legacy?44:0);
 if(Number(response.headers.get('content-length')||0)>(legacy?max:MAX_SPEECH_BYTES*2)){await response.body?.cancel();throw speechError('speech_too_long');}
 const reader=response.body?.getReader();if(!reader)throw speechError();
 const chunks:Uint8Array[]=[],decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,pending='',done=false,events=0,wireBytes=0;
 const frame=(line:string)=>{
  if(!line.trim())return;if(line.length>262144||++events>4001||done)throw speechError();
  const event=JSON.parse(line);
  if(event.type==='error')throw speechError(['speech_timeout','speech_incomplete','speech_too_long','provider_not_configured'].includes(event.code)?event.code:'provider_unavailable');
  if(event.type==='done'){if(event.bytes!==bytes||event.sampleRate!==24000||!bytes||bytes%2)throw speechError();done=true;return;}
  if(event.type!=='audio'||typeof event.delta!=='string'||!event.delta||!/^[A-Za-z0-9+/]*={0,2}$/.test(event.delta))throw speechError();
  const binary=atob(event.delta),pcm=Uint8Array.from(binary,c=>c.charCodeAt(0));bytes+=pcm.length;
  if(bytes>MAX_SPEECH_BYTES)throw speechError('speech_too_long');if(!pcm.length||pcm.length%2)throw speechError();
  chunks.push(pcm);onAudio(pcm);
 };
 try{
  while(true){const part=await reader.read();if(part.done)break;wireBytes+=part.value.length;if(wireBytes>(legacy?max:MAX_SPEECH_BYTES*2))throw speechError('speech_too_long');
   if(legacy){bytes+=part.value.length;if(bytes>max)throw speechError('speech_too_long');chunks.push(part.value);continue;}
   pending+=decoder.decode(part.value,{stream:true});const lines=pending.split('\n');pending=lines.pop()!;for(const line of lines)frame(line);if(pending.length>262144)throw speechError();
  }
  if(legacy){if(bytes<=44)throw speechError();return new Blob(chunks as BlobPart[],{type:'audio/wav'});}
  pending+=decoder.decode();if(pending.trim())frame(pending);if(!done)throw speechError('speech_incomplete');return wave(chunks,bytes);
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}

// Schedule 24 kHz buffers on the audio clock, with a short jitter cushion.
// If browser autoplay policy blocks Web Audio, retain the complete WAV for native controls.
export function createCoachPlayback(onStart:()=>void){
 if(typeof AudioContext==='undefined')return null;
 let context:AudioContext;try{context=new AudioContext();void context.resume().catch(()=>{});}catch{return null;}
 const sources=new Set<AudioBufferSourceNode>();let next=0,sealed=false,started=false,disabled=false;
 let resolve!: (played:boolean)=>void;const completed=new Promise<boolean>(r=>resolve=r);
 const close=()=>{if(context.state!=='closed')void context.close().catch(()=>{});};
 const stop=()=>{disabled=true;for(const source of sources){source.onended=null;source.stop();source.disconnect();}sources.clear();close();resolve(false);};
 return {
  push(pcm:Uint8Array){
   if(disabled)return;
   if(context.state!=='running'){stop();return;}
   const buffer=context.createBuffer(1,pcm.length/2,24000),channel=buffer.getChannelData(0),view=new DataView(pcm.buffer,pcm.byteOffset,pcm.byteLength);
   for(let i=0;i<channel.length;i++)channel[i]=view.getInt16(i*2,true)/32768;
   const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);sources.add(source);
   source.onended=()=>{source.disconnect();sources.delete(source);if(sealed&&!sources.size){close();resolve(started);}};
   next=Math.max(context.currentTime+.08,next);source.start(next);next+=buffer.duration;
   if(!started){started=true;onStart();}
  },
  finish(){sealed=true;if(!sources.size){close();resolve(started);}return completed;},
  stop
 };
}
