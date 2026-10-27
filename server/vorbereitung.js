'use strict';
const express=require('express');
const {GamesProvider}=require('./spielerGamesProvider');
const {analysePreparation}=require('../shared/vorbereitung.mjs');
function installVorbereitung(app,{enabled=false,verifyToken=async()=>null,provider=new GamesProvider(),now=Date.now}={}){
 const router=express(),budgets=new Map();router.set('trust proxy',1);
 function limited(key,max){const time=now();if(budgets.size>=2000)for(const [k,v]of budgets)if(time-v.at>=60000)budgets.delete(k);
  let value=budgets.get(key);if(!value||time-value.at>=60000){if(!value&&budgets.size>=2000)return true;value={at:time,n:0};budgets.set(key,value);}return ++value.n>max;}
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store');if(!enabled)return res.status(404).json({code:'feature_disabled'});
  if(limited('ip:'+req.ip,120))return res.status(429).json({code:'rate_limit'});
  const header=req.headers.authorization||'';let user;
  if(/^Bearer [^\s]+$/.test(header)&&header.length<=8192)try{user=await verifyToken(header.slice(7));}catch{}
  if(!user?.id)return res.status(401).json({code:'authentication_required'});
  if(limited('user:'+user.id,12))return res.status(429).json({code:'rate_limit'});
  next();
 });
 router.get('/:username',async(req,res)=>{
  const {color='all',speed='all',timeControl='all',variation=''}=req.query;
  if(!/^[A-Za-z0-9_-]{2,30}$/.test(req.params.username)||Object.keys(req.query).some(k=>!['color','speed','timeControl','variation'].includes(k))||
   !['all','white','black'].includes(color)||!['all','ultraBullet','bullet','blitz','rapid','classical','correspondence'].includes(speed)||
   typeof timeControl!=='string'||timeControl.length>30||typeof variation!=='string'||variation.length>150)return res.status(400).json({code:'invalid_query'});
  try{const data=await provider.preparation(req.params.username);res.json({...data,...analysePreparation(data.games,{color,speed,timeControl,variation})});}
  catch(error){if(error.code==='lichess_rate_limit'){res.set('Retry-After',String(error.retryAfter||60));return res.status(429).json({code:'lichess_rate_limit',retryAfter:error.retryAfter||60});}
   res.status(error.code==='provider_busy'?503:502).json({code:error.code==='provider_busy'?'provider_busy':'provider_unavailable'});}
 });
 app.use('/api/vorbereitung',router);return router;
}
function installVorbereitungFromEnv(app,verifyToken,env=process.env){return installVorbereitung(app,{enabled:env.VORBEREITUNG_ENABLED==='true',verifyToken});}
module.exports={installVorbereitung,installVorbereitungFromEnv};
