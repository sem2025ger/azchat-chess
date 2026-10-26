'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const {isolatedPostgres}=require('./test-support/durablePostgres.cjs');
test('Spieler real PostgreSQL: search, private requests, claim verification, opt-out and immutable ACL',{skip:!process.env.DURABLE_TEST_DATABASE_URL,timeout:30000},async()=>{
 const db=await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 async function as(role,user,sql,args=[]){const c=await db.pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user||'']);const r=await c.query(sql,args);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const request=(actor,action)=>as('service_role',null,'select public.spieler_request($1,$2,13404431) as value',[action,actor]);
 const search=()=>as('service_role',null,"select public.spieler_search('Huseynov') as value");
 try{
  await db.pool.query("CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO authenticated;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT SELECT ON public.profiles TO service_role;");
  await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations/20261026184317_spieler_v1.sql'),'utf8'));
  await db.pool.query("INSERT INTO public.spieler_players(fide_id,name,surname,federation,title,fide_rating,club,source_date,source_url) VALUES(13404431,'Huseynov, Sabir','Huseynov','AZE','FM',2379,'Bochumer SV 02','2026-10-25','https://ratings.fide.com/profile/13404431')");
  const p=(await search()).rows[0].value[0];assert.equal(p.name,'Huseynov, Sabir');assert.equal(p.title,'FM');assert.equal(p.fide_rating,2379);assert.equal(p.club,'Bochumer SV 02');
  for(const role of ['anon','authenticated']){
   await assert.rejects(as(role,a,'select * from public.spieler_players'),e=>e.code==='42501');
   await assert.rejects(as(role,a,"select public.spieler_search('Huseynov')"),e=>e.code==='42501');
   await assert.rejects(as(role,a,"select public.spieler_request('claim',$1,13404431)",[a]),e=>e.code==='42501');
   await assert.rejects(as(role,a,"insert into public.spieler_claims(user_id,fide_id,status) values($1,13404431,'verified')",[a]),e=>e.code==='42501');
   await assert.rejects(as(role,a,"insert into public.spieler_opt_out(user_id,fide_id,status) values($1,13404431,'approved')",[a]),e=>e.code==='42501');
  }
  assert.equal((await request(a,'claim')).rows[0].value.status,'pending');
  assert.equal((await request(a,'hide')).rows[0].value.status,'pending');assert.equal((await search()).rows[0].value.length,1,'unverified claim cannot hide a player');
  assert.equal((await as('authenticated',a,'select count(*)::int as n from public.spieler_opt_out')).rows[0].n,1);
  assert.equal((await as('authenticated',b,'select count(*)::int as n from public.spieler_opt_out')).rows[0].n,0);
  assert.equal((await as('authenticated',b,'select count(*)::int as n from public.spieler_claims')).rows[0].n,0);
  await assert.rejects(as('authenticated',a,"update public.spieler_claims set status='verified'"),e=>e.code==='42501');
  await db.pool.query("update public.spieler_claims set status='verified' where user_id=$1",[a]);
  assert.equal((await request(a,'hide')).rows[0].value.status,'approved');assert.equal((await search()).rows[0].value.length,0);
  assert.deepEqual((await as('service_role',null,'select public.spieler_search(null,13404431) as value')).rows[0].value,[],'direct ID also respects opt-out');
  assert.deepEqual((await as('service_role',null,"select public.spieler_search('%') as value")).rows[0].value,[],'wildcards cannot enumerate the catalog');
  const rls=await db.pool.query("select count(*)::int as n from pg_class where relname in ('spieler_players','spieler_claims','spieler_opt_out','spieler_twic_games') and relrowsecurity");assert.equal(rls.rows[0].n,4);
 }finally{await db.close();}
});
