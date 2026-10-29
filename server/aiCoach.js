'use strict';
const express=require('express');
const {LANGUAGE_CODES,prepareNajdorf,generateBriefing}=require('./aiCoachCore');
function installAiCoach(app,{enabled=false,index=null,verifyToken=async()=>null,apiKey=null,model,fetchImpl=fetch,now=Date.now}={}){
 const router=express(),budgets=new Map();
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
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['opening','color','language'].includes(k))||
     value.opening!=='najdorf'||value.color!=='black'||!LANGUAGE_CODES.has(value.language))
   return res.status(400).json({code:'invalid_query'});
  try{
   const lesson=await prepareNajdorf(index);
   const briefing=await generateBriefing(lesson,value.language,{apiKey,model,fetchImpl});
   res.json({...lesson,briefing,generated:!!briefing});
  }catch(e){const warming=e.code==='index_warming';if(warming)res.set('Retry-After','5');
   res.status(503).json({code:warming?'index_warming':'index_unavailable'});
  }
 });
 app.use('/api/ai-coach',router);
 return router;
}
function installAiCoachFromEnv(app,verifyToken,index,env=process.env){
 return installAiCoach(app,{enabled:env.AI_COACH_ENABLED==='true',verifyToken,index,
  apiKey:env.GEMINI_API_KEY||null,model:env.GEMINI_MODEL||'gemini-2.5-flash'});
}
module.exports={installAiCoach,installAiCoachFromEnv};
