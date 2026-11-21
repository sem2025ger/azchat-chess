'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const { bergerSchedule } = require('./teamRoundRobin');

const rules = {
  board_count: 2, home_white_board_one: true, win_points: 2, draw_points: 1,
  loss_points: 0, forfeit_win_units: 2, forfeit_loss_units: 0,
};
const migrations = [
  '20261105221809_team_tournaments_m1.sql',
  '20261106034400_team_tournaments_m3_foundation.sql',
  '20261111030000_team_tournaments_open_create.sql',
  '20261122230000_team_tournaments_online_foundation.sql',
];
const commandSql = 'SELECT public.team_tournament_m3_command($1,$2,$3,$4) AS data';
const tickSql = 'SELECT public.team_tournament_m3_tick($1,$2) AS data';

test('M3 online foundation on isolated PostgreSQL', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL,
  timeout: 60000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  t.after(() => db.close());
  const { pool } = db;
  const [owner, member, otherMember, stranger, ...players] = Array.from({ length: 16 }, randomUUID);
  const captains = players.slice(0, 3);
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const deadline = new Date(Date.now() + 1_800_000).toISOString();
  await pool.query(`CREATE SCHEMA auth;
    CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA auth, private TO anon, authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    ALTER TABLE public.profiles ADD COLUMN username text;
    GRANT SELECT ON public.profiles TO authenticated;`);
  await pool.query(`INSERT INTO public.profiles(id,username)
    SELECT id, 'fixture_' || ordinality FROM unnest($1::uuid[]) WITH ORDINALITY AS actors(id,ordinality)`,
  [[owner, member, otherMember, stranger, ...players]]);
  for (const migration of migrations.slice(0, -1)) {
    await pool.query(readFileSync(join(__dirname, '../supabase/migrations', migration), 'utf8'));
  }
  await pool.query('INSERT INTO public.team_tournament_organizers(user_id) VALUES($1)', [owner]);

  async function transaction(role, who, run) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ' + role);
      if (who) await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [who]);
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async function service(sql, params) {
    return transaction('service_role', null, async client => (await client.query(sql, params)).rows[0].data);
  }
  const command = (actor, action, id, input = {}) => service(commandSql, [actor, action, id, input]);
  const create = (name, interval = 60, key = null, organizer = owner) => service(
    'SELECT public.team_tournament_m3_create($1,$2,$3,$4,$5,$6,$7,$8,$9) AS data',
    [organizer, name, rules, start, deadline, 2, 3, interval, key]);
  const open = (actor, name, key, closes = deadline, begins = start) => service(
    'SELECT public.team_tournament_m3_create_open($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS data',
    [actor, name, rules, begins, closes, 2, 3, 2, 60, key]);
  const edit = (actor, id, round, startsAt) => service(
    'SELECT public.team_tournament_m3_set_round_time($1,$2,$3,$4) AS data',
    [actor, id, round, startsAt]);
  const tick = (id, teams) => service(tickSql, [id, JSON.stringify(bergerSchedule(teams, rules))]);
  const expire = (id, client = pool) => client.query(
    "UPDATE public.team_tournament_m3_config SET registration_deadline = clock_timestamp() - interval '1 second' WHERE tournament_id=$1", [id]);
  const roster = async (entry, draft = false) => (await pool.query(
    'SELECT player_id,consented_at FROM public.team_tournament_m3_' + (draft ? 'revision_' : '') +
    'lineups WHERE entry_id=$1 ORDER BY board_no', [entry])).rows;
  const names = rows => rows.map(row => row.player_id);
  const conflict = message => ({ code: 'P0001', message });

  // Verify forward-only behavior with a tournament already on the old schema.
  const { id: legacy } = await service('SELECT public.team_tournament_m3_create($1,$2,$3,$4,$5,$6,$7) AS data',
    [owner, 'Existing tournament', rules, start, deadline, 2, 3]);
  await pool.query(readFileSync(join(__dirname, '../supabase/migrations', migrations.at(-1)), 'utf8'));

  async function register(id, count = 3) {
    const entries = [];
    for (let index = 0; index < count; index++) {
      const captain = captains[index];
      const token_hash = createHash('sha256').update(id + index).digest('hex');
      await command(owner, 'create_invite', id, { club_name: 'Club ' + index, token_hash });
      const { entry_id } = await command(captain, 'redeem_invite', id, { token_hash });
      const lineup = players.slice(3 + 2 * index, 5 + 2 * index);
      await command(captain, 'set_lineup', id, { players: lineup });
      for (const player of lineup) await command(player, 'consent', id, { entry_id });
      await command(captain, 'submit', id);
      entries.push(entry_id);
    }
    return entries;
  }

  await t.test('publication timestamps every round from the configured start, with undated compatibility', async () => {
    const { id } = await create('Three rounds');
    const entries = await register(id);
    assert.equal((await pool.query('SELECT count(*)::int n FROM public.team_tournament_rounds WHERE tournament_id=$1', [id])).rows[0].n, 0);
    await expire(id);
    assert.equal((await tick(id, entries)).status, 'published');
    const rounds = (await pool.query('SELECT round_no,starts_at FROM public.team_tournament_rounds WHERE tournament_id=$1 ORDER BY round_no', [id])).rows;
    assert.deepEqual(rounds.map(row => row.starts_at.toISOString()),
      [0, 1, 2].map(hour => new Date(Date.parse(start) + hour * 3_600_000).toISOString()));
    const firstPlayer = (await pool.query(`SELECT l.player_id FROM public.team_tournament_matches m
      JOIN public.team_tournament_m3_lineups l ON l.entry_id=m.home_team_id
      WHERE m.tournament_id=$1 AND m.round_no=1 AND l.board_no=1`, [id])).rows[0].player_id;
    const board = await transaction('authenticated', firstPlayer, async client =>
      (await client.query('SELECT public.team_tournament_m3_my_board() AS data')).rows[0].data);
    assert.equal(new Date(board.starts_at).toISOString(), start);

    const legacyEntries = await register(legacy, 2);
    await expire(legacy);
    await pool.query("UPDATE public.team_tournament_m3_config SET starts_at = starts_at - interval '10 minutes' WHERE tournament_id=$1", [legacy]);
    await tick(legacy, legacyEntries);
    assert.equal((await pool.query('SELECT starts_at FROM public.team_tournament_rounds WHERE tournament_id=$1', [legacy])).rows[0].starts_at, null);
    await assert.rejects(edit(owner, legacy, 1, start), conflict('round_time_locked'));
    const undatedBoard = await transaction('authenticated', players[3], async client =>
      (await client.query('SELECT public.team_tournament_m3_my_board() AS data')).rows[0].data);
    assert.equal(undatedBoard.tournament_id, legacy);
    assert.equal(Object.hasOwn(undatedBoard, 'starts_at'), false);
  });

  await t.test('only the event organizer can edit an unstarted round and its time must stay between neighbors', async () => {
    const { id } = await create('Editable rounds');
    const entries = await register(id);
    await expire(id);
    await tick(id, entries);
    const at = minutes => new Date(Date.parse(start) + minutes * 60000).toISOString();
    await assert.rejects(edit(captains[0], id, 2, at(65)), { code: '42501' });
    await assert.rejects(transaction('authenticated', owner, client => client.query(
      'SELECT public.team_tournament_m3_set_round_time($1,$2,$3,$4)', [owner, id, 2, at(65)])), { code: '42501' });
    await assert.rejects(edit(owner, id, 4, at(180)), { code: 'P0002' });
    for (const minutes of [-1, 0, 120, 121]) {
      await assert.rejects(edit(owner, id, 2, at(minutes)), conflict('round_time_order'));
    }
    const edited = await edit(owner, id, 2, at(65));
    assert.equal(new Date(edited.starts_at).toISOString(), at(65));
    await pool.query("UPDATE public.team_tournament_rounds SET starts_at = clock_timestamp() - interval '1 second' WHERE tournament_id=$1 AND round_no=1", [id]);
    await assert.rejects(edit(owner, id, 1, at(1)), conflict('round_time_locked'));
  });

  await t.test('organizer cannot move an unstarted round into the past and its stored time stays unchanged', async () => {
    const { id } = await create('Past round time');
    const entries = await register(id);
    await expire(id);
    await tick(id, entries);

    const past = new Date(Date.now() - 60_000).toISOString();
    await assert.rejects(edit(owner, id, 1, past), conflict('round_time_past'));
    const { rows: [round] } = await pool.query(
      'SELECT starts_at FROM public.team_tournament_rounds WHERE tournament_id=$1 AND round_no=1', [id]);
    assert.equal(round.starts_at.toISOString(), start);
  });

  await t.test('revision protects the place, preserves consent by player, and replaces only after consent', async () => {
    const { id } = await create('Full event');
    const [entry, second] = await register(id);
    const official = await roster(entry);
    const [oldFirst, oldSecond] = names(official);
    const newPlayer = players[10];
    const assigned = async () => (await pool.query(`SELECT team.id, seed, user_id, submitted_at
      FROM public.team_tournament_teams team
      JOIN public.team_tournament_roles role ON role.team_id=team.id
      JOIN public.team_tournament_m3_entries entry ON entry.id=team.id WHERE team.id=$1`, [entry])).rows;
    const originalAssignment = await assigned();
    await assert.rejects(command(captains[0], 'submit_revision', id), conflict('revision_missing'));
    await command(captains[0], 'set_lineup', id, { players: [] });
    await assert.rejects(command(captains[0], 'submit_revision', id), conflict('revision_incomplete'));
    await command(captains[0], 'set_lineup', id, { players: [oldSecond, oldFirst] });
    const moved = await roster(entry, true);
    assert.deepEqual(moved, [official[1], official[0]]);
    await command(captains[0], 'set_lineup', id, { players: [oldSecond, newPlayer] });
    assert.deepEqual(await roster(entry), official);
    assert.deepEqual(await assigned(), originalAssignment);
    await assert.rejects(command(captains[0], 'submit_revision', id), conflict('revision_incomplete'));

    const rowsFor = (player, sql, params) => transaction('authenticated', player, async client =>
      (await client.query(sql, params)).rows);
    assert.deepEqual(await rowsFor(newPlayer, 'SELECT id FROM public.team_tournament_m3_entries WHERE id=$1', [entry]), [{ id: entry }]);
    assert.deepEqual(await rowsFor(newPlayer, 'SELECT player_id FROM public.team_tournament_m3_revision_lineups'), [{ player_id: newPlayer }]);
    assert.deepEqual(await rowsFor(stranger, 'SELECT player_id FROM public.team_tournament_m3_revision_lineups'), []);
    await assert.rejects(transaction('anon', null, client =>
      client.query('SELECT player_id FROM public.team_tournament_m3_revision_lineups')), { code: '42501' });

    await command(newPlayer, 'consent', id, { entry_id: entry });
    await command(captains[0], 'set_lineup', id, { players: [newPlayer, oldSecond] });
    assert.ok((await roster(entry, true)).every(row => row.consented_at));
    await command(captains[0], 'submit_revision', id);
    assert.deepEqual(names(await roster(entry)), [newPlayer, oldSecond]);
    assert.deepEqual(await assigned(), originalAssignment);
    assert.deepEqual(await roster(entry, true), []);

    const occupied = names(await roster(second))[0];
    await command(captains[0], 'set_lineup', id, { players: [newPlayer, occupied] });
    await command(occupied, 'consent', id, { entry_id: entry });
    await assert.rejects(command(captains[0], 'submit_revision', id), conflict('player_already_registered'));
    assert.deepEqual(names(await roster(entry)), [newPlayer, oldSecond]);

    await command(captains[0], 'copy_previous', id);
    assert.deepEqual(names(await roster(entry, true)), [oldFirst, oldSecond]);
    assert.equal((await roster(entry, true))[0].consented_at, null);
    assert.ok((await roster(entry, true))[1].consented_at);
    assert.deepEqual(await assigned(), originalAssignment);

    await command(captains[0], 'withdraw', id);
    assert.deepEqual(await assigned(), []);
    assert.deepEqual(await roster(entry, true), []);
    assert.deepEqual(names(await roster(entry)), [newPlayer, oldSecond]);
  });

  // Observe both sessions blocked on the event lock instead of relying on a sleep.
  async function waitForLock(count) {
    for (let attempt = 0; attempt < 160; attempt++) {
      const { rows: [row] } = await pool.query(`SELECT count(*)::int n FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'`);
      if (row.n >= count) return;
      await delay(10);
    }
    assert.fail('Expected blocked event queries');
  }

  for (const action of ['submit_revision', 'withdraw']) {
    await t.test(action + ' loses to the deadline and unfinished drafts are discarded', async () => {
      const { id } = await create(action + ' too late');
      const entries = await register(id);
      const [entry] = entries;
      const official = names(await roster(entry));
      await command(captains[0], 'set_lineup', id, { players: [...official].reverse() });
      let pendingAction, publication;
      await transaction('service_role', null, async client => {
        await client.query('SELECT id FROM public.team_tournaments WHERE id=$1 FOR UPDATE', [id]);
        await expire(id, client);
        pendingAction = assert.rejects(command(captains[0], action, id),
          action === 'submit_revision' ? conflict('revision_closed') : { code: '55000' });
        publication = tick(id, entries);
        await waitForLock(2);
      });
      assert.equal((await publication).status, 'published');
      await pendingAction;
      assert.deepEqual(names(await roster(entry)), official);
      assert.deepEqual(await roster(entry, true), []);
      assert.equal((await pool.query('SELECT revision_pending FROM public.team_tournament_m3_entries WHERE id=$1', [entry])).rows[0].revision_pending, false);
    });

    await t.test(action + ' that acquires the lock before deadline is reflected in publication', async () => {
      const { id } = await create(action + ' wins');
      const entries = await register(id, 2);
      const [entry] = entries;
      const revised = names(await roster(entry)).reverse();
      await command(captains[0], 'set_lineup', id, { players: revised });
      let publication;
      await transaction('service_role', null, async client => {
        await client.query(commandSql, [captains[0], action, id, {}]);
        await expire(id, client);
        // Pass the stale two-team schedule for withdraw, as can happen between
        // the API's team read and tick. The database must cancel for one team.
        publication = tick(id, entries);
        await waitForLock(1);
      });
      assert.equal((await publication).status, action === 'withdraw' ? 'cancelled' : 'published');
      if (action === 'submit_revision') assert.deepEqual(names(await roster(entry)), revised);
      else assert.equal((await pool.query('SELECT id FROM public.team_tournament_teams WHERE id=$1', [entry])).rowCount, 0);
    });
  }

  await t.test('concurrent creates share one event and replay despite the active-event limit', async () => {
    const requestId = randomUUID();
    const [first, second] = await Promise.all([
      open(member, 'Concurrent open cup', requestId), open(member, 'Concurrent open cup', requestId),
    ]);
    assert.equal(first.id, second.id);
    assert.equal((await pool.query("SELECT count(*)::int n FROM public.team_tournaments WHERE name='Concurrent open cup'")).rows[0].n, 1);
    await open(member, 'Second active cup', randomUUID());
    assert.equal((await open(member, 'Concurrent open cup', requestId)).id, first.id);
    await assert.rejects(open(member, 'Different payload', requestId), conflict('idempotency_conflict'));
    await assert.rejects(open(member, 'Over the limit', randomUUID()), conflict('create_limit'));
    assert.notEqual((await open(otherMember, 'Concurrent open cup', requestId)).id, first.id);
  });

  await t.test('allowlisted requests also deduplicate and verify the complete payload and role', async () => {
    const requestId = randomUUID();
    const [first, second] = await Promise.all([
      create('Allowlisted cup', 10, requestId), create('Allowlisted cup', 10, requestId),
    ]);
    assert.equal(first.id, second.id);
    assert.equal((await pool.query("SELECT count(*)::int n FROM public.team_tournaments WHERE name='Allowlisted cup'")).rows[0].n, 1);
    await assert.rejects(create('Allowlisted cup', 11, requestId), conflict('idempotency_conflict'));
    await assert.rejects(create('Invalid', 9, randomUUID()), { code: '22023' });
    await assert.rejects(create('Denied', 60, randomUUID(), member), { code: '42501' });
    const soon = new Date(Date.now() + 1200).toISOString();
    const expiringRequest = randomUUID();
    const expiring = await open(otherMember, 'Deadline passes', expiringRequest, soon);
    await delay(Math.max(0, Date.parse(soon) - Date.now() + 20));
    assert.equal((await open(otherMember, 'Deadline passes', expiringRequest, soon)).id, expiring.id);
    await assert.rejects(open(otherMember, 'New past deadline', randomUUID(), soon), conflict('invalid_time'));
  });
});
