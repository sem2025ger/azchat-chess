'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');

const url = process.env.DURABLE_TEST_DATABASE_URL;
test('Schach-Treff moderation enforces membership, redaction, quotas and read state in PostgreSQL', { skip: !url, timeout: 30000 }, async t => {
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
  const disallowed = error => error.code === '42501';
  const read = (user, id) => authed(user, 'SELECT body, deleted_by, hidden_at FROM public.chess_club_messages WHERE id=$1', [id]);
  const rpc = (user, fn, args) => authed(user, 'SELECT * FROM public.' + fn + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ')', args);
  const unread = async user => Object.fromEntries((await rpc(user, 'get_club_unread_counts', [])).map(row => [row.club_id, Number(row.unread_count)]));

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
    '20261105160000_schach_treff_moderation.sql',
  ]) await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations', file), 'utf8'));

  const [{ id: general }] = (await db.pool.query("SELECT id FROM public.chess_clubs WHERE slug='chessaz-deutsch'")).rows;
  const [{ create_club_room: room }] = await rpc(admin, 'create_club_room', ['Private chat']);
  for (const club of [general, room]) {
    for (const [user, role] of [[admin, 'admin'], [moderator, 'moderator'], [author, 'member'], [member, 'member'], [second, 'member'], [third, 'member']]) {
      await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [club, user, role]);
    }
  }
  const post = async (user, text, club = room) => (await authed(user,
    'INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES($1,$2,$3) RETURNING id', [club, user, text]))[0].id;


  await t.test('deletion respects roles, strips bodies, and protects challenge references', async () => {
    const id = await post(author, 'Own message');
    await assert.rejects(rpc(member, 'delete_club_message', [id]), disallowed);
    await assert.rejects(rpc(outsider, 'delete_club_message', [id]), disallowed);
    await rpc(author, 'delete_club_message', [id]);
    await rpc(author, 'delete_club_message', [id]);
    assert.deepEqual(await read(member, id), [{ body: null, deleted_by: author, hidden_at: null }]);
    assert.equal((await read(admin, id))[0].body, null);

    const formerMemberId = await post(author, 'Author can remove an old message after leaving');
    await authed(author, 'DELETE FROM public.chess_club_members WHERE club_id=$1 AND user_id=$2', [room, author]);
    assert.deepEqual(await read(author, formerMemberId), []);
    await rpc(author, 'delete_club_message', [formerMemberId]);
    assert.equal((await read(admin, formerMemberId))[0].body, null);
    await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [room, author]);

    for (const actor of [moderator, admin]) {
      const id = await post(author, 'Moderated message');
      await rpc(actor, 'delete_club_message', [id]);
      assert.equal((await read(author, id))[0].deleted_by, actor);
    }

    // The real service RPC creates and links the challenge in its own transaction.
    await as('service_role', null, "SELECT public.club_challenge_action('create',$1,$2,NULL,'3+2')", [author, general]);
    const [{ message_id: challengeId }] = (await db.pool.query(
      'SELECT message_id FROM public.chess_club_challenges WHERE club_id=$1', [general])).rows;
    await assert.rejects(rpc(author, 'delete_club_message', [challengeId]), /has_challenge/);
    await assert.rejects(rpc(admin, 'delete_club_message', [challengeId]), /has_challenge/);
    await assert.rejects(authed(author, 'UPDATE public.chess_club_messages SET body=NULL WHERE id=$1', [id]), disallowed);
    await assert.rejects(authed(author,
      "INSERT INTO public.chess_club_messages(club_id,author_id,body,created_at) VALUES($1,$2,'bad','2099-01-01')",
      [room, author]), disallowed);
  });

  await t.test('three distinct reports hide the message and moderators can restore it', async () => {
    const id = await post(author, 'Reported message');
    await assert.rejects(rpc(author, 'report_club_message', [id, 'spam']), disallowed);
    await assert.rejects(rpc(outsider, 'report_club_message', [id, 'spam']), disallowed);
    await assert.rejects(rpc(member, 'report_club_message', [id, 'invalid']), /invalid_reason/);
    await rpc(member, 'report_club_message', [id, 'spam']);
    await assert.rejects(rpc(member, 'report_club_message', [id, 'other']), /already_reported/);
    await rpc(second, 'report_club_message', [id, 'abuse']);
    assert.equal((await read(member, id))[0].body, 'Reported message');
    await rpc(third, 'report_club_message', [id, 'other']);
    assert.deepEqual(await read(member, id), []);
    assert.deepEqual(await read(author, id), []);
    assert.equal((await read(moderator, id))[0].body, 'Reported message');
    assert.equal((await read(admin, id))[0].body, 'Reported message');
    assert.equal((await unread(member))[room], 0);
    assert.equal((await unread(moderator))[room], 1);
    await assert.rejects(rpc(member, 'list_club_message_reports', [room]), disallowed);
    await assert.rejects(rpc(member, 'restore_club_message', [id]), disallowed);
    const [report] = await rpc(moderator, 'list_club_message_reports', [room]);
    assert.equal(report.hidden, true);
    assert.deepEqual(report.reasons.sort(), ['abuse', 'other', 'spam']);
    await rpc(moderator, 'restore_club_message', [id]);
    assert.equal((await read(member, id))[0].body, 'Reported message');
    assert.deepEqual(await rpc(moderator, 'list_club_message_reports', [room]), []);
    await assert.rejects(rpc(member, 'report_club_message', [id, 'spam']), /already_reported/);
  });

  await t.test('report limit is serialized across concurrent requests', async () => {
    const ids = [];
    for (let n = 0; n < 21; n++) ids.push(await post(author, 'Quota check ' + n));
    const results = await Promise.allSettled(ids.map(id => rpc(admin, 'report_club_message', [id, 'spam'])));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 20);
    assert.equal(results.find(result => result.status === 'rejected').reason.message, 'report_limit');
    const [report] = await rpc(moderator, 'list_club_message_reports', [room]);
    await rpc(moderator, 'delete_club_message', [report.message_id]);
    assert.equal((await read(admin, report.message_id))[0].body, null);
    assert.ok(!(await rpc(moderator, 'list_club_message_reports', [room])).some(row => row.message_id === report.message_id));
  });

  await t.test('read state is scoped, excludes own messages, and cannot move backwards', async () => {
    const before = await unread(member);
    const first = await post(member, 'Own unread exclusion');
    assert.deepEqual(await unread(member), before);
    const last = await post(author, 'Unread private');
    const publicId = await post(author, 'Unread general', general);
    assert.equal((await unread(member))[room], before[room] + 1);
    assert.equal((await unread(member))[general], before[general] + 1);
    assert.deepEqual(await unread(outsider), {});
    await assert.rejects(rpc(member, 'mark_club_read', [room, publicId]), disallowed);
    await assert.rejects(rpc(outsider, 'mark_club_read', [room, last]), disallowed);
    const newer = await post(author, 'Arrived while marking read');
    await rpc(member, 'mark_club_read', [room, last]);
    await rpc(member, 'mark_club_read', [room, first]);
    assert.equal((await unread(member))[room], 1);
    assert.equal((await unread(member))[general], before[general] + 1);
    await rpc(member, 'mark_club_read', [room, newer]);
    assert.equal((await unread(member))[room], 0);
  });

  await t.test('only a private room admin can clear messages or revoke invite links', async () => {
    await as('service_role', null, "SELECT public.club_challenge_action('create',$1,$2,NULL,'3+2')", [author, room]);
    const [{ message_id: challengeId }] = (await db.pool.query(
      'SELECT message_id FROM public.chess_club_challenges WHERE club_id=$1', [room])).rows;
    const id = await post(author, 'Message in private room');
    const other = await post(author, 'Message in general room', general);
    const links = [];
    for (let i = 0; i < 2; i++) links.push((await rpc(admin, 'create_club_invite', [room]))[0].create_club_invite);
    for (const actor of [author, moderator, outsider]) {
      await assert.rejects(rpc(actor, 'clear_club_chat', [room]), disallowed);
      await assert.rejects(rpc(actor, 'revoke_club_invites', [room]), disallowed);
    }
    await assert.rejects(rpc(admin, 'clear_club_chat', [general]), /not_allowed/);
    await rpc(admin, 'clear_club_chat', [room]);
    assert.deepEqual(await read(member, id), [{ body: null, deleted_by: admin, hidden_at: null }]);
    assert.equal((await read(member, challengeId))[0].body, null);
    assert.equal((await read(member, other))[0].body, 'Message in general room');
    assert.equal((await unread(member))[room], 0);
    await rpc(admin, 'revoke_club_invites', [room]);
    for (const token of links) await assert.rejects(rpc(outsider, 'join_club_by_invite', [token]), /invite_expired/);
    const [{ create_club_invite: next }] = await rpc(admin, 'create_club_invite', [room]);
    assert.equal((await rpc(outsider, 'join_club_by_invite', [next]))[0].join_club_by_invite, room);
  });

  await t.test('no anonymous access or direct table writes', async () => {
    for (const table of ['chess_club_messages', 'chess_club_message_reports', 'chess_club_read_state']) {
      await assert.rejects(as('anon', null, 'SELECT * FROM public.' + table), disallowed);
    }
    for (const fn of ['delete_club_message(NULL)', 'report_club_message(NULL,NULL)', 'list_club_message_reports(NULL)',
      'restore_club_message(NULL)', 'mark_club_read(NULL,NULL)', 'get_club_unread_counts()', 'clear_club_chat(NULL)', 'revoke_club_invites(NULL)']) {
      await assert.rejects(as('anon', null, 'SELECT public.' + fn), disallowed);
    }
    await assert.rejects(authed(member, 'SELECT * FROM public.chess_club_message_reports'), disallowed);
    await assert.rejects(authed(member, 'SELECT * FROM public.chess_club_read_state'), disallowed);
    await assert.rejects(authed(member, 'INSERT INTO public.chess_club_read_state VALUES ($1,$2,now())', [room, member]), disallowed);
    await assert.rejects(authed(member, "INSERT INTO public.chess_club_message_reports VALUES ($1,$2,'spam')", [room, member]), disallowed);
  });
});
