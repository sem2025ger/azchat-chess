'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {Client}=require('pg');
const url=process.env.DURABLE_TEST_DATABASE_URL;
const local=(()=>{try{return ['localhost','127.0.0.1','::1'].includes(new URL(url).hostname)}catch{return false}})();
test('club pinned messages: only moderator/admin can change pin', {skip:!local},async()=>{
  const admin=new Client({connectionString:url});const name='chessaz_pin_'+randomBytes(6).toString('hex');
  const temp=new URL(url);temp.pathname='/'+name;let db,made=false;
  try{
    await admin.connect();await admin.query('CREATE DATABASE "'+name+'"');made=true;
    db=new Client({connectionString:temp.toString()});await db.connect();
    await db.query(`DO $$ BEGIN
      BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      ALTER ROLE service_role BYPASSRLS;
    END $$;`);
    await db.query(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.chess_clubs(id uuid PRIMARY KEY);
    CREATE TABLE public.chess_club_members(club_id uuid,user_id uuid,role text);
    INSERT INTO public.chess_clubs VALUES('11111111-1111-4111-8111-111111111111');
    INSERT INTO public.profiles VALUES('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
    INSERT INTO public.chess_club_members VALUES
     ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','member'),
     ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','moderator');`);
    await db.query(readFileSync(join(__dirname,'../supabase/migrations/20261025184000_schach_treff_pinned_message.sql'),'utf8'));
    const run=async(id,body)=>{
      await db.query('SELECT set_config($1,$2,false)',['request.jwt.claim.sub',id]);
      return db.query('SELECT public.set_club_pin($1,$2)', ['11111111-1111-4111-8111-111111111111',body]);
    };
    await assert.rejects(run('22222222-2222-4222-8222-222222222222','Bad pin'),/Only club moderators/);
    await run('33333333-3333-4333-8333-333333333333','Pinned by moderator');
    let r=await db.query('SELECT pinned_body,pinned_by FROM public.chess_clubs');
    assert.equal(r.rows[0].pinned_body,'Pinned by moderator');
    assert.equal(r.rows[0].pinned_by,'33333333-3333-4333-8333-333333333333');
    await assert.rejects(run('33333333-3333-4333-8333-333333333333','x'.repeat(501)),/Pin exceeds 500/);
    await run('33333333-3333-4333-8333-333333333333','');
    r=await db.query('SELECT pinned_body,pinned_by,pinned_at FROM public.chess_clubs');
    assert.equal(r.rows[0].pinned_body,null);assert.equal(r.rows[0].pinned_by,null);
    for(const role of ['anon','authenticated','service_role']){
      r=await db.query("SELECT has_function_privilege($1,'public.set_club_pin(uuid,text)','EXECUTE') AS can",[role]);
      assert.equal(r.rows[0].can,role==='authenticated');
    }
  }finally{if(db)await db.end();if(made)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');await admin.end()}
});
