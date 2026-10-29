'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');
const url = process.env.DURABLE_TEST_DATABASE_URL;
const local = (() => { try { return ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname); } catch { return false; } })();

test('Schach-Treff username availability RPC: isolated PostgreSQL and grants', {skip: !local}, async () => {
  const admin = new Client({connectionString:url});
  const dbName = 'chessaz_available_' + randomBytes(6).toString('hex');
  const tempUrl = new URL(url); tempUrl.pathname='/' + dbName;
  let db,created=false;
  try {
    await admin.connect();
    await admin.query('CREATE DATABASE "' + dbName + '"'); created=true;
    db = new Client({connectionString:tempUrl.toString()}); await db.connect();
    await db.query(`DO $$ BEGIN
      BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END;
      IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role') THEN
        ALTER ROLE service_role BYPASSRLS;
      END IF;
    END $$;`);
    await db.query('CREATE TABLE public.profiles (id uuid PRIMARY KEY, username text UNIQUE NOT NULL)');
    await db.query("INSERT INTO public.profiles VALUES ('11111111-1111-4111-8111-111111111111','sonya25')");
    await db.query(readFileSync(join(__dirname,'../supabase/migrations/20261025173000_schach_treff_username_available.sql'),'utf8'));
    const cases = [
      ['newPlayer',true],['sonya25',false],['Sonya25',false],
      ['maxm',true],['a2',false],['a',false],['a'.repeat(31),false],
      ['9player',false],['two-hyphens',false],['white space',false],
      ['chessaz',false],['SchachTreff',false],['moderator',false],
      ['spieler',false],['user',false],['',false],[null,false]
    ];
    for(const [name,expected] of cases) {
      const r=await db.query('SELECT public.username_available($1) AS available',[name]);
      assert.equal(r.rows[0].available,expected,String(name));
    }
    for(const role of ['anon','authenticated']) {
      const r=await db.query("SELECT has_function_privilege($1,'public.username_available(text)','EXECUTE') AS allowed",[role]);
      assert.equal(r.rows[0].allowed,true);
    }
    const r=await db.query("SELECT has_function_privilege('service_role','public.username_available(text)','EXECUTE') AS allowed");
    assert.equal(r.rows[0].allowed,false);
  } finally {
    if (db) await db.end();
    if (created) await admin.query('DROP DATABASE "' + dbName + '" WITH (FORCE)');
    await admin.end();
  }
});
