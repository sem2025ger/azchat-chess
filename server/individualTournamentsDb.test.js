'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');

test('individual tournament drafts are private and reject forged or invalid inserts', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL,
  timeout: 60000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  t.after(() => db.close());
  const owner = randomUUID();
  const other = randomUUID();
  const draft = randomUUID();
  await db.pool.query(`CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb
    $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (auth.jwt()->>'sub')::uuid
    $$;`);
  await db.pool.query('INSERT INTO auth.users VALUES ($1),($2)', [owner, other]);
  await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations/20261124045000_individual_tournament_drafts.sql'), 'utf8'));

  async function as(actor, sql, params = [], anonymous = false) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(actor ? 'SET LOCAL ROLE authenticated' : 'SET LOCAL ROLE anon');
      await client.query("SELECT set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: actor, is_anonymous: anonymous }),
      ]);
      return (await client.query(sql, params)).rows;
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  const insert = `INSERT INTO public.individual_tournament_drafts (id, organizer_id, name, starts_at, max_players)
    VALUES ($1,$2,'Blitz Cup',statement_timestamp() + $3::interval,$4) RETURNING id`;
  assert.deepEqual(await as(owner, insert, [draft, owner, '1 day', 16]), [{ id: draft }]);
  await assert.rejects(as(other, insert, [draft, owner, '1 day', 16]), { code: '42501' });
  await assert.rejects(as(owner, insert, [draft, owner, '-1 day', 16]), { code: '42501' });
  await assert.rejects(as(owner, insert, [draft, owner, '1 day', 129]), { code: '23514' });
  await assert.rejects(as(owner, insert, [draft, owner, '1 day', 16], true), { code: '42501' });

  await db.pool.query(insert, [draft, owner, '1 day', 16]);
  const select = 'SELECT id FROM public.individual_tournament_drafts';
  assert.deepEqual(await as(owner, select), [{ id: draft }]);
  assert.deepEqual(await as(other, select), []);
  assert.deepEqual(await as(owner, select, [], true), []);
  await assert.rejects(as(null, select), { code: '42501' });
  await assert.rejects(as(owner, 'DELETE FROM public.individual_tournament_drafts'), { code: '42501' });
});
