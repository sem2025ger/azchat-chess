'use strict';
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { GamesProvider } = require('./spielerGamesProvider');
const FIDE_ID=/^[1-9]\d{0,9}$/;
function installSpieler(app,{enabled=false,client=null,verifyToken=async()=>null,games=null,now=Date.now}={}) {
 const router=express.Router(),budgets=new Map();
 // Deliberately use the transport peer rather than trusting arbitrary forwarding
 // headers. A future proxy policy needs its own approved IP verification.
 router.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!enabled)return res.status(404).json({code:'feature_disabled'});
  const key=req.socket.remoteAddress||'unknown',time=now();
  if(budgets.size>=1000)for(const [id,b]of budgets)if(time-b.start>=60000)budgets.delete(id);
  let b=budgets.get(key);if(!b||time-b.start>=60000){if(!b&&budgets.size>=1000)return res.status(429).json({code:'rate_limit'});b={start:time,count:0};budgets.set(key,b);}
  if(++b.count>60)return res.status(429).json({code:'rate_limit'});
  if(!client)return res.status(503).json({code:'storage_unavailable'});next();
 });
 router.use(express.json({limit:'2kb'}));
 const wrap=handler=>(req,res)=>Promise.resolve(handler(req,res)).catch(()=>{if(!res.headersSent)res.status(503).json({code:'temporarily_unavailable'});});
 const rpc=async(name,args)=>{const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(8000));if(r.error)throw Error('storage_unavailable');return r.data;};
 const player=async id=>{if(!FIDE_ID.test(id))return null;const rows=await rpc('spieler_search',{p_id:id});return rows?.[0]||null;};
 router.get('/search',wrap(async(req,res)=>{
  const q=typeof req.query.q==='string'?req.query.q.trim():'';
  if(q.length<2||q.length>100||/[\x00-\x1f]/.test(q))return res.status(400).json({code:'invalid_query'});
  res.json({players:await rpc('spieler_search',{p_surname:q})});
 }));
 router.get('/:id',wrap(async(req,res)=>{const p=await player(req.params.id);if(!p)return res.status(404).json({code:'not_found'});res.json({player:p});}));
 const provider=games||new GamesProvider({twic:async id=>{
  const r=await client.from('spieler_twic_games').select('pgn,source').or(`white_fide_id.eq.${id},black_fide_id.eq.${id}`).order('id').limit(25).abortSignal(AbortSignal.timeout(8000));
  if(r.error)throw Error('storage_unavailable');return r.data||[];
 }});
 router.get('/:id/games',wrap(async(req,res)=>{
  const p=await player(req.params.id);if(!p)return res.status(404).json({code:'not_found'});
  const source=req.query.source, nickname=req.query.nickname;
  if(!['lichess','chesscom','twic'].includes(source)|| (source!=='twic'&&(typeof nickname!=='string'||! /^[A-Za-z0-9_-]{2,30}$/.test(nickname))))return res.status(400).json({code:'invalid_provider'});
  res.json(await provider.games({source,nickname,fideId:String(p.fide_id)}));
 }));
 router.post('/:id/:action',wrap(async(req,res)=>{
  if(!['claim','hide'].includes(req.params.action)||!FIDE_ID.test(req.params.id))return res.status(400).json({code:'invalid_action'});
  const header=req.headers.authorization||'';if(!/^Bearer [^\s]+$/.test(header)||header.length>8192)return res.status(401).json({code:'authentication_required'});
  const identity=await verifyToken(header.slice(7));
  if(!identity?.id)return res.status(401).json({code:'authentication_required'});
  // Reject caller-supplied actor, verification status and personal data.
  if(req.body&&Object.keys(req.body).length)return res.status(400).json({code:'invalid_body'});
  const r=await client.rpc('spieler_request',{p_action:req.params.action,p_actor:identity.id,p_fide:req.params.id}).abortSignal(AbortSignal.timeout(8000));
  if(r.error)return res.status(r.error.code==='23514'?409:503).json({code:r.error.code==='23514'?'claim_exists':'temporarily_unavailable'});
  res.json(r.data);
 }));
 router.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(400).json({code:'invalid_request'});});
 app.use('/api/spieler',router);return router;
}
function installSpielerFromEnv(app,verifyToken,env=process.env){
 const enabled=env.SPIELER_V1_ENABLED==='true';
 const client=enabled&&env.SUPABASE_URL&&env.SUPABASE_SERVICE_KEY?createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
 return installSpieler(app,{enabled,client,verifyToken});
}
module.exports={installSpieler,installSpielerFromEnv};
