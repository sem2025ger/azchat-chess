'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {randomBytes}=require('node:crypto');const {readFileSync}=require('node:fs');const {join}=require('node:path');const {Client}=require('pg');const {parseGame}=require('./src/games/twic/pgn');
const url=process.env.DURABLE_TEST_DATABASE_URL;
const local=(()=>{try{return ['127.0.0.1','localhost','::1'].includes(new URL(url).hostname);}catch{return false;}})();
test('Games database migration, RLS, atomic batches and parameterized searches (isolated PostgreSQL)',{skip:!local},async()=>{
 const admin=new Client({connectionString:url});await admin.connect();const name='games_ci_'+randomBytes(6).toString('hex');let db;
 try{
  await admin.query(`CREATE DATABASE "${name}"`);const target=new URL(url);target.pathname='/'+name;db=new Client({connectionString:target.toString()});await db.connect();
  for(const role of ['anon','authenticated','service_role'])await db.query(`DO $$ BEGIN CREATE ROLE ${role}${role==='service_role'?' BYPASSRLS':''}; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$`);
  await db.query('GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role');
  await db.query(readFileSync(join(__dirname,'../supabase/migrations/20261024045303_games_database_v1.sql'),'utf8'));
  for(const role of ['anon','authenticated']){
   await db.query('SET ROLE '+role);await assert.rejects(db.query('SELECT * FROM public.chess_db_games'),{code:'42501'});
   await assert.rejects(db.query("SELECT public.chess_db_control('size')"),{code:'42501'});await db.query('RESET ROLE');
  }
  const game=parseGame('[Event "Synthetic integration"]\n[White "Example Alpha"]\n[Black "Example Beta"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 *',777);
  const call=async(op,games=[])=> (await db.query('SELECT public.chess_db_control($1,$2,$3::jsonb) AS value',[op,777,JSON.stringify(games)])).rows[0].value;
  await db.query('SET ROLE service_role');await call('start');assert.equal((await call('batch',[game])).inserted,1);assert.equal((await call('batch',[game])).inserted,0);
  const found=(await db.query('SELECT public.chess_db_search($1,$2,20,0) AS value',['example',game.positions[0].pos_hash])).rows[0].value;
  assert.equal(found.total,1);assert.equal(found.games[0].white.name,'Example Alpha');
  const wrong=(await db.query('SELECT public.chess_db_search($1,$2,20,0) AS value',['other',game.positions[0].pos_hash])).rows[0].value;assert.equal(wrong.total,0);
  await assert.rejects(db.query("SELECT public.chess_db_control('batch',777,$1::jsonb,0,NULL,1)",[JSON.stringify([game])]),/DB_SIZE_LIMIT/);
  const positions=await db.query('SELECT count(*) AS count,max(ply) AS ply FROM public.chess_db_positions');assert.equal(Number(positions.rows[0].count),4);assert.equal(positions.rows[0].ply,4);
  await call('done');assert.equal((await call('start')).done,true);
 }finally{if(db)await db.end();await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await admin.end();}
});
