'use strict';
const express=require('express');
const {createClient}=require('@supabase/supabase-js');
const {PositionIndex,normalizedPositionKey,supabasePositionSource}=require('./positionIndex');

function installPositions(app,{enabled=false,verifyToken=async()=>null,index=null,now=Date.now}={}){
 const router=express(),budgets=new Map();router.set('trust proxy',1);
 const limited=(key,max)=>{const at=now();if(budgets.size>=2000)for(const[k,v]of budgets)if(at-v.at>=60000)budgets.delete(k);let value=budgets.get(key);if(!value||at-value.at>=60000){if(!value&&budgets.size>=2000)return true;value={at,n:0};budgets.set(key,value);}return ++value.n>max;};
 router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!enabled)return res.status(404).json({code:'feature_disabled'});
  if(limited('ip:'+req.ip,120))return res.status(429).json({code:'rate_limit'});
  const header=req.headers.authorization||'';let user;
  if(/^Bearer [^\s]+$/.test(header)&&header.length<=8192)try{user=await verifyToken(header.slice(7));}catch{}
  if(!user?.id)return res.status(401).json({code:'authentication_required'});
  if(limited('user:'+user.id,12))return res.status(429).json({code:'rate_limit'});
  next();
 });
 router.get('/search',async(req,res)=>{
  const {fen,side='any',fideId,limit='10',scope='all',sort='newest'}=req.query;
  if(Object.keys(req.query).some(k=>!['fen','side','fideId','limit','scope','sort'].includes(k))||!['all','nrw'].includes(scope)||!['newest','strongest'].includes(sort)||typeof fen!=='string'||fen.length>200||!['white','black','any'].includes(side)||(fideId!==undefined&&(typeof fideId!=='string'||!/^[1-9]\d{0,9}$/.test(fideId)))||typeof limit!=='string'||!/^\d{1,3}$/.test(limit)||Number(limit)<1)return res.status(400).json({code:'invalid_query'});
  try{normalizedPositionKey(fen);}catch{return res.status(400).json({code:'invalid_fen'});}
  if(!index)return res.status(503).json({code:'index_unavailable'});
  if(index.status==='warming')return res.set('Retry-After','5').status(503).json({code:'index_warming'});
  try{res.json(await index.search({fen,side,scope,sort,fideId:fideId||null,limit:Math.min(50,Number(limit))}));}
  catch(error){if(error.code==='index_warming')res.set('Retry-After','5');res.status(503).json({code:error.code==='index_warming'?'index_warming':'index_unavailable'});}
 });
 app.use('/api/positions',router);return router;
}
function installPositionsFromEnv(app,verifyToken,env=process.env){
 const enabled=env.POSITION_SEARCH_ENABLED==='true';let index=null;
 if(enabled&&env.SUPABASE_URL&&env.SUPABASE_SERVICE_KEY){
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  index=new PositionIndex(supabasePositionSource(client));void index.start();
 }
 installPositions(app,{enabled,verifyToken,index});return index;
}
module.exports={installPositions,installPositionsFromEnv};
