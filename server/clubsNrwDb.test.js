'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {Client}=require('pg');const {randomBytes}=require('node:crypto');
const fs=require('node:fs');const path=require('node:path');
const url=process.env.DURABLE_TEST_DATABASE_URL;
const local=(()=>{try{return ['localhost','127.0.0.1','::1'].includes(new URL(url).hostname)}catch{return false}})();
test('NRW real PostgreSQL permissions, roster, club editors and duel gate (isolated)',{skip:!local},async t=>{
 const root=new Client({connectionString:url});await root.connect();
 const db='chessaz_nrw_'+randomBytes(5).toString('hex'),dbUrl=new URL(url);dbUrl.pathname='/'+db;
 let made=false;
 const ids={alice:'11111111-1111-4111-8111-111111111111',bob:'22222222-2222-4222-8222-222222222222',eve:'33333333-3333-4333-8333-333333333333'};
 const dbconn=dbUrl.toString();
 const admin=async(sql,params=[])=>{const c=new Client({connectionString:dbconn});await c.connect();try{return await c.query(sql,params)}finally{await c.end()}};
 const as=async(role,who,sql,params=[])=>{const c=new Client({connectionString:dbconn});await c.connect();try{await c.query('SET ROLE '+role);if(who)await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids[who]]);return await c.query(sql,params)}finally{await c.end()}};
 try{
  await root.query('CREATE DATABASE "'+db+'"');made=true;
  await admin("DO $$ BEGIN BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END; BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END; END $$");
  await admin("CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;");
  await admin('GRANT USAGE ON SCHEMA public TO anon,authenticated;CREATE TABLE public.profiles(id uuid PRIMARY KEY,username text);');
  for(const [name,id] of Object.entries(ids))await admin('INSERT INTO public.profiles(id,username) VALUES($1,$2)',[id,name]);
  const foundation=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261021000000_chessaz_deutsch_community_foundation.sql'),'utf8');
  await admin(foundation);
  const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026224500_clubs_nrw_v1.sql'),'utf8');
  await admin(migration);
  const {rows:[club,other]}=await admin('SELECT id FROM public.clubs_nrw ORDER BY slug');
  assert.ok(club&&other);
  const foreign=await as('anon',null,'SELECT count(*)::int AS n FROM public.clubs_nrw');assert.equal(foreign.rows[0].n,2);
  await assert.rejects(()=>as('anon',null,'SELECT * FROM public.clubs_nrw_members'),e=>e?.code==='42501');
  await admin('INSERT INTO public.clubs_nrw_roles(club_id,user_id,role) VALUES($1,$2,$3)',[club.id,ids.alice,'admin']);
  await admin('INSERT INTO public.clubs_nrw_roles(club_id,user_id,role) VALUES($1,$2,$3)',[club.id,ids.bob,'moderator']);
  await t.test('account selects club but roster stays private until opted in',async()=>{
   await as('authenticated','eve','INSERT INTO public.clubs_nrw_members(user_id,club_id) VALUES($1,$2)',[ids.eve,club.id]);
   const own=await as('authenticated','eve','SELECT * FROM public.clubs_nrw_members WHERE user_id=$1',[ids.eve]);
   assert.equal(own.rows[0].public_roster,false);
   const outsider=await as('authenticated','alice','SELECT * FROM public.clubs_nrw_members WHERE user_id=$1',[ids.eve]);assert.equal(outsider.rowCount,0);
   await as('authenticated','eve','UPDATE public.clubs_nrw_members SET public_roster=true WHERE user_id=$1',[ids.eve]);
   const publicList=await as('authenticated','alice','SELECT * FROM public.clubs_nrw_members WHERE user_id=$1',[ids.eve]);assert.equal(publicList.rowCount,1);
   await assert.rejects(()=>as('authenticated','alice','INSERT INTO public.clubs_nrw_members(user_id,club_id) VALUES($1,$2)',[ids.eve,other.id]),e=>e?.code==='42501');
  });
  await t.test('calendar: moderator allowed, outsider denied; league: only admin',async()=>{
   const when='2026-11-06T18:00:00Z';
   await as('authenticated','bob','INSERT INTO public.clubs_nrw_calendar(club_id,title,starts_at,created_by,updated_by) VALUES($1,$2,$3,$4,$4)',[club.id,'Freitagsturnier',when,ids.bob]);
   const allowed=await as('authenticated','alice','SELECT * FROM public.clubs_nrw_calendar');assert.equal(allowed.rowCount,1);
   await assert.rejects(()=>as('authenticated','eve','INSERT INTO public.clubs_nrw_calendar(club_id,title,starts_at,created_by,updated_by) VALUES($1,$2,$3,$4,$4)',[club.id,'Foreign event',when,ids.eve]),e=>e?.code==='42501');
   await assert.rejects(()=>as('authenticated','bob','INSERT INTO public.clubs_nrw_league_rows(club_id,season,league,team,place,updated_by) VALUES($1,$2,$3,$4,1,$5)',[club.id,'2026/27','Verbandsliga','Team Blau',ids.bob]),e=>e?.code==='42501');
   await as('authenticated','alice','INSERT INTO public.clubs_nrw_league_rows(club_id,season,league,team,place,updated_by) VALUES($1,$2,$3,$4,1,$5)',[club.id,'2026/27','Verbandsliga','Team Blau',ids.alice]);
  });
  await t.test('duels only proposals, no match or game table write',async()=>{
   await as('authenticated','bob','INSERT INTO public.clubs_nrw_duels(home_club_id,away_club_id,title,created_by) VALUES($1,$2,$3,$4)',[club.id,other.id,'Freundschaftsduell',ids.bob]);
   await assert.rejects(()=>as('authenticated','bob',"INSERT INTO public.clubs_nrw_duels(home_club_id,away_club_id,title,status,created_by) VALUES($1,$2,$3,'active',$4)",[club.id,other.id,'Aktives Spiel',ids.bob]),e=>e?.code==='23514');
   const t1=await admin('SELECT count(*)::int AS n FROM public.clubs_nrw_duels');assert.equal(t1.rows[0].n,1);
  });
  await t.test('room links fail closed without PR #126 kind=room',async()=>{
   const r=await admin('SELECT id FROM public.chess_clubs LIMIT 1');const room=r.rows[0].id;
   await admin("UPDATE public.chess_clubs SET is_open=false WHERE id=$1",[room]);
   await admin("INSERT INTO public.chess_club_members(club_id,user_id,role) VALUES($1,$2,'admin')",[room,ids.alice]);
   await assert.rejects(()=>as('authenticated','alice','INSERT INTO public.clubs_nrw_room_links(club_id,room_id) VALUES($1,$2)',[club.id,room]),e=>e?.code==='42501');
  });
 }finally{
  if(made){await root.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[db]).catch(()=>{});await root.query('DROP DATABASE IF EXISTS "'+db+'"').catch(()=>{});}await root.end();
 }
});
