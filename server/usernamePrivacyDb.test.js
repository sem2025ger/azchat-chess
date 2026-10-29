'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');
const url = process.env.DURABLE_TEST_DATABASE_URL;
const local = (() => { try { return ['localhost','127.0.0.1','::1'].includes(new URL(url).hostname); } catch { return false; } })();

test('username privacy migration: isolated PostgreSQL integration', { skip: !local }, async () => {
  const admin = new Client({ connectionString: url });
  const name = 'chessaz_username_' + randomBytes(6).toString('hex');
  const tmpUrl = new URL(url); tmpUrl.pathname = '/' + name;
  let db = null, made = false;
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555',
  ];
  const legacy = (base, id) => base + '_' + id.replace(/-/g,'');
  try {
    await admin.connect();
    await admin.query('CREATE DATABASE "' + name + '"'); made = true;
    db = new Client({ connectionString: tmpUrl.toString() }); await db.connect();
    await db.query(`DO $$ BEGIN
      BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role') THEN
        ALTER ROLE service_role BYPASSRLS;
      END IF;
    END $$;`);
    await db.query(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
      CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), username text NOT NULL UNIQUE);
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
    const entries = [
      [ids[0], 'participant@example.org', { username:'Marina' },legacy('Marina',ids[0])],
      [ids[1], 'marina2@example.org', { username:'Marina' },legacy('marina2',ids[1])],
      [ids[2], 'private123@example.org', {},legacy('private123',ids[2])],
      [ids[3], 'custom@example.org', {},'OriginalCustom'],
    ];
    for (const [id,email,meta,username] of entries) {
      await db.query('INSERT INTO auth.users VALUES ($1,$2,$3)',[id,email,JSON.stringify(meta)]);
      await db.query('INSERT INTO public.profiles VALUES ($1,$2)',[id,username]);
    }
    await db.query(readFileSync(join(__dirname,'../supabase/migrations/20261025164000_schach_treff_private_usernames.sql'),'utf8'));
    let r = await db.query('SELECT id,username FROM public.profiles ORDER BY id');
    assert.equal(r.rows[0].username,'Marina');
    assert.equal(r.rows[1].username,'Marina_2');
    assert.equal(r.rows[2].username,'spieler_1');
    assert.equal(r.rows[3].username,'OriginalCustom');
    r=await db.query('SELECT count(*)::integer AS count FROM private.username_backfill_log');
    assert.equal(r.rows[0].count,3);
    const fn = await db.query("SELECT private.safe_player_name('first@example.com') AS email, private.safe_player_name('moderator') AS reserved, private.safe_player_name('chessaz') AS brand, private.safe_player_name('SchachTreff') AS room, private.safe_player_name('maxm') AS chosen");
    assert.equal(fn.rows[0].email,null); assert.equal(fn.rows[0].reserved,null);
    assert.equal(fn.rows[0].brand,null); assert.equal(fn.rows[0].room,null);
    assert.equal(fn.rows[0].chosen,'maxm');
    // Signup is protected even if username metadata is missing.
    await db.query("CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user()");
    await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[ids[4],'name@example.org',JSON.stringify({})]);
    r=await db.query('SELECT username FROM public.profiles WHERE id=$1',[ids[4]]);
    assert.equal(r.rows[0].username,'spieler_2');
    // A chosen nickname remains valid when identical to the email local part.
    const sameId='66666666-6666-4666-8666-666666666666';
    await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[sameId,'maxm@example.org',JSON.stringify({username:'maxm'})]);
    r=await db.query('SELECT username FROM public.profiles WHERE id=$1',[sameId]);
    assert.equal(r.rows[0].username,'maxm');
    const duplicateId='77777777-7777-4777-8777-777777777777';
    await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[duplicateId,'another@example.org',JSON.stringify({username:'MARINA'})]);
    r=await db.query('SELECT username FROM public.profiles WHERE id=$1',[duplicateId]);
    assert.equal(r.rows[0].username,'MARINA_3');
    // Regression: never grant the sensitive rollback log to browser or service roles.
    for(const role of ['anon','authenticated','service_role']) {
      r=await db.query("SELECT has_table_privilege($1,'private.username_backfill_log','SELECT') AS allowed",[role]);
      assert.equal(r.rows[0].allowed,false);
    }
  } finally {
    if (db) await db.end();
    if(made) await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
    await admin.end();
  }
});
