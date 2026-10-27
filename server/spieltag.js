'use strict';
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIDE = /^[1-9]\d{0,9}$/;
function invalid() { throw Object.assign(Error('invalid_input'), { status: 400 }); }
function fields(body, allowed) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !allowed.includes(k))) invalid();
}
function text(value, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) invalid();
  return value.trim();
}
function schedule(body) {
  fields(body, ['round_label','opponent_name','opponent_club_id','starts_at','venue','notes']);
  if (typeof body.starts_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(body.starts_at) || !Number.isFinite(Date.parse(body.starts_at))) invalid();
  if (body.opponent_club_id != null && !UUID.test(body.opponent_club_id)) invalid();
  return { round_label: text(body.round_label,1,80), opponent_name: text(body.opponent_name,2,150),
    opponent_club_id: body.opponent_club_id || null, starts_at: new Date(body.starts_at).toISOString(),
    venue: text(body.venue ?? '',0,250), notes: text(body.notes ?? '',0,1000) };
}
function board(body) {
  fields(body, ['home_name','home_fide_id','opponent_name','opponent_fide_id','result']);
  for (const k of ['home_fide_id','opponent_fide_id']) if (body[k] != null && !FIDE.test(String(body[k]))) invalid();
  if (body.result != null && !['1-0','0-1','1/2-1/2','not_played'].includes(body.result)) invalid();
  return { home_name: text(body.home_name,1,150), home_fide_id: body.home_fide_id ?? null,
    opponent_name: text(body.opponent_name ?? '',0,150), opponent_fide_id: body.opponent_fide_id ?? null, result: body.result ?? null };
}
function userClientFactory(env, factory = createClient) {
  // Never fall back to a service-role client. Every database request carries
  // the same verified user JWT; PostgreSQL RLS is authoritative for reads/writes.
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !key) return null;
  return token => factory(env.SUPABASE_URL, key, { accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function installSpieltag(app, { enabled = false, verifyToken = async () => null, clientForToken = null, now = Date.now } = {}) {
  const router = express(), budgets = new Map();
  router.set('trust proxy',1);
  const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(error => {
    if (!res.headersSent) res.status(error.status || 503).json({ code: error.status === 400 ? 'invalid_input' : 'temporarily_unavailable' });
  });
  function limited(key, maximum) {
    const time = now();
    if (budgets.size >= 2000) for (const [k,v] of budgets) if (time-v.start>=60000) budgets.delete(k);
    let entry = budgets.get(key);
    if (!entry || time-entry.start>=60000) {
      if (!entry && budgets.size>=2000) return true;
      entry={start:time,count:0};budgets.set(key,entry);
    }
    return ++entry.count > maximum;
  }
  router.use((req,res,next) => {
    res.set('Cache-Control','no-store');
    if (!enabled) return res.status(404).json({code:'feature_disabled'});
    if (limited('ip:'+req.ip,120)) return res.status(429).json({code:'rate_limit'});
    next();
  });
  router.use(wrap(async (req,res,next) => {
    const header=req.headers.authorization || '';
    let user;
    if (/^Bearer [^\s]+$/.test(header) && header.length<=8192) { try { user=await verifyToken(header.slice(7)); } catch { /* Fail closed. */ } }
    if (!user?.id) return res.status(401).json({code:'authentication_required'});
    if (limited('user:'+user.id,60)) return res.status(429).json({code:'rate_limit'});
    if (!clientForToken) return res.status(503).json({code:'storage_unavailable'});
    req.spieltagUser=user.id;req.spieltagDb=clientForToken(header.slice(7));next();
  }));
  router.use(express.json({limit:'12kb'}));
  router.param('team', (req,res,next,id) => UUID.test(id) ? next() : res.status(400).json({code:'invalid_input'}));
  router.param('match', (req,res,next,id) => UUID.test(id) ? next() : res.status(400).json({code:'invalid_input'}));
  router.param('board', (req,res,next,id) => /^(?:[1-9]|[12]\d|3[0-2])$/.test(id) ? next() : res.status(400).json({code:'invalid_input'}));
  async function run(query,res) {
    const result=await query.abortSignal(AbortSignal.timeout(8000));
    if (result.error) {
      const code=result.error.code;
      res.status(code==='42501'?403:code==='23505'?409:['23503','23514','22007','22008','22P02'].includes(code)?400:503)
        .json({code:code==='42501'?'not_allowed':code==='23505'?'already_exists':['23503','23514','22007','22008','22P02'].includes(code)?'invalid_input':'temporarily_unavailable'});
      return null;
    }
    return result.data || [];
  }
  router.get('/teams',wrap(async(req,res) => {
    const teams=await run(req.spieltagDb.from('spieltag_teams').select('id,club_id,name').order('name').limit(100),res);if (!teams) return;
    const memberships=await run(req.spieltagDb.from('spieltag_team_members').select('team_id,role').eq('user_id',req.spieltagUser).limit(100),res);if (!memberships) return;
    res.json({teams:teams.map(team=>({...team,role:memberships.find(m=>m.team_id===team.id)?.role || 'member'}))});
  }));
  router.get('/clubs',wrap(async(req,res) => {
    const clubs=await run(req.spieltagDb.from('clubs_nrw').select('id,name,slug').eq('published',true).order('name').limit(250),res);
    if (clubs) res.json({clubs});
  }));
  router.get('/teams/:team/matches',wrap(async(req,res) => {
    const matches=await run(req.spieltagDb.from('spieltag_matches').select('*').eq('team_id',req.params.team).order('starts_at').limit(100),res);
    if (matches) res.json({matches});
  }));
  router.get('/matches/:match/boards',wrap(async(req,res) => {
    const boards=await run(req.spieltagDb.from('spieltag_boards').select('*').eq('match_id',req.params.match).order('board_number').limit(32),res);
    if (boards) res.json({boards});
  }));
  router.post('/teams/:team/matches',wrap(async(req,res) => {
    const input=schedule(req.body);
    const matches=await run(req.spieltagDb.from('spieltag_matches').insert({...input,team_id:req.params.team,created_by:req.spieltagUser,updated_by:req.spieltagUser}).select('*'),res);
    if (matches) res.status(201).json({matches});
  }));
  router.patch('/matches/:match',wrap(async(req,res) => {
    const matches=await run(req.spieltagDb.from('spieltag_matches').update({...schedule(req.body),updated_by:req.spieltagUser}).eq('id',req.params.match).select('*'),res);
    if (matches) res.status(matches.length?200:404).json(matches.length?{matches}:{code:'not_found'});
  }));
  router.delete('/matches/:match',wrap(async(req,res) => {
    const matches=await run(req.spieltagDb.from('spieltag_matches').delete().eq('id',req.params.match).select('id'),res);
    if (matches) res.status(matches.length?200:404).json(matches.length?{deleted:true}:{code:'not_found'});
  }));
  for (const method of ['post','patch']) router[method]('/matches/:match/boards/:board',wrap(async(req,res) => {
    const input=board(req.body),table=req.spieltagDb.from('spieltag_boards');
    const query=method==='post'?table.insert({...input,match_id:req.params.match,board_number:Number(req.params.board)}):table.update(input).eq('match_id',req.params.match).eq('board_number',Number(req.params.board));
    const boards=await run(query.select('*'),res);
    if (boards) res.status(boards.length?(method==='post'?201:200):404).json(boards.length?{boards}:{code:'not_found'});
  }));
  router.delete('/matches/:match/boards/:board',wrap(async(req,res) => {
    const rows=await run(req.spieltagDb.from('spieltag_boards').delete().eq('match_id',req.params.match).eq('board_number',Number(req.params.board)).select('board_number'),res);
    if (rows) res.status(rows.length?200:404).json(rows.length?{deleted:true}:{code:'not_found'});
  }));
  router.use((error,req,res,next) => { if (res.headersSent) return next(error);res.status(400).json({code:'invalid_input'}); });
  app.use('/api/spieltag',router);return router;
}
function installSpieltagFromEnv(app,verifyToken,env=process.env) {
  return installSpieltag(app,{enabled:env.SPIELTAG_ENABLED==='true',verifyToken,clientForToken:userClientFactory(env)});
}
module.exports={installSpieltag,installSpieltagFromEnv,userClientFactory};
