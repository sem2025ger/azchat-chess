'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const {isolatedPostgres}=require('./test-support/durablePostgres.cjs');
const sample=require('./test-support/spielerFixture.cjs').acceptance();
test('Spieltag real PostgreSQL: ordered dependencies, authoritative team privacy and captain-only planning',{
 skip:!process.env.CI&&!process.env.DURABLE_TEST_DATABASE_URL,timeout:30000,
},async t=>{
 const db=await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
 const captain='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
 const outsider='33333333-3333-4333-8333-333333333333',otherCaptain='44444444-4444-4444-8444-444444444444';
 async function as(who,sql,args=[],role='authenticated'){
  const c=await db.pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[who||'']);const r=await c.query(sql,args);await c.query('COMMIT');return r;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 try{
  await db.pool.query(`CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO authenticated;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   ALTER TABLE public.profiles ADD COLUMN username text;GRANT SELECT ON public.profiles TO service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
  await db.pool.query('INSERT INTO public.profiles(id) VALUES($1),($2)',[outsider,otherCaptain]);
  for(const file of ['20261021000000_chessaz_deutsch_community_foundation.sql','20261026184317_spieler_v1.sql',
   '20261026201936_spieler_review_privacy.sql','20261026210344_spieler_hide_abuse_limits.sql',
   '20261026224500_clubs_nrw_v1.sql','20261027001000_spieler_clubs_nrw_fk.sql','20261027003816_spieltag_v1.sql']){
   await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations',file),'utf8'));
  }
  await db.pool.query('INSERT INTO public.spieler_players(fide_id,name,surname,federation,title,fide_rating,source_date,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
   [sample.fide_id,sample.name,sample.surname,sample.federation,sample.title,sample.fide_rating,sample.source_date,sample.source_url]);
  const {rows:clubs}=await db.pool.query('SELECT id FROM public.clubs_nrw ORDER BY slug');
  const {rows:[team]}=await db.pool.query("INSERT INTO public.spieltag_teams(club_id,name) VALUES($1,'Erste Mannschaft') RETURNING id",[clubs[0].id]);
  const {rows:[otherTeam]}=await db.pool.query("INSERT INTO public.spieltag_teams(club_id,name) VALUES($1,'Zweite Mannschaft') RETURNING id",[clubs[0].id]);
  const {rows:[foreignTeam]}=await db.pool.query("INSERT INTO public.spieltag_teams(club_id,name) VALUES($1,'Fremder Verein') RETURNING id",[clubs[1].id]);
  for(const [teamId,who,role]of [[team.id,captain,'captain'],[team.id,member,'member'],[otherTeam.id,otherCaptain,'captain'],[foreignTeam.id,otherCaptain,'captain']])
   await db.pool.query('INSERT INTO public.spieltag_team_members(team_id,user_id,role) VALUES($1,$2,$3)',[teamId,who,role]);
  const insertMatch=(who,teamId=team.id,author=who)=>as(who,"INSERT INTO public.spieltag_matches(team_id,round_label,opponent_name,opponent_club_id,starts_at,venue,created_by,updated_by) VALUES($1,'Runde 1','Gastmannschaft',$2,'2026-11-08T10:00:00Z','Vereinsheim',$3,$3) RETURNING id",[teamId,clubs[1].id,author]);
  const {rows:[match]}=await insertMatch(captain);
  const {rows:[otherMatch]}=await insertMatch(otherCaptain,otherTeam.id);
  const {rows:[foreignMatch]}=await insertMatch(otherCaptain,foreignTeam.id);
  const insertBoard=(who,matchId=match.id,n=1)=>as(who,"INSERT INTO public.spieltag_boards(match_id,board_number,home_name,opponent_name,opponent_fide_id) VALUES($1,$2,'Eigener Spieler','Gastspieler',$3)",[matchId,n,sample.fide_id]);
  await insertBoard(captain);await insertBoard(otherCaptain,otherMatch.id);await insertBoard(otherCaptain,foreignMatch.id);
  await t.test('anon denied; member sees only assigned team, including direct IDs and child rows',async()=>{
   for(const table of ['spieltag_teams','spieltag_team_members','spieltag_matches','spieltag_boards']){
    await assert.rejects(as(null,'SELECT * FROM public.'+table,[],'anon'),e=>e.code==='42501');
    assert.equal((await as(outsider,'SELECT * FROM public.'+table)).rowCount,0);
   }
   assert.equal((await as(member,'SELECT * FROM public.spieltag_teams')).rowCount,1);
   assert.equal((await as(member,'SELECT * FROM public.spieltag_matches')).rowCount,1);
   assert.equal((await as(member,'SELECT * FROM public.spieltag_boards')).rowCount,1);
   assert.equal((await as(member,'SELECT * FROM public.spieltag_matches WHERE id=$1',[otherMatch.id])).rowCount,0,'same club is not automatic team access');
   assert.equal((await as(member,'SELECT * FROM public.spieltag_boards WHERE match_id=$1',[foreignMatch.id])).rowCount,0);
  });
  await t.test('self-selected club and NRW editor role cannot grant private team access',async()=>{
   await as(outsider,'INSERT INTO public.clubs_nrw_members(user_id,club_id) VALUES($1,$2)',[outsider,clubs[0].id]);
   await db.pool.query("INSERT INTO public.clubs_nrw_roles(club_id,user_id,role) VALUES($1,$2,'owner')",[clubs[0].id,outsider]);
   assert.equal((await as(outsider,'SELECT * FROM public.spieltag_matches')).rowCount,0);
   await assert.rejects(as(outsider,"INSERT INTO public.spieltag_team_members(team_id,user_id,role) VALUES($1,$2,'captain')",[team.id,outsider]),e=>e.code==='42501');
   await assert.rejects(as(member,"UPDATE public.spieltag_team_members SET role='captain' WHERE user_id=$1",[member]),e=>e.code==='42501');
   await assert.rejects(as(captain,'DELETE FROM public.spieltag_team_members WHERE user_id=$1',[member]),e=>e.code==='42501');
   await assert.rejects(as(captain,"INSERT INTO public.spieltag_teams(club_id,name) VALUES($1,'Forged')",[clubs[0].id]),e=>e.code==='42501');
  });
  await t.test('boards independently require membership even if a future parent-read policy is broadened',async()=>{
   const {rows:[policy]}=await db.pool.query("SELECT pg_get_expr(polqual,polrelid) AS expression FROM pg_policy WHERE polname='spieltag_match_read' AND polrelid='public.spieltag_matches'::regclass");
   // Disposable database only: deliberately broaden the parent policy to prove
   // the child table has its own membership boundary, then restore it exactly.
   await db.pool.query('ALTER POLICY spieltag_match_read ON public.spieltag_matches USING(true)');
   try{
    assert.equal((await as(outsider,'SELECT * FROM public.spieltag_matches WHERE id=$1',[match.id])).rowCount,1,'fixture actually broadens the parent');
    assert.equal((await as(outsider,'SELECT * FROM public.spieltag_boards WHERE match_id=$1',[match.id])).rowCount,0);
    assert.equal((await as(otherCaptain,'SELECT * FROM public.spieltag_boards WHERE match_id=$1',[match.id])).rowCount,0);
    assert.equal((await as(member,'SELECT * FROM public.spieltag_boards WHERE match_id=$1',[match.id])).rowCount,1);
   }finally{await db.pool.query('ALTER POLICY spieltag_match_read ON public.spieltag_matches USING('+policy.expression+')');}
  });
  await t.test('only captain can write own schedules, boards, results and notes; foreign IDs fail closed',async()=>{
   for(const who of [member,outsider,otherCaptain]){
    await assert.rejects(insertMatch(who),e=>e.code==='42501');
    await assert.rejects(insertBoard(who,match.id,2),e=>e.code==='42501');
    assert.equal((await as(who,"UPDATE public.spieltag_matches SET notes='forged',updated_by=$1 WHERE id=$2 RETURNING id",[who,match.id])).rowCount,0);
    assert.equal((await as(who,"UPDATE public.spieltag_boards SET result='1-0' WHERE match_id=$1 RETURNING match_id",[match.id])).rowCount,0);
    assert.equal((await as(who,'DELETE FROM public.spieltag_matches WHERE id=$1 RETURNING id',[match.id])).rowCount,0);
   }
   await as(captain,"UPDATE public.spieltag_matches SET notes='Knappes Ergebnis. Danke an alle!',updated_by=$1 WHERE id=$2",[captain,match.id]);
   await as(captain,"UPDATE public.spieltag_boards SET result='1/2-1/2' WHERE match_id=$1",[match.id]);
   const {rows:[saved]}=await as(member,'SELECT notes,result,opponent_fide_id FROM public.spieltag_matches g JOIN public.spieltag_boards b ON b.match_id=g.id WHERE g.id=$1',[match.id]);
   assert.equal(saved.notes,'Knappes Ergebnis. Danke an alle!');assert.equal(saved.result,'1/2-1/2');assert.equal(String(saved.opponent_fide_id),String(sample.fide_id));
   await assert.rejects(insertMatch(captain,team.id,member),e=>e.code==='42501');
   await assert.rejects(as(captain,'UPDATE public.spieltag_matches SET updated_by=$1 WHERE id=$2',[member,match.id]),e=>e.code==='42501');
  });
  await t.test('identity columns immutable and invalid data rejected without touching game/rating tables',async()=>{
   for(const [sql,args]of [
    ['UPDATE public.spieltag_matches SET team_id=$1 WHERE id=$2',[otherTeam.id,match.id]],
    ['UPDATE public.spieltag_matches SET created_by=$1 WHERE id=$2',[member,match.id]],
    ['UPDATE public.spieltag_boards SET match_id=$1 WHERE match_id=$2',[otherMatch.id,match.id]],
    ['UPDATE public.spieltag_boards SET board_number=2 WHERE match_id=$1',[match.id]],
   ])await assert.rejects(as(captain,sql,args),e=>e.code==='42501');
   await assert.rejects(insertBoard(captain),e=>e.code==='23505');
   await assert.rejects(insertBoard(captain,match.id,33),e=>e.code==='23514');
   await assert.rejects(as(captain,"UPDATE public.spieltag_boards SET result='2-0' WHERE match_id=$1",[match.id]),e=>e.code==='23514');
   await assert.rejects(as(captain,'UPDATE public.spieltag_boards SET opponent_fide_id=9999999999 WHERE match_id=$1',[match.id]),e=>e.code==='23503');
   await assert.rejects(as(captain,'UPDATE public.spieltag_matches SET notes=$1 WHERE id=$2',['x'.repeat(1001),match.id]),e=>e.code==='23514');
   assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches')).rows[0].n,0);
   assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.clubs_nrw_league_rows')).rows[0].n,0);
  });
  await t.test('revocation immediately removes all reads and captain writes; service-only cleanup cascades',async()=>{
   await db.pool.query('DELETE FROM public.spieltag_team_members WHERE team_id=$1 AND user_id=$2',[team.id,captain]);
   assert.equal((await as(captain,'SELECT * FROM public.spieltag_matches')).rowCount,0);
   assert.equal((await as(captain,'SELECT * FROM public.spieltag_boards')).rowCount,0);
   await assert.rejects(insertBoard(captain,match.id,2),e=>e.code==='42501');
   await db.pool.query('DELETE FROM public.spieltag_teams WHERE id=$1',[team.id]);
   assert.equal((await db.pool.query('SELECT * FROM public.spieltag_boards WHERE match_id=$1',[match.id])).rowCount,0);
  });
 }finally{await db.close();}
});
