'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const {isolatedPostgres}=require('./test-support/durablePostgres.cjs');
const url=process.env.DURABLE_TEST_DATABASE_URL;
test('private rooms: membership isolation, hashed/expiring/quota invites and room limit',{skip:!url,timeout:30000},async()=>{
 const db=await isolatedPostgres(url),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 async function as(role,user,sql,args=[]){const client=await db.pool.connect();try{await client.query('BEGIN');await client.query('SET LOCAL ROLE '+role);await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user??'']);const r=await client.query(sql,args);await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
 try{
  await db.pool.query(`INSERT INTO public.profiles(id) VALUES('${c}');CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
   CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO authenticated;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for(const file of ['20261021000000_chessaz_deutsch_community_foundation.sql','20261026142707_schach_treff_private_rooms.sql'])await db.pool.query(readFileSync(join(__dirname,'../supabase/migrations',file),'utf8'));
  const room=(await as('authenticated',a,"SELECT public.create_club_room('Private test room') AS id")).rows[0].id;
  await as('authenticated',a,"INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES($1,$2,'Members only')",[room,a]);
  assert.equal((await as('authenticated',b,'SELECT count(*)::int AS n FROM public.chess_clubs WHERE id=$1',[room])).rows[0].n,0);
  assert.equal((await as('authenticated',b,'SELECT count(*)::int AS n FROM public.chess_club_members WHERE club_id=$1',[room])).rows[0].n,0);
  assert.equal((await as('authenticated',b,'SELECT count(*)::int AS n FROM public.chess_club_messages WHERE club_id=$1',[room])).rows[0].n,0);
  await assert.rejects(as('authenticated',b,'INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)',[room,b]),e=>e.code==='42501');
  await assert.rejects(as('authenticated',b,'SELECT public.create_club_invite($1)',[room]),e=>e.code==='42501');
  const token=(await as('authenticated',a,'SELECT public.create_club_invite($1) AS value',[room])).rows[0].value;
  assert.match(token,/^[0-9a-f]{32}$/);
  assert.notEqual((await db.pool.query('SELECT token_hash FROM public.chess_club_invites WHERE club_id=$1',[room])).rows[0].token_hash,token);
  await assert.rejects(as('authenticated',a,'SELECT token_hash FROM public.chess_club_invites'),e=>e.code==='42501');
  for(let n=0;n<2;n++)assert.equal((await as('authenticated',b,'SELECT public.join_club_by_invite($1) AS id',[token])).rows[0].id,room);
  assert.equal((await db.pool.query('SELECT uses FROM public.chess_club_invites WHERE club_id=$1',[room])).rows[0].uses,1);
  assert.equal((await as('authenticated',b,'SELECT count(*)::int AS n FROM public.chess_club_messages WHERE club_id=$1',[room])).rows[0].n,1);
  await db.pool.query('UPDATE public.chess_club_invites SET max_uses=1 WHERE club_id=$1',[room]);
  await assert.rejects(as('authenticated',c,'SELECT public.join_club_by_invite($1)',[token]),/invite_used/);
  const expired=(await as('authenticated',a,'SELECT public.create_club_invite($1) AS value',[room])).rows[0].value;
  await db.pool.query("UPDATE public.chess_club_invites SET expires_at=now()-interval '1 second' WHERE token_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",[expired]);
  await assert.rejects(as('authenticated',c,'SELECT public.join_club_by_invite($1)',[expired]),/invite_expired/);
  await assert.rejects(as('authenticated',c,"SELECT public.join_club_by_invite('invalid')"),/invite_invalid/);
  const rooms=await Promise.allSettled(Array.from({length:3},()=>as('authenticated',a,"SELECT public.create_club_room('Another room')")));
  assert.equal(rooms.filter(x=>x.status==='fulfilled').length,1);assert.equal(rooms.filter(x=>x.status==='rejected'&&/room_limit/.test(x.reason.message)).length,2);
  const mobile=(await as('authenticated',b,"SELECT count(*)::int AS n FROM public.chess_clubs WHERE slug='chessaz-deutsch'")).rows[0].n;
  assert.equal(mobile,1,'legacy mobile lookup still resolves only its fixed community slug');
 }finally{await db.close();}
});
