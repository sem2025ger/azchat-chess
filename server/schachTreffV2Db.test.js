'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');

const url = process.env.DURABLE_TEST_DATABASE_URL;
test('Schach-Treff v2 reactions, threads and feedback enforce membership and limits in PostgreSQL', { skip: !url, timeout: 30000 }, async t => {
  const db = await isolatedPostgres(url);
  t.after(() => db.close());
  const [admin, moderator, author, member, second, third, outsider] = Array.from({ length: 7 }, randomUUID);

  async function as(role, user, sql, args = []) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ' + role);
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
      const result = await client.query(sql, args);
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  const authed = (user, sql, args) => as('authenticated', user, sql, args);
  const rpc = (user, fn, args) => authed(user, 'SELECT * FROM public.' + fn + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ')', args);
  const denied = error => error.code === '42501';

  await db.pool.query(`
    ALTER TABLE public.profiles ADD COLUMN username text;
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  for (const id of [admin, moderator, author, member, second, third, outsider]) {
    await db.pool.query('INSERT INTO public.profiles(id,username) VALUES($1,$2)', [id, 'Player-' + id]);
  }
  for (const file of [
    '20261021000000_chessaz_deutsch_community_foundation.sql',
    '20261026140945_schach_treff_challenges.sql',
    '20261026142707_schach_treff_private_rooms.sql',
    '20261026145050_schach_treff_summary_and_challenge_recovery.sql',
    '20261026145100_schach_treff_invite_limits.sql',
    '20261105154705_schach_treff_moderation.sql',
    '20261112050000_schach_treff_v2_reactions_threads_feedback.sql',
  ]) await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations', file), 'utf8'));

  const [{ id: general }] = (await db.pool.query("SELECT id FROM public.chess_clubs WHERE slug='chessaz-deutsch'")).rows;
  const [{ create_club_room: room }] = await rpc(admin, 'create_club_room', ['Private chat']);
  for (const club of [general, room]) {
    for (const [user, role] of [[admin, 'admin'], [moderator, 'moderator'], [author, 'member'], [member, 'member'], [second, 'member'], [third, 'member']]) {
      await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [club, user, role]);
    }
  }
  const post = async (user, text, club = general, parent = null) => (await authed(user,
    'INSERT INTO public.chess_club_messages(club_id,author_id,body,parent_id) VALUES($1,$2,$3,$4) RETURNING id',
    [club, user, text, parent]))[0].id;

  await t.test('threads stay one level deep inside the same room', async () => {
    const root = await post(author, 'Najdorf 6.Lg5?');
    const reply = await post(member, '6…e6', general, root);
    const rows = await authed(second, 'SELECT id FROM public.chess_club_messages WHERE parent_id=$1', [root]);
    assert.deepEqual(rows.map(row => row.id), [reply]);
    await assert.rejects(post(member, 'Nested', general, reply), /invalid_parent/);
    await assert.rejects(post(member, 'Other room', room, root), /invalid_parent/);
    await assert.rejects(post(outsider, 'Outsider', general, root), denied);
    await assert.rejects(authed(member, 'UPDATE public.chess_club_messages SET parent_id=NULL WHERE id=$1', [reply]), denied);
    await assert.rejects(db.pool.query('UPDATE public.chess_club_messages SET parent_id=NULL WHERE id=$1', [reply]), /invalid_parent/);
    await rpc(author, 'delete_club_message', [root]);
    await assert.rejects(post(member, 'Late reply', general, root), /invalid_parent/);
    assert.equal((await authed(second, 'SELECT body FROM public.chess_club_messages WHERE id=$1', [reply]))[0].body, '6…e6');
    await as('service_role', null, "SELECT public.club_challenge_action('create',$1,$2,NULL,'3+2')", [author, general]);
  });

  await t.test('reactions are member-only, own-only and limited to chess annotations', async () => {
    const id = await post(author, 'Brilliant sacrifice');
    const add = (user, reaction) => authed(user,
      'INSERT INTO public.chess_club_message_reactions(message_id,user_id,reaction) VALUES($1,$2,$3)', [id, user, reaction]);
    await add(member, '!!');
    await add(member, '!?');
    await add(second, '!!');
    await assert.rejects(add(member, '!!'), error => error.code === '23505');
    await assert.rejects(add(member, '??'), error => error.code === '23514');
    await assert.rejects(add(outsider, '!'), denied);
    await assert.rejects(authed(member,
      'INSERT INTO public.chess_club_message_reactions(message_id,user_id,reaction) VALUES($1,$2,$3)', [id, second, '!']), denied);
    const counts = async user => (await authed(user,
      'SELECT reaction, count(*)::int AS n FROM public.chess_club_message_reactions WHERE message_id=$1 GROUP BY reaction ORDER BY reaction', [id]));
    assert.deepEqual(await counts(third), [{ reaction: '!!', n: 2 }, { reaction: '!?', n: 1 }]);
    assert.deepEqual(await counts(outsider), []);
    await authed(second, 'DELETE FROM public.chess_club_message_reactions WHERE message_id=$1 AND user_id=$2', [id, member]);
    assert.equal((await counts(third))[0].n, 2, 'cannot remove another member reaction');
    await authed(member, "DELETE FROM public.chess_club_message_reactions WHERE message_id=$1 AND user_id=$2 AND reaction='!!'", [id, member]);
    assert.deepEqual(await counts(third), [{ reaction: '!!', n: 1 }, { reaction: '!?', n: 1 }]);

    for (const reporter of [member, second, third]) await rpc(reporter, 'report_club_message', [id, 'spam']);
    assert.deepEqual(await counts(third), [], 'hidden message reactions are hidden from members');
    assert.equal((await counts(moderator)).length, 2);
    await assert.rejects(add(admin, '!'), denied);
  });

  await t.test('feedback is write-only for members and rate limited', async () => {
    await rpc(member, 'submit_chessaz_feedback', ['Das Brett ist auf dem Handy zu klein', '/chat']);
    await assert.rejects(rpc(member, 'submit_chessaz_feedback', ['  ', null]), /invalid_feedback/);
    await assert.rejects(as('authenticated', null, "SELECT public.submit_chessaz_feedback('Anonymous idea')"), denied);
    await assert.rejects(as('anon', null, "SELECT public.submit_chessaz_feedback('Anonymous idea')"), denied);
    await assert.rejects(authed(member, 'SELECT * FROM public.chessaz_feedback'), denied);
    await assert.rejects(authed(member, "INSERT INTO public.chessaz_feedback(user_id,body) VALUES($1,'direct')", [member]), denied);
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, n) => rpc(second, 'submit_chessaz_feedback', ['Idee ' + n, null])));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 10);
    assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.message === 'feedback_limit'));
    const [{ n }] = (await db.pool.query('SELECT count(*)::int AS n FROM public.chessaz_feedback')).rows;
    assert.equal(n, 11);
    const [{ page }] = (await db.pool.query('SELECT page FROM public.chessaz_feedback WHERE user_id=$1', [member])).rows;
    assert.equal(page, '/chat');
  });
});
