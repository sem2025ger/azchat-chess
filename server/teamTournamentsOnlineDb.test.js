'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const { bergerSchedule, calculateTable } = require('./teamRoundRobin');

const rules = {
  board_count: 2, home_white_board_one: true, win_points: 2, draw_points: 1,
  loss_points: 0, forfeit_win_units: 2, forfeit_loss_units: 0,
};
const migrations = [
  '20261105221809_team_tournaments_m1.sql',
  '20261106034400_team_tournaments_m3_foundation.sql',
  '20261111030000_team_tournaments_open_create.sql',
  '20261122230000_team_tournaments_online_foundation.sql',
  '20261122233000_team_tournaments_online_play.sql',
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
  assert.deepEqual(migrations, [...migrations].sort(), 'migration timestamps follow Supabase order');
  for (const migration of migrations.slice(0, -2)) {
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
  await pool.query(readFileSync(join(__dirname, '../supabase/migrations', migrations.at(-2)), 'utf8'));
  const reportedKey = randomUUID();
  const existingReported = await create('Reported request before online migration',15,reportedKey);
  await pool.query(readFileSync(join(__dirname, '../supabase/migrations', migrations.at(-1)), 'utf8'));
  assert.equal((await create('Reported request before online migration',15,reportedKey)).id,existingReported.id);


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

  const online = (operation, values) => service(
    'SELECT public.team_tournament_online_' + operation + '(' + values.map((_, i) => '$' + (i + 1)).join(',') + ') AS data',
    values);
  const createsOnline = (name, key, control = '5+0', grace = 5) => service(
    'SELECT public.team_tournament_m3_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS data',
    [owner, name, rules, start, deadline, 2, 3, 15, key, 'online', control, grace]);
  const setRound = (id, number, at) => pool.query(
    'UPDATE public.team_tournament_rounds SET starts_at=$3 WHERE tournament_id=$1 AND round_no=$2', [id, number, at]);
  const iso = delta => new Date(Date.now() + delta).toISOString();
  const boardsFor = async id => (await pool.query(`SELECT b.*, m.home_team_id, m.away_team_id, r.home_white,
    home.player_id AS home_player, away.player_id AS away_player
    FROM public.team_tournament_m3_online_boards b
    JOIN public.team_tournament_matches m ON m.id=b.match_id
    JOIN public.team_tournament_board_results r ON r.match_id=b.match_id AND r.board_no=b.board_no
    JOIN public.team_tournament_m3_lineups home ON home.entry_id=m.home_team_id AND home.board_no=b.board_no
    JOIN public.team_tournament_m3_lineups away ON away.entry_id=m.away_team_id AND away.board_no=b.board_no
    WHERE b.tournament_id=$1 ORDER BY b.round_no,b.board_no`, [id])).rows;
  const due = async () => transaction('service_role', null, async client =>
    (await client.query('SELECT * FROM public.team_tournament_online_forfeit_due(clock_timestamp())')).rows);
  const ready = (player, b) => online('ready',[player,b.match_id,b.board_no]);
  const claim = (b, room = randomUUID()) => online('claim_start',[b.match_id,b.board_no,room]);

  await t.test('online publication freezes every board and its colours, with participant-only reads', async () => {
    const key = randomUUID();
    const { id } = await createsOnline('Online publication',key);
    assert.equal((await createsOnline('Online publication',key)).id,id);
    await assert.rejects(createsOnline('Online publication',key,'3+2'), conflict('idempotency_conflict'));
    await assert.rejects(createsOnline('Online publication',key,'5+0',6), conflict('idempotency_conflict'));
    await assert.rejects(create('Online publication',15,key), conflict('idempotency_conflict'));
    const entries = await register(id);
    await expire(id);
    await tick(id,entries);
    const boards = await boardsFor(id);
    assert.equal(boards.length,6);
    for (const row of boards) {
      assert.equal(row.white_id,row.home_white ? row.home_player : row.away_player);
      assert.equal(row.black_id,row.home_white ? row.away_player : row.home_player);
      assert.equal(row.status,'scheduled');
    }
    assert.equal((await boardsFor(legacy)).length,0);
    for (const [actor, count] of [[stranger,0],[owner,6],[boards[0].white_id,2]]) {
      await transaction('authenticated', actor, async client => {
        const rows = await client.query('SELECT status FROM public.team_tournament_m3_online_boards');
        assert.equal(rows.rowCount,count);
      });
    }
    const mine = await online('my_board',[boards[0].white_id,id]);
    assert.equal(mine.length,1);
    assert.equal(mine[0].side,'white');
    assert.equal(mine[0].time_control,'5+0');
    assert.equal(mine[0].status,'scheduled');
    assert.equal((await ready(boards[0].white_id,boards[0])).code,'round_not_started');
    assert.equal((await ready(stranger,boards[0])).code,'not_allowed');
    for (const action of ['report','confirm','reject','forfeit']) {
      await assert.rejects(service('SELECT public.team_tournament_m3_result($1,$2,$3,$4) AS data',
        [boards[0].white_id,action,id,{ match_id:boards[0].match_id,board_no:1,result:'1-0' }]), conflict('online_mode'));
    }
    const ruling = { match_id:boards[0].match_id,board_no:1,result:'1-0',reason:'Organizer dispute fixture' };
    const staffResult = (action, input) => service('SELECT public.team_tournament_m3_result($1,$2,$3,$4) AS data',
      [owner,action,id,input]);
    assert.equal((await staffResult('decide',ruling)).confirmed,true);
    assert.equal((await staffResult('correct',{ ...ruling,result:'1/2-1/2' })).result,'1/2-1/2');
  });

  await t.test('online start is exclusive across sessions and result replay preserves one official board', async () => {
    const { id } = await createsOnline('Online completion',randomUUID());
    const entries = await register(id,2);
    await expire(id); await tick(id,entries);
    await setRound(id,1,iso(-60_000));
    const [absent,board] = await boardsFor(id);
    const firstReady = await ready(board.white_id,board);
    assert.equal((await ready(board.white_id,board)).white_ready_at,firstReady.white_ready_at);
    assert.equal((await claim(board)).code,'not_ready');
    await ready(board.black_id,board);

    const claims = await Promise.all([claim(board),claim(board)]);
    assert.equal(claims.filter(b => b.status === 'starting').length,1);
    assert.equal(claims.filter(b => b.code === 'not_ready').length,1);
    const first = claims.find(b => b.status === 'starting');
    const released = await online('release_start',[first.room_id,first.claimed_at]);
    assert.equal(released.status,'scheduled');
    assert.equal(released.room_id,null);
    const retry = await claim(board);
    assert.equal(retry.room_id,first.room_id);
    assert.equal((await online('release_start',[first.room_id,first.claimed_at])).status,'starting');
    assert.equal((await online('mark_live',[retry.room_id])).status,'starting');

    const { rows: [game] } = await pool.query(`INSERT INTO public.matches
      (source_room_id,white_id,black_id,winner_id,winner_color,status,result,termination_reason,time_control,initial_time,created_at,completed_at)
      VALUES ($1,$2,$3,$2,'w','completed','1-0','resignation','5+0',300,$4,$5) RETURNING id`,
      [retry.room_id,board.white_id,board.black_id,iso(-30_000),iso(-10_000)]);
    assert.equal((await online('release_start',[retry.room_id,retry.claimed_at])).status,'live');
    const contender = () => online('record_result',[retry.room_id,'1-0',game.id]);
    const [finished,replayed] = await Promise.all([contender(),contender()]);
    assert.equal(finished.status,'finished');
    assert.deepEqual(finished,replayed);
    await assert.rejects(online('record_result',[retry.room_id,'0-1',game.id]), conflict('online_result_conflict'));
    const { rows } = await pool.query('SELECT * FROM public.team_tournament_board_results WHERE match_id=$1 ORDER BY board_no',[board.match_id]);
    assert.equal(rows[1].result,'1-0'); // White is on the away team on board two.
    assert.equal(rows[1].source,'online_game');
    assert.equal(rows[1].confirmed,true);
    assert.equal(rows[1].revision,1);
    const { rows: audit } = await pool.query('SELECT action FROM public.team_tournament_m3_action_audit WHERE match_id=$1',[board.match_id]);
    assert.deepEqual(audit,[{ action:'online_game' }]);
    const score = calculateTable(entries.map((id,i) => ({id,seed:i+1})),
      [{id:board.match_id,home_team_id:board.home_team_id,away_team_id:board.away_team_id,boards:rows}],rules).matches[0];
    assert.equal(score.away_board_points,1);
    assert.equal((await online('my_board',[board.white_id,id]))[0].result,'1-0');

    await ready(absent.white_id,absent);
    await setRound(id,1,iso(-310_000));
    assert.deepEqual((await due()).filter(b => b.tournament_id === id).map(b => b.result),['+/-']);
    const { rows: [walkover] } = await pool.query(
      'SELECT source,confirmed,result FROM public.team_tournament_board_results WHERE match_id=$1 AND board_no=1',[board.match_id]);
    assert.deepEqual(walkover,{source:'no_show',confirmed:true,result:'+/-'});
  });

  await t.test('no-show stays suspended across a live prior board and restarts at that game’s completion', async () => {
    const { id } = await createsOnline('Online grace period',randomUUID());
    const entries = await register(id);
    await expire(id); await tick(id,entries);
    const boards = await boardsFor(id);
    const prior = boards[0];
    const next = boards.find(b => b.round_no === 2 && [b.white_id,b.black_id].some(id => [prior.white_id,prior.black_id].includes(id)));
    assert.ok(next);
    await setRound(id,1,iso(-60_000));
    await ready(prior.white_id,prior); await ready(prior.black_id,prior);
    const started = await claim(prior);
    const room = started.room_id;
    const chessGame = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const state = { userIds:{ w:prior.white_id,b:prior.black_id },status:'active',initialFen:chessGame,moves:[],
      timeControl:'5+0',initialTime:300,increment:0,whiteTimeMs:300000,blackTimeMs:300000,
      lastMoveTimestamp:Date.now(),startedAt:iso(-50_000),disconnects:{} };
    await service('SELECT public.durable_game_transition($1,$2,$3,$4,$5,$6,$7,$8) AS data',
      ['start',room,randomUUID(),randomUUID(),1,0,randomUUID(),state]);
    assert.equal((await online('mark_live',[room])).status,'live');
    await setRound(id,1,iso(-1_300_000));
    await setRound(id,2,iso(-500_000));
    await setRound(id,3,iso(-400_000));
    const later = boards.find(b => b.round_no === 3 && b.board_no === 1);
    const freePlayer = [next.white_id,next.black_id].find(player => ![prior.white_id,prior.black_id].includes(player));
    assert.equal((await online('my_board',[freePlayer,id]))[0].deadline,null);
    const during = await due();
    assert.equal(during.some(b => b.match_id === next.match_id && b.board_no === next.board_no),false);
    assert.equal(during.some(b => b.match_id === later.match_id && b.board_no === later.board_no),false);

    const ended = iso(-10_000);
    const { rows: [game] } = await pool.query(`INSERT INTO public.matches
      (source_room_id,white_id,black_id,winner_id,winner_color,status,result,termination_reason,time_control,initial_time,created_at,completed_at)
      VALUES ($1,$2,$3,$2,'w','completed','1-0','resignation','5+0',300,$4,$5) RETURNING id`,
      [room,prior.white_id,prior.black_id,iso(-1_000_000),ended]);
    await online('record_result',[room,'1-0',game.id]);
    const [view] = await online('my_board',[freePlayer,id]);
    assert.equal(new Date(view.deadline).toISOString(),new Date(Date.parse(ended)+300_000).toISOString());
    assert.equal((await due()).filter(b => b.tournament_id === id && b.match_id === next.match_id && b.board_no === next.board_no).length,0);
    await pool.query('UPDATE public.team_tournament_m3_online_boards SET finished_at=$3 WHERE match_id=$1 AND board_no=$2',
      [prior.match_id,prior.board_no,iso(-301_000)]);
    const noShow = (await due()).find(b => b.match_id === next.match_id && b.board_no === next.board_no);
    assert.equal(noShow?.result,'-/-');
    assert.equal((await due()).filter(b => b.tournament_id === id).length,0);
    await pool.query('DELETE FROM public.durable_games WHERE room_id=$1',[room]);
  });

  await t.test('unready clears only the actor’s flag on scheduled boards; the remaining ready player wins the no-show', async () => {
    const { id } = await createsOnline('Online presence',randomUUID());
    const entries = await register(id,2);
    await expire(id); await tick(id,entries);
    await setRound(id,1,iso(-60_000));
    const [first,second] = await boardsFor(id);
    const unready = (actor, b) => transaction('service_role', null, async client => (await client.query(
      'SELECT * FROM public.team_tournament_online_unready($1,$2,$3)',
      b ? [actor,b.match_id,b.board_no] : [actor,null,null])).rows);
    await assert.rejects(transaction('service_role', null, client => client.query(
      'SELECT * FROM public.team_tournament_online_unready($1,$2,NULL)',[first.white_id,first.match_id])), { code:'22023' });

    await ready(first.white_id,first); await ready(first.black_id,first);
    assert.deepEqual(await unready(first.black_id,second),[]); // Not this player's board: untouched.
    const [cleared] = await unready(first.white_id);
    assert.equal(cleared.white_ready_at,null);
    assert.ok(cleared.black_ready_at);
    assert.equal(cleared.status,'scheduled');
    assert.deepEqual(await unready(first.white_id),[]); // Idempotent.
    assert.equal((await claim(first)).code,'not_ready');

    await ready(second.white_id,second); await ready(second.black_id,second);
    const started = await claim(second);
    assert.equal(started.status,'starting');
    assert.deepEqual(await unready(second.white_id),[]); // Never a starting/live board.
    const kept = (await boardsFor(id)).find(b => b.board_no === second.board_no);
    assert.ok(kept.white_ready_at && kept.black_ready_at);
    assert.equal(kept.status,'starting');

    await setRound(id,1,iso(-310_000));
    const noShow = (await due()).find(b => b.match_id === first.match_id && b.board_no === first.board_no);
    assert.equal(noShow?.result,'-/+');
    const { rows: [official] } = await pool.query(
      'SELECT source,confirmed,result FROM public.team_tournament_board_results WHERE match_id=$1 AND board_no=$2',
      [first.match_id,first.board_no]);
    assert.deepEqual(official,{ source:'no_show',confirmed:true,result:'-/+' });
    assert.equal((await online('release_start',[started.room_id,started.claimed_at])).status,'scheduled');
    // Leave no startable board behind for the socket test that reuses these fixture players.
    assert.equal((await unready(second.white_id,second)).length,1);
    assert.equal((await unready(second.black_id,second)).length,1);
  });

  await t.test('real clients ready up, busy player waits, stale claim recovers, durable resignation reaches the table in one tick', async test => {
    const { once } = require('node:events');
    const { io: connect } = require('socket.io-client');
    const { tournamentOnlineRest } = require('./test-support/tournamentOnlineRest.cjs');
    const { id } = await createsOnline('Socket pilot',randomUUID());
    const entries = await register(id,2);
    await expire(id); await tick(id,entries);
    await setRound(id,1,iso(-30_000));
    const [stale,board] = await boardsFor(id);
    await ready(stale.white_id,stale); await ready(stale.black_id,stale);
    const orphan = await claim(stale);
    assert.equal(orphan.status,'starting');
    await pool.query("UPDATE public.team_tournament_m3_online_boards SET claimed_at=clock_timestamp()-interval '61 seconds' WHERE room_id=$1",[orphan.room_id]);

    const adapter = await tournamentOnlineRest(db);
    const env = { NODE_ENV:'test', SUPABASE_URL:adapter.url, SUPABASE_ANON_KEY:'local-test-anon-key',
      SUPABASE_SERVICE_KEY:'local-test-service-key', DURABLE_ACTIVE_GAMES:'true',
      TEAM_TOURNAMENTS_ENABLED:'true', TEAM_TOURNAMENTS_M3_ENABLED:'true', TEAM_TOURNAMENTS_ONLINE_PLAY:'true' };
    const saved = Object.fromEntries(Object.keys(env).map(name => [name,process.env[name]]));
    Object.assign(process.env,env);
    let elapsed = 0;
    const realTime = Date.now;
    test.mock.method(Date,'now',() => realTime() + elapsed);
    const runtime = require('./index');
    clearInterval(runtime.timeoutWatchdog);
    const clients = [];
    test.after(async () => {
      for (const socket of clients) socket.disconnect();
      await new Promise(resolve => runtime.io.close(resolve));
      await adapter.close();
      for (const [name,value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });
    const until = async fn => {
      for (let i = 0; i < 150; i++) {
        const value = await fn();
        if (value) return value;
        await delay(15);
      }
      assert.fail('Timed out waiting for tournament state');
    };
    const watch = async (socket, name) => (await once(socket,name,{ signal:AbortSignal.timeout(5000) }))[0];
    const readBoard = async number => (await boardsFor(id)).find(b => b.board_no === number);
    runtime.setTokenVerifier(async token => [board.white_id,board.black_id].includes(token) ? { id:token } : null);
    await runtime.recoveryReady;
    assert.ok(runtime.durableGames.ready());
    await new Promise(resolve => runtime.server.listen(0,'127.0.0.1',resolve));
    const url = 'http://127.0.0.1:' + runtime.server.address().port;
    assert.deepEqual(await (await fetch(url + '/api/team-tournaments/online/status')).json(),{ online_play:true,durable:true });

    runtime.checkRoomTimeouts();
    await until(async () => (await readBoard(stale.board_no)).status === 'scheduled');
    const [white,black] = await Promise.all([board.white_id,board.black_id].map(async player => {
      const socket = connect(url,{ transports:['websocket'], auth:{ accessToken:player }, reconnection:false });
      clients.push(socket);
      await watch(socket,'connect');
      return socket;
    }));
    const privateCreated = watch(black,'private_room_created');
    black.emit('create_private_room',{ timeControl:'5+0' });
    await privateCreated;
    const payload = { matchId:board.match_id,boardNo:board.board_no };
    assert.deepEqual(await white.timeout(3000).emitWithAck('tournament_board_ready',payload),{ ok:true });
    assert.deepEqual(await black.timeout(3000).emitWithAck('tournament_board_ready',payload),{ ok:true });
    await until(async () => (await readBoard(board.board_no)).black_ready_at);
    assert.equal((await readBoard(board.board_no)).status,'scheduled');

    const starts = Promise.all([watch(white,'match_found'),watch(black,'match_found')]);
    black.emit('cancel_matchmaking');
    await until(() => !runtime.socketToRoom.has(black.id));
    elapsed += 5001;
    runtime.checkRoomTimeouts();
    const [whiteStart,blackStart] = await starts;
    const roomId = whiteStart.roomId;
    assert.deepEqual(whiteStart,{ roomId,color:'w',tournament:true });
    assert.deepEqual(blackStart,{ roomId,color:'b',tournament:true });
    assert.equal(runtime.activeRooms.get(roomId).timeControl,'5+0');
    assert.equal((await readBoard(board.board_no)).status,'live');

    const ended = watch(white,'game_over');
    black.emit('resign_game',{ roomId });
    assert.equal((await ended).result,'1-0');
    await until(async () => (await pool.query("SELECT id FROM public.matches WHERE source_room_id=$1 AND status='completed'",[roomId])).rowCount);
    elapsed += 5001;
    runtime.checkRoomTimeouts();
    await until(async () => (await readBoard(board.board_no)).status === 'finished');
    const read = await fetch(url + '/api/team-tournaments/online/my-board?tournament=' + id,
      { headers:{ Authorization:'Bearer ' + board.white_id }});
    const body = await read.json();
    assert.equal(read.status,200);
    assert.equal(body.boards[0].result,'1-0');
    assert.deepEqual(body.boards[0].score,{ home:0,away:1 });

    // Presence: readiness counts only while the player is connected.
    const { PRESENCE_GRACE_MS } = require('./teamTournamentOnline');
    // Date.now is mocked ahead by `elapsed`; PostgreSQL uses its real clock.
    const real = delta => new Date(realTime() + delta).toISOString();
    const tickOnce = async () => { elapsed += 5001; await runtime.tournamentOnline.tick(); };
    white.disconnect(); black.disconnect();
    await until(() => ![...runtime.io.sockets.sockets.values()].some(s => s.connected));
    runtime.setTokenVerifier(async token => players.includes(token) ? { id:token } : null);
    const join = async player => {
      const socket = connect(url,{ transports:['websocket'], auth:{ accessToken:player }, reconnection:false });
      clients.push(socket);
      await watch(socket,'connect');
      return socket;
    };

    // (c) Both flags survived a lost start while both players are gone (restart-like):
    // the tick clears them after the grace period and the no-show rule ends the board.
    const staleNow = await readBoard(stale.board_no);
    assert.ok(staleNow.white_ready_at && staleNow.black_ready_at);
    assert.equal(staleNow.status,'scheduled');
    await tickOnce();
    await delay(100);
    elapsed += PRESENCE_GRACE_MS;
    await tickOnce();
    await until(async () => { const b = await readBoard(stale.board_no); return !b.white_ready_at && !b.black_ready_at; });
    await setRound(id,1,real(-310_000));
    await tickOnce();
    await until(async () => (await readBoard(stale.board_no)).status === 'forfeit');
    assert.equal((await readBoard(stale.board_no)).result,'-/-');

    const { id: second } = await createsOnline('Socket presence',randomUUID());
    const secondEntries = await register(second,2);
    await expire(second); await tick(second,secondEntries);
    await setRound(second,1,real(-30_000));
    const [kept,dropped] = await boardsFor(second);
    const pick = async number => (await boardsFor(second)).find(b => b.board_no === number);
    const readyUp = (socket, b) => socket.timeout(3000).emitWithAck('tournament_board_ready',{ matchId:b.match_id,boardNo:b.board_no });

    // (b) A reconnect within the grace keeps the flag and the game starts normally.
    const firstWhite = await join(kept.white_id);
    assert.deepEqual(await readyUp(firstWhite,kept),{ ok:true });
    firstWhite.disconnect();
    await tickOnce();
    await delay(100);
    const returning = await join(kept.white_id);
    const keptBlack = await join(kept.black_id);
    const keptStart = Promise.all([watch(returning,'match_found'),watch(keptBlack,'match_found')]);
    elapsed += PRESENCE_GRACE_MS;
    await tickOnce();
    await delay(100);
    assert.ok((await pick(kept.board_no)).white_ready_at);
    assert.deepEqual(await readyUp(keptBlack,kept),{ ok:true });
    const [keptWhiteStart] = await keptStart;
    assert.equal(keptWhiteStart.color,'w');
    await until(async () => (await pick(kept.board_no)).status === 'live');

    // (a) A ready player who drops loses the flag after the grace; the opponent who is
    // present and ready wins the no-show instead of the board freezing forever.
    const leaver = await join(dropped.white_id);
    assert.deepEqual(await readyUp(leaver,dropped),{ ok:true });
    leaver.disconnect();
    const stayer = await join(dropped.black_id);
    assert.deepEqual(await readyUp(stayer,dropped),{ ok:true });
    await delay(100);
    const frozen = await pick(dropped.board_no);
    assert.ok(frozen.white_ready_at && frozen.black_ready_at);
    assert.equal(frozen.status,'scheduled');
    await tickOnce();
    await delay(100);
    assert.ok((await pick(dropped.board_no)).white_ready_at, 'grace period not yet over');
    elapsed += PRESENCE_GRACE_MS;
    await tickOnce();
    await until(async () => { const b = await pick(dropped.board_no); return !b.white_ready_at && b.black_ready_at; });
    // (d) The player in a live game is never touched.
    const live = await pick(kept.board_no);
    assert.equal(live.status,'live');
    assert.ok(live.white_ready_at && live.black_ready_at);
    await setRound(second,1,real(-310_000));
    await tickOnce();
    await until(async () => (await pick(dropped.board_no)).status === 'forfeit');
    assert.equal((await pick(dropped.board_no)).result,'-/+');
  });
});
