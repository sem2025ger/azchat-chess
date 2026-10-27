'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const sample=require('./test-support/spielerFixture.cjs').acceptance();
const {isolatedPostgres}=require('./test-support/durablePostgres.cjs');
test('Spieler real PostgreSQL: immediate hiding, owner review, RLS and immutable ACL',{skip:!process.env.DURABLE_TEST_DATABASE_URL,timeout:30000},async()=>{
 const db=await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 async function as(role,user,sql,args=[]){const c=await db.pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user||'']);const r=await c.query(sql,args);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const request=(actor,action,club='My voluntary club')=>as('service_role',null,'select public.spieler_request($1,$2,13404431,$3) as value',[action,actor,action==='claim'?club:null]);
 const review=(actor,kind,decision)=>as('service_role',null,'select spieler_admin.review($1,$2,13404431,$3) as value',[kind,actor,decision]);
 const search=()=>as('service_role',null,"select public.spieler_search('Huseynov') as value");
 const id=()=>as('service_role',null,'select public.spieler_search(null,13404431) as value');
 try{
  await db.pool.query("CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO authenticated;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT SELECT ON public.profiles TO service_role;");
  await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations/20261026184317_spieler_v1.sql'),'utf8'));
  await db.pool.query('INSERT INTO public.spieler_players(fide_id,name,surname,federation,title,fide_rating,source_date,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[sample.fide_id,sample.name,sample.surname,sample.federation,sample.title,sample.fide_rating,sample.source_date,sample.source_url]);
  // Legacy pending requests are suppressed by the forward migration as well.
  await db.pool.query("insert into public.spieler_opt_out(user_id,fide_id,status) values($1,13404431,'pending')",[a]);
  await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations/20261026201936_spieler_review_privacy.sql'),'utf8'));
  await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations/20261026210344_spieler_hide_abuse_limits.sql'),'utf8'));
  assert.deepEqual((await search()).rows[0].value,[]);
  assert.equal((await review(a,'hide','restore')).rows[0].value.status,'restored');
  const p=(await search()).rows[0].value[0];assert.equal(p.name,'Huseynov, Sabir');assert.equal(p.title,'FM');assert.equal(p.fide_rating,sample.fide_rating);assert.equal(p.source_date,sample.source_date);assert.equal(p.club,null);
  for(const role of ['anon','authenticated']){
   await assert.rejects(as(role,a,'select * from public.spieler_players'),e=>e.code==='42501');
   await assert.rejects(as(role,a,"select public.spieler_search('Huseynov')"),e=>e.code==='42501');
   await assert.rejects(as(role,a,"select public.spieler_request('claim',$1,13404431)",[a]),e=>e.code==='42501');
   await assert.rejects(as(role,a,"insert into public.spieler_claims(user_id,fide_id,status) values($1,13404431,'verified')",[a]),e=>e.code==='42501');
   await assert.rejects(as(role,a,"insert into public.spieler_opt_out(user_id,fide_id,status) values($1,13404431,'approved')",[a]),e=>e.code==='42501');
   await assert.rejects(as(role,a,'select * from spieler_admin.review_events'),e=>e.code==='42501');
   for(const [kind,decision]of [['claim','approve'],['claim','reject'],['hide','restore'],['hide','confirm']]){
    await assert.rejects(as(role,a,'select spieler_admin.review($1,$2,13404431,$3)',[kind,a,decision]),e=>e.code==='42501');
   }
  }
  assert.equal((await request(a,'hide')).rows[0].value.status,'hidden_pending_review','no claim or verification is required');
  assert.deepEqual((await search()).rows[0].value,[]);assert.deepEqual((await id()).rows[0].value,[]);
  assert.equal((await as('authenticated',a,'select count(*)::int as n from public.spieler_opt_out')).rows[0].n,1);
  assert.equal((await as('authenticated',b,'select count(*)::int as n from public.spieler_opt_out')).rows[0].n,0);
  assert.equal((await review(a,'hide','confirm')).rows[0].value.status,'approved');
  assert.equal((await request(a,'hide')).rows[0].value.status,'approved','repeat hide cannot undo a confirmed suppression');
  assert.deepEqual((await id()).rows[0].value,[]);
  await assert.rejects(review(a,'hide','confirm'),e=>e.code==='23514');
  assert.equal((await review(a,'hide','restore')).rows[0].value.status,'restored');assert.equal((await id()).rows[0].value.length,1);
  await assert.rejects(review(a,'hide','restore'),e=>e.code==='23514');
  await assert.rejects(review(a,'hide','approve'),e=>e.code==='22023');
  await assert.rejects(review(a,'unknown','confirm'),e=>e.code==='22023');
  assert.equal((await request(a,'claim')).rows[0].value.status,'pending');
  assert.equal((await as('authenticated',b,'select count(*)::int as n from public.spieler_claims')).rows[0].n,0);
  await assert.rejects(as('authenticated',a,"update public.spieler_claims set status='verified'"),e=>e.code==='42501');
  await assert.rejects(as('authenticated',a,"update public.spieler_opt_out set status='restored'"),e=>e.code==='42501');
  assert.equal((await search()).rows[0].value[0].club,null,'pending self-supplied club remains private');
  assert.equal((await review(a,'claim','reject')).rows[0].value.status,'rejected');assert.equal((await search()).rows[0].value[0].club,null);
  assert.equal((await request(a,'claim')).rows[0].value.status,'pending','rejected claimant may request a new review');
  assert.equal((await review(a,'claim','approve')).rows[0].value.status,'verified');
  assert.equal((await search()).rows[0].value[0].club,'My voluntary club');
  await assert.rejects(review(a,'claim','approve'),e=>e.code==='23514');
  assert.equal((await request(a,'claim','Changed club')).rows[0].value.status,'pending','editing a verified public club requires review again');assert.equal((await search()).rows[0].value[0].club,null);
  assert.equal((await review(a,'claim','approve')).rows[0].value.status,'verified');assert.equal((await search()).rows[0].value[0].club,'Changed club');
  await request(b,'claim');await assert.rejects(review(b,'claim','approve'),e=>e.code==='23505','one verified owner per player');
  await assert.rejects(review('33333333-3333-4333-8333-333333333333','claim','approve'),e=>e.code==='22023');
  await request(a,'hide');await request(b,'hide');await review(a,'hide','restore');assert.deepEqual((await id()).rows[0].value,[],'restoring one request cannot override another active suppression');
  await review(b,'hide','restore');assert.equal((await id()).rows[0].value.length,1);
  const events=await as('service_role',null,'select kind,decision,previous_status,new_status,reviewed_at from spieler_admin.review_events');assert.equal(events.rows.length,8);assert.ok(events.rows.every(e=>e.reviewed_at&&e.previous_status&&e.new_status));
  await assert.rejects(as('service_role',null,'delete from spieler_admin.review_events'),e=>e.code==='42501');
  assert.deepEqual((await as('service_role',null,"select public.spieler_search('%') as value")).rows[0].value,[],'wildcards cannot enumerate the catalog');
  const rls=await db.pool.query("select count(*)::int as n from pg_class where relname in ('spieler_players','spieler_claims','spieler_opt_out','spieler_twic_games','review_events') and relrowsecurity");assert.equal(rls.rows[0].n,5);
 }finally{await db.close();}
});

