'use strict';
const express=require('express');
const {LANGUAGE_CODES,prepareOpening,parseOpening,generateBriefing}=require('./aiCoachCore');
const {validChatQuery,groundedChat}=require('./aiCoachChat');
const {AUDIO_TYPES,transcribeAudio,speakAnswer}=require('./aiCoachOpenAI');
function installAiCoach(app,{enabled=false,index=null,verifyToken=async()=>null,apiKey=null,model,openaiApiKey=null,openaiModel='gpt-6-sol',fetchImpl=fetch,socketFactory,now=Date.now}={}){
 const router=express(),budgets=new Map(),active=new Map();
 function limited(id,max){
  const time=now();if(budgets.size>2000)for(const [k,v]of budgets)if(time-v.start>60000)budgets.delete(k);
  let item=budgets.get(id);if(!item||time-item.start>=60000){if(!item&&budgets.size>2000)return true;item={start:time,count:0};budgets.set(id,item);}
  return ++item.count>max;
 }
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!enabled)return res.status(404).json({code:'feature_disabled'});next();});
 router.post('/preparation',express.json({limit:'2kb'}),async(req,res)=>{
  if(limited('ip:'+req.ip,60))return res.status(429).json({code:'rate_limit'});
  const auth=req.get('authorization')||'';let user=null;
  if(/^Bearer [^\s]+$/.test(auth)&&auth.length<=8192)try{user=await verifyToken(auth.slice(7));}catch{}
  if(!user?.id)return res.status(401).json({code:'authentication_required'});
  if(limited('user:'+user.id,6))return res.status(429).json({code:'rate_limit'});
  const value=req.body;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['moves','color','language'].includes(k))||
     !parseOpening(value.moves)||!['white','black'].includes(value.color)||!LANGUAGE_CODES.has(value.language))
   return res.status(400).json({code:'invalid_query'});
  try{
   const lesson=await prepareOpening(index,{moves:value.moves,color:value.color});
   const briefing=await generateBriefing(lesson,value.language,{apiKey,model,fetchImpl});
   res.json({...lesson,briefing,generated:!!briefing});
  }catch(e){const warming=e.code==='index_warming';if(e.code==='invalid_query')return res.status(400).json({code:'invalid_query'});if(warming)res.set('Retry-After','5');
   res.status(503).json({code:warming?'index_warming':'index_unavailable'});
  }
 });
 async function authorizeChat(req,res,next){
  if(limited('chat-ip:'+req.ip,60))return res.status(429).json({code:'rate_limit'});
  const auth=req.get('authorization')||'';let user=null;
  if(/^Bearer [^\s]+$/.test(auth)&&auth.length<=8192)try{user=await verifyToken(auth.slice(7));}catch{}
  if(!user?.id)return res.status(401).json({code:'authentication_required'});
  if(limited('coach-total:'+user.id,18)||limited(req.path+':'+user.id,6))return res.status(429).json({code:'rate_limit'});
  if(active.has(user.id)||active.size>=32)return res.status(429).json({code:'rate_limit'});
  req.coachUser=user.id;next();
 }
 function operation(req,res){
  if(active.has(req.coachUser)||active.size>=32){res.status(429).json({code:'rate_limit'});return null;}
  const abort=new AbortController();active.set(req.coachUser,abort);
  const release=()=>{if(active.get(req.coachUser)===abort)active.delete(req.coachUser);};
  const close=()=>{abort.abort();release();};res.once('close',close);
  return {signal:abort.signal,done:()=>{res.off('close',close);release();}};
 }
 function failed(res,e){
  const code=['index_warming','index_unavailable','provider_not_configured','invalid_audio','empty_audio','transcript_too_long','speech_timeout','speech_incomplete','speech_too_long'].includes(e.code)?e.code:'provider_unavailable';
  if(code==='index_warming')res.set('Retry-After','5');
  if(!res.destroyed)res.status(['invalid_audio','empty_audio','transcript_too_long'].includes(code)?400:503).json({code});
 }
 router.post('/chat',authorizeChat,express.json({limit:'24kb'}),async(req,res)=>{
  if(!validChatQuery(req.body))return res.status(400).json({code:'invalid_query'});
  const op=operation(req,res);if(!op)return;
  try{res.json(await groundedChat(index,req.body,{openaiApiKey,openaiModel,fetchImpl,signal:op.signal}));}
  catch(e){failed(res,e);}finally{op.done();}
 });
 router.post('/transcribe',authorizeChat,express.raw({type:[...AUDIO_TYPES.keys()],limit:'2mb'}),async(req,res)=>{
  const language=req.query.language==='ua'?'uk':req.query.language;
  if(!LANGUAGE_CODES.has(language)||Object.keys(req.query).some(k=>k!=='language'))return res.status(400).json({code:'invalid_query'});
  const op=operation(req,res);if(!op)return;
  try{res.json({text:await transcribeAudio(req.body,(req.get('content-type')||'').split(';')[0].trim().toLowerCase(),language,{apiKey:openaiApiKey,fetchImpl,signal:op.signal})});}
  catch(e){failed(res,e);}finally{op.done();}
 });
 router.post('/speech',authorizeChat,express.json({limit:'8kb'}),async(req,res)=>{
  const value=req.body;
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['text','language'].includes(k))||typeof value.text!=='string'||value.text.trim().length<2||value.text.length>1200||!LANGUAGE_CODES.has(value.language))return res.status(400).json({code:'invalid_query'});
  const op=operation(req,res);if(!op)return;
  const streaming=req.get('accept')?.includes('application/x-ndjson');
  try{
   const audio=await speakAnswer(value.text,value.language==='ua'?'uk':value.language,{apiKey:openaiApiKey,signal:op.signal,socketFactory,
    ...(streaming?{onAudio:chunk=>{
     if(res.destroyed||res.writableLength>512*1024)throw Object.assign(Error('speech_backpressure'),{code:'provider_unavailable'});
     if(!res.headersSent){res.type('application/x-ndjson');res.set('Cache-Control','no-store, no-transform');res.set('X-Content-Type-Options','nosniff');}
     res.write(JSON.stringify({type:'audio',delta:chunk.toString('base64')})+'\n');
    }}:{})});
   if(streaming)res.end(JSON.stringify({type:'done',bytes:audio.bytes,sampleRate:audio.sampleRate})+'\n');else res.type('audio/wav').send(audio);
  }catch(e){
   const code=['speech_timeout','speech_incomplete','speech_too_long','provider_not_configured'].includes(e.code)?e.code:'provider_unavailable';
   if(!res.destroyed&&e.code!=='speech_cancelled'){
    console.warn(JSON.stringify({event:'coach_speech_failed',reason:code}));
    if(res.headersSent)res.end(JSON.stringify({type:'error',code})+'\n');else failed(res,e);
   }
  }finally{op.done();}
 });
 router.use((error,req,res,next)=>{
  if(error.type==='entity.too.large')return res.status(413).json({code:'payload_too_large'});
  if(error.type==='entity.parse.failed')return res.status(400).json({code:'invalid_query'});
  next(error);
 });
 app.use('/api/ai-coach',router);
 return router;
}
function installAiCoachFromEnv(app,verifyToken,index,env=process.env){
 return installAiCoach(app,{enabled:env.AI_COACH_ENABLED==='true',verifyToken,index,
  apiKey:env.GEMINI_API_KEY||null,model:env.GEMINI_MODEL||'gemini-2.5-flash',
  openaiApiKey:env.OPENAI_API_KEY||null,openaiModel:env.OPENAI_COACH_MODEL||'gpt-6-sol'});
}
module.exports={installAiCoach,installAiCoachFromEnv};
