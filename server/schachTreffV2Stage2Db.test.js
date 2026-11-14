'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');

const url = process.env.DURABLE_TEST_DATABASE_URL;
test('Schach-Treff v2 stage 2: direct messages, blocking, positions, seek controls and chat game results', { skip: !url, timeout: 30000 }, async t => {
  const db = await isolatedPostgres(url);
  t.after(() => db.close());
  const [alice, bob, carol, dave, outsider] = Array.from({ length: 5 }, randomUUID);

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
  for (const [id, name] of [[alice, 'Alice'], [bob, 'Bob'], [carol, 'Carol'], [dave, 'Dave'], [outsider, 'Olaf']]) {
    await db.pool.query('INSERT INTO public.profiles(id,username) VALUES($1,$2)', [id, name]);
  }
  for (const file of [
    '20261021000000_chessaz_deutsch_community_foundation.sql',
    '20261026140945_schach_treff_challenges.sql',
    '20261026142707_schach_treff_private_rooms.sql',
    '20261026145050_schach_treff_summary_and_challenge_recovery.sql',
    '20261026145100_schach_treff_invite_limits.sql',
    '20261105154705_schach_treff_moderation.sql',
    '20261112050000_schach_treff_v2_reactions_threads_feedback.sql',
    '20261112070000_schach_treff_v2_stage2_dm_positions_results.sql',
  ]) await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations', file), 'utf8'));

  const [{ id: general }] = (await db.pool.query("SELECT id FROM public.chess_clubs WHERE slug='chessaz-deutsch'")).rows;
  for (const user of [alice, bob, carol, dave]) {
    await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [general, user]);
  }
  const [{ create_club_room: room }] = await rpc(alice, 'create_club_room', ['Alice Verein']);
  await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [room, carol]);
  const post = async (user, club, body, fen = null) => (await authed(user,
    'INSERT INTO public.chess_club_messages(club_id,author_id,body,fen) VALUES($1,$2,$3,$4) RETURNING id', [club, user, body, fen]))[0].id;

  await t.test('direct chats are private, idempotent and respect "who can message me"', async () => {
    const [{ open_direct_chat: dm }] = await rpc(alice, 'open_direct_chat', [bob]);
    const [{ open_direct_chat: again }] = await rpc(bob, 'open_direct_chat', [alice]);
    assert.equal(again, dm, 'one conversation per pair');
    await post(alice, dm, 'Hallo Bob');
    assert.equal((await authed(bob, 'SELECT body FROM public.chess_club_messages WHERE club_id=$1', [dm]))[0].body, 'Hallo Bob');
    assert.deepEqual(await authed(carol, 'SELECT id FROM public.chess_club_messages WHERE club_id=$1', [dm]), []);
    assert.deepEqual(await authed(carol, 'SELECT id FROM public.chess_clubs WHERE id=$1', [dm]), []);
    await assert.rejects(authed(carol, 'INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [dm, carol]), denied);
    await assert.rejects(rpc(carol, 'create_club_invite', [dm]), denied);
    const rooms = await authed(alice, "SELECT id FROM public.chess_clubs WHERE kind='room'");
    assert.ok(!rooms.some(row => row.id === dm), 'direct chats are not listed as club rooms');
    await assert.rejects(rpc(alice, 'open_direct_chat', [alice]), denied);
    await assert.rejects(as('anon', null, 'SELECT public.open_direct_chat($1)', [bob]), denied);

    await rpc(dave, 'set_chat_settings', ['none', false]);
    await assert.rejects(rpc(alice, 'open_direct_chat', [dave]), /dm_not_allowed/);
    await rpc(dave, 'set_chat_settings', ['clubs', false]);
    await assert.rejects(rpc(alice, 'open_direct_chat', [dave]), /dm_not_allowed/, 'no shared club room');
    await db.pool.query('INSERT INTO public.chess_club_members(club_id,user_id) VALUES($1,$2)', [room, dave]);
    const [{ open_direct_chat: daveChat }] = await rpc(alice, 'open_direct_chat', [dave]);
    await post(alice, daveChat, 'Wir sind im selben Verein');
    await rpc(dave, 'set_chat_settings', ['none', false]);
    await assert.rejects(post(alice, daveChat, 'Jetzt nicht mehr'), /dm_not_allowed/);
    await post(dave, daveChat, 'Ich darf trotzdem antworten');
    await assert.rejects(rpc(dave, 'set_chat_settings', ['friends', false]), /invalid_settings/);
    assert.deepEqual(await authed(alice, 'SELECT * FROM public.chess_chat_settings'), [], 'settings are private');
  });

  await t.test('blocking stops direct messages in both directions until removed', async () => {
    const [{ open_direct_chat: dm }] = await rpc(alice, 'open_direct_chat', [bob]);
    await authed(bob, 'INSERT INTO public.chess_user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [bob, alice]);
    await assert.rejects(post(alice, dm, 'Hallo?'), /blocked/);
    await assert.rejects(post(bob, dm, 'Auch nicht'), /blocked/);
    await assert.rejects(rpc(alice, 'open_direct_chat', [bob]), /blocked/);
    await assert.rejects(authed(alice, 'INSERT INTO public.chess_user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [bob, carol]), denied);
    assert.deepEqual(await authed(alice, 'SELECT * FROM public.chess_user_blocks'), [], 'blocks are visible only to the blocker');
    await post(alice, general, 'Der allgemeine Chat bleibt offen');
    await authed(bob, 'DELETE FROM public.chess_user_blocks WHERE blocker_id=$1 AND blocked_id=$2', [bob, alice]);
    await post(alice, dm, 'Wieder da');
  });

  await t.test('positions are validated FEN and vanish with a deleted message', async () => {
    const fen = 'rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq - 1 6';
    const id = await post(alice, general, 'Najdorf 6.Lg5', fen);
    assert.equal((await authed(bob, 'SELECT fen FROM public.chess_club_messages WHERE id=$1', [id]))[0].fen, fen);
    for (const bad of ['not a fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1', fen + "'; DROP TABLE x; --"]) {
      await assert.rejects(post(alice, general, 'Bad', bad), error => error.code === '23514');
    }
    await rpc(alice, 'delete_club_message', [id]);
    assert.deepEqual((await db.pool.query('SELECT fen, body FROM public.chess_club_messages WHERE id=$1', [id])).rows, [{ fen: null, body: null }]);
  });

  await t.test('seek accepts 1+0, 3+0 and 15+10 and still rejects other controls', async () => {
    for (const control of ['1+0', '3+0', '15+10']) {
      await as('service_role', null, "SELECT public.club_challenge_action('create',$1,$2,NULL,$3)", [carol, general, control]);
      await db.pool.query("UPDATE public.chess_club_challenges SET status='cancelled' WHERE created_by=$1", [carol]);
    }
    await assert.rejects(as('service_role', null, "SELECT public.club_challenge_action('create',$1,$2,NULL,'2+1')", [carol, general]), /invalid_time_control/);
  });

  await t.test('finished chat-challenge games are shown to members unless a player opts out', async () => {
    await as('service_role', null, "SELECT public.club_challenge_action('create',$1,$2,NULL,'3+2')", [alice, general]);
    const [{ id: challenge, message_id: message }] = (await db.pool.query(
      "SELECT id, message_id FROM public.chess_club_challenges WHERE created_by=$1 AND status='open'", [alice])).rows;
    await as('service_role', null, "SELECT public.club_challenge_action('accept',$1,NULL,$2)", [bob, challenge]);
    const roomId = randomUUID();
    await db.pool.query('UPDATE public.chess_club_challenges SET room_id=$1 WHERE id=$2', [roomId, challenge]);
    await db.pool.query(`INSERT INTO public.matches(source_room_id,white_id,black_id,winner_id,winner_color,status,result,termination_reason,time_control,initial_time,increment,pgn,completed_at)
      VALUES($1,$2,$3,$2,'w','completed','1-0','checkmate','3+2',180,2,'1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',now())`, [roomId, alice, bob]);
    const rows = await rpc(carol, 'club_chat_game_results', [general, null]);
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0], completed_at: undefined, match_id: undefined }, {
      challenge_id: challenge, message_id: message, match_id: undefined, white_id: alice, black_id: bob,
      white_name: 'Alice', black_name: 'Bob', result: '1-0', termination_reason: 'checkmate', time_control: '3+2',
      completed_at: undefined, pgn: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0', initial_fen: null,
    });
    assert.deepEqual(await rpc(outsider, 'club_chat_game_results', [general, null]), [], 'non-members see nothing');
    assert.deepEqual(await rpc(carol, 'club_chat_game_results', [general, '2099-01-01']), []);
    await rpc(bob, 'set_chat_settings', ['all', true]);
    assert.deepEqual(await rpc(carol, 'club_chat_game_results', [general, null]), [], 'opt-out hides the game');
    await rpc(bob, 'set_chat_settings', ['all', false]);
    assert.equal((await rpc(carol, 'club_chat_game_results', [general, null])).length, 1);
    await assert.rejects(authed(carol, 'SELECT pgn FROM public.matches'), denied);
  });
});
