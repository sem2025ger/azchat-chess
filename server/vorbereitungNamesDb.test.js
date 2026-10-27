'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{join}=require('node:path');
const {isolatedPostgres}=require('./test-support/durablePostgres.cjs');const {broadcastRow}=require('./scripts/importBroadcast');
const pgn='[Event "Fixture"]\n[White "Huseynov, Sabir"]\n[Black "Guest, Player"]\n[WhiteFideId "13404431"]\n[Date "2026.09.12"]\n[Result "1-0"]\n\n1. e4 c5 2. Nf3 d6 1-0';
test('named preparation real PostgreSQL: FIDE priority, exact fallback, source union, suppression and server-only ACL', {skip:!process.env.CI&&!process.env.DURABLE_TEST_DATABASE_URL,timeout:30000},async()=>{
 const db=await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL),actor='11111111-1111-4111-8111-111111111111';
 async function as(role,sql,args=[]){const c=await db.pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);const r=await c.query(sql,args);await c.query('COMMIT');return r.rows[0]?.value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const query=(fide,name)=>as('service_role','SELECT public.preparation_games($1,$2,0,500) AS value',[fide,name]);
 try{
  await db.pool.query("CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO authenticated;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT SELECT ON public.profiles TO service_role;");
  for(const file of ['20261026184317_spieler_v1.sql','20261026201936_spieler_review_privacy.sql','20261026210344_spieler_hide_abuse_limits.sql','20261027024137_vorbereitung_names_v1.sql'])await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations',file),'utf8'));
  await db.pool.query("INSERT INTO public.spieler_players(fide_id,name,surname,federation,source_date,source_url) VALUES(13404431,'Huseynov, Sabir','Huseynov','AZE','2026-09-01','https://ratings.fide.com/profile/13404431')");
  async function insert(pgnText,id,override={}){const row={...broadcastRow(pgnText,'2026-09'),id:id.repeat(64),...override};const columns=Object.keys(row);await db.pool.query('INSERT INTO public.spieler_broadcast_games('+columns.join(',')+') VALUES('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));}
  await insert(pgn,'a');await insert(pgn.replace('[WhiteFideId "13404431"]',''),'b');
  await insert(pgn.replace('13404431','999999'),'c');await insert(pgn.replace('Sabir','Ali').replace('[WhiteFideId "13404431"]',''),'d');
  await insert(pgn.replace('[Black "Guest, Player"]','[Black "Huseynov, Sabir"]\n[BlackFideId "13404431"]').replace('[WhiteFideId "13404431"]',''),'e');
  await db.pool.query("INSERT INTO public.spieler_twic_games(id,pgn,white_fide_id,source) VALUES($1,$2,13404431,'twic1600')",['f'.repeat(64),pgn]);
  const rows=await query(13404431,'Wrong, Name');assert.equal(rows.length,4);assert.equal(rows.find(g=>g.id==='a'.repeat(64)).link_basis,'fide_id');assert.equal(rows.find(g=>g.id==='b'.repeat(64)).link_basis,'name');assert.equal(rows.find(g=>g.id==='e'.repeat(64)).color,'black','exact black FIDE wins over white name fallback');assert.ok(rows.some(g=>g.source==='twic1600'));assert.ok(!rows.some(g=>g.id==='c'.repeat(64)||g.id==='d'.repeat(64)));
  const byName=await query(null,'Huseynov, Sabir');assert.ok(byName.every(g=>g.link_basis==='name'));assert.equal((await query(null,'Huseynov, S.')).length,0);
  assert.ok((await as('service_role',"SELECT public.preparation_candidates('Huseynov, Sabir') AS value")).some(p=>Number(p.fide_id)===13404431));
  for(const role of ['anon','authenticated']){
   await assert.rejects(as(role,'SELECT * FROM public.spieler_broadcast_games'),e=>e.code==='42501');
   await assert.rejects(as(role,'SELECT public.preparation_games(13404431,NULL,0,500)'),e=>e.code==='42501');
   await assert.rejects(as(role,"SELECT public.preparation_candidates('Huseynov, Sabir')"),e=>e.code==='42501');
  }
  await db.pool.query("INSERT INTO public.spieler_opt_out(user_id,fide_id,status) VALUES($1,13404431,'hidden_pending_review')",[actor]);assert.deepEqual(await query(13404431,null),[]);assert.deepEqual(await query(null,'Huseynov, Sabir'),[]);
 }finally{await db.close();}
});
