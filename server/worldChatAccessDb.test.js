'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');

const url = process.env.DURABLE_TEST_DATABASE_URL;
test('World Chat and invitation-only Schach-Treff enforce membership in PostgreSQL', { skip: !url, timeout: 30000 }, async t => {
  const db = await isolatedPostgres(url);
  t.after(() => db.close());
  const [admin, existingMember, outsider] = Array.from({ length: 3 }, randomUUID);
  const migrationDir = join(__dirname, '../supabase/migrations');
  async function apply(file) {
    await db.pool.query(readFileSync(join(migrationDir, file), 'utf8'));
  }
  async function as(role, id, sql, params = []) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ' + role);
      await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
      const result = await client.query(sql, params);
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  const auth = (id, sql, params) => as('authenticated', id, sql, params);
  const rpc = (id, name, values) => auth(id, 'SELECT public.' + name + '(' + values.map((_, i) => '$' + (i + 1)).join(',') + ') AS value', values);
  const denied = error => error.code === '42501';

  await db.pool.query(`
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  for (const id of [admin, existingMember, outsider]) {
    await db.pool.query('INSERT INTO public.profiles(id) VALUES($1)', [id]);
  }
  for (const file of [
    '20261021000000_chessaz_deutsch_community_foundation.sql',
    '20261026142707_schach_treff_private_rooms.sql',
    '20261026145100_schach_treff_invite_limits.sql',
  ]) await apply(file);

  const [{ id: german }] = (await db.pool.query("SELECT id FROM public.chess_clubs WHERE slug='chessaz-deutsch'")).rows;
  await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id,role) VALUES($1,$2,$3)', [german, admin, 'admin']);
  await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [german, existingMember]);
  await db.pool.query('INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES($1,$2,$3)', [german, existingMember, 'Existing discussion']);
  await apply('20261117080000_world_chat_invite_only_schach_treff.sql');

  const [{ id: world }] = (await db.pool.query("SELECT id FROM public.chess_clubs WHERE slug='world-chat'")).rows;
  assert.notEqual(world, german);
  assert.deepEqual((await as('anon', null, 'SELECT slug FROM public.chess_clubs ORDER BY slug')).map(row => row.slug), ['world-chat']);
  assert.deepEqual((await auth(outsider, 'SELECT slug FROM public.chess_clubs ORDER BY slug')).map(row => row.slug), ['world-chat']);
  assert.equal((await auth(existingMember, 'SELECT count(*)::int AS n FROM public.chess_club_messages WHERE club_id=$1', [german]))[0].n, 1);
  await assert.rejects(auth(outsider, 'INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [german, outsider]), denied);
  await assert.rejects(auth(outsider, 'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES($1,$2,$3)', [german, outsider, 'No permission']), denied);
  await assert.rejects(rpc(existingMember, 'create_club_invite', [german]), denied);
  await assert.rejects(rpc(outsider, 'create_club_invite', [german]), denied);

  const [{ value: token }] = await rpc(admin, 'create_club_invite', [german]);
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.chess_club_invites WHERE club_id=$1', [german])).rows[0].n, 1);
  const [{ value: joined }] = await rpc(outsider, 'join_club_by_invite', [token]);
  assert.equal(joined, german);
  assert.deepEqual((await auth(outsider, 'SELECT slug FROM public.chess_clubs ORDER BY slug')).map(row => row.slug), ['chessaz-deutsch','world-chat']);
  assert.equal((await auth(outsider, 'SELECT count(*)::int AS n FROM public.chess_club_messages WHERE club_id=$1', [german]))[0].n, 1);

  await auth(outsider, 'INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [world, outsider]);
  await auth(outsider, 'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES($1,$2,$3)', [world, outsider, 'Hello world']);
  assert.equal((await auth(outsider, 'SELECT count(*)::int AS n FROM public.chess_club_messages WHERE club_id=$1', [world]))[0].n, 1);
  assert.equal((await auth(existingMember, 'SELECT count(*)::int AS n FROM public.chess_club_messages WHERE club_id=$1', [world]))[0].n, 0);
  await assert.rejects(auth(existingMember, 'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES($1,$2,$3)', [world, existingMember, 'No entry']), denied);

  const [{ value: privateRoom }] = await rpc(admin, 'create_club_room', ['Regional club']);
  const [{ value: roomToken }] = await rpc(admin, 'create_club_invite', [privateRoom]);
  assert.match(roomToken, /^[0-9a-f]{32}$/, 'existing private-room invitations still work');
  assert.equal((await db.pool.query('SELECT is_open FROM public.chess_clubs WHERE id=$1', [german])).rows[0].is_open, false);
});