test('Spieler real PostgreSQL: fourth hide queues visibly, verified self-hide is exempt and concurrent requests respect three slots',{skip:!process.env.DURABLE_TEST_DATABASE_URL,timeout:30000},async()=>{
 const db=await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',ids=Array.from({length:8},(_,i)=>50000001+i);
 async function rpc(sql,args=[]){const c=await db.pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE service_role');const r=await c.query(sql,args);await c.query('COMMIT');return r.rows[0]?.value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const hide=(who,id)=>rpc("select public.spieler_request('hide',$1,$2) as value",[who,id]);
 const review=(kind,who,id,decision)=>rpc('select spieler_admin.review($1,$2,$3,$4) as value',[kind,who,id,decision]);
 const card=id=>rpc('select public.spieler_search(null,$1) as value',[id]);
 const count=async who=>(await db.pool.query("select count(*)::int as n from public.spieler_opt_out where user_id=$1 and status='hidden_pending_review'",[who])).rows[0].n;
 try{
  await db.pool.query("CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO authenticated;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT SELECT ON public.profiles TO service_role;");
  for(const file of ['20261026184317_spieler_v1.sql','20261026201936_spieler_review_privacy.sql'])await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations',file),'utf8'));
  for(const id of ids)await db.pool.query('INSERT INTO public.spieler_players(fide_id,name,surname,federation,title,fide_rating,source_date,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,'Hidecap, Player '+id,'Hidecap',sample.federation,sample.title,sample.fide_rating,sample.source_date,sample.source_url]);
  // Existing pending hides are also brought within the allowance by migration.
  for(const id of ids.slice(0,4))await hide(b,id);
  await rpc("select public.spieler_request('claim',$1,$2) as value",[b,ids[4]]);await review('claim',b,ids[4],'approve');await hide(b,ids[4]);
  await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations/20261026210344_spieler_hide_abuse_limits.sql'),'utf8'));
  assert.equal(await count(b),3);assert.equal((await card(ids[3])).length,1,'legacy fourth unverified hide is queued without suppression');
  assert.equal((await hide(b,ids[4])).status,'approved');assert.equal(await count(b),3,'legacy verified self-hide is exempt');
  await db.pool.query('delete from public.spieler_opt_out;delete from public.spieler_claims;delete from spieler_admin.review_events');
  for(const id of ids.slice(0,3)){assert.equal((await hide(a,id)).status,'hidden_pending_review');assert.deepEqual(await card(id),[]);}
  assert.equal((await hide(a,ids[0])).status,'hidden_pending_review');assert.equal(await count(a),3,'retry does not consume another slot');
  assert.deepEqual(await hide(a,ids[3]),{status:'pending_owner_review',code:'hide_limit'});
  assert.equal((await card(ids[3])).length,1,'fourth hide does not hide the player card');
  assert.ok((await rpc("select public.spieler_search('Hidecap') as value")).some(p=>Number(p.fide_id)===ids[3]),'fourth player stays in search');
  const queued=await db.pool.query('select status,created_at from public.spieler_opt_out where user_id=$1 and fide_id=$2',[a,ids[3]]);assert.equal(queued.rows[0].status,'pending_owner_review','409 result does not roll back the stored request');
  await hide(a,ids[3]);const repeated=await db.pool.query('select created_at from public.spieler_opt_out where user_id=$1 and fide_id=$2',[a,ids[3]]);assert.equal(repeated.rows[0].created_at.getTime(),queued.rows[0].created_at.getTime(),'retry preserves the owner review deadline');
  await rpc("select public.spieler_request('claim',$1,$2) as value",[a,ids[4]]);await review('claim',a,ids[4],'approve');
  assert.equal((await hide(a,ids[4])).status,'approved','verified own card always hides immediately');assert.deepEqual(await card(ids[4]),[]);assert.equal(await count(a),3,'verified own hide does not consume the three slots');
  await review('hide',a,ids[3],'confirm');assert.deepEqual(await card(ids[3]),[],'owner can confirm queued hide');
  await review('hide',a,ids[3],'restore');assert.equal((await card(ids[3])).length,1);
  assert.equal((await hide(a,ids[3])).code,'hide_limit');await review('hide',a,ids[3],'restore');assert.equal((await card(ids[3])).length,1,'owner can restore a queued request without ever hiding it');
  await review('hide',a,ids[0],'restore');assert.equal((await hide(a,ids[3])).status,'hidden_pending_review');assert.equal(await count(a),3,'restoration releases a slot');
  const concurrent=await Promise.all(ids.map(id=>hide(b,id)));assert.equal(concurrent.filter(r=>r.status==='hidden_pending_review').length,3);assert.equal(concurrent.filter(r=>r.code==='hide_limit').length,5);assert.equal(await count(b),3,'actor lock prevents parallel overbooking across FIDE IDs');
  assert.equal((await db.pool.query('select count(*)::int as n from public.spieler_opt_out where user_id=$1',[b])).rows[0].n,8,'all parallel requests are retained for review');
 }finally{await db.close();}
});
