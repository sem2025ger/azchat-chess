'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const { bergerSchedule, calculateTable } = require('./teamRoundRobin');

const rules = {
  board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1, loss_points: 0,
  forfeit_win_units: 2, forfeit_loss_units: 0,
};
const pgError = code => error => error.code === code;

test('Team tournaments on isolated PostgreSQL: scoped access, atomic publication and auditable results', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL, timeout: 30000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  t.after(() => db.close());
  const [owner, arbiter, captain, member, outsider, otherOwner] = Array.from({ length: 6 }, randomUUID);
  await db.pool.query(`CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`);
  await db.pool.query('INSERT INTO public.profiles(id) SELECT unnest($1::uuid[])', [[owner, arbiter, captain, member, outsider, otherOwner]]);
  await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations/20261105221809_team_tournaments_m1.sql'), 'utf8'));
  await db.pool.query('INSERT INTO public.team_tournament_organizers(user_id) VALUES ($1),($2)', [owner, otherOwner]);

  async function as(role, user, sql, params = []) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ' + role);
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
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

  const callSql = 'SELECT public.team_tournament_command($1, $2, $3, $4) AS data';
  async function command(actor, action, id = null, input = {}) {
    const [row] = await as('service_role', null, callSql, [actor, action, id, input]);
    return row.data;
  }
  async function snapshot(actor, id, workspace = true) {
    const [row] = await as(actor ? 'authenticated' : 'anon', actor,
      'SELECT public.team_tournament_snapshot($1,$2) AS data', [id, workspace]);
    return row.data;
  }

  const { id } = await command(owner, 'create', null, { name: 'M1 Cup', rules });
  const { id: otherId } = await command(otherOwner, 'create', null, { name: 'Private second event', rules });
  await command(owner, 'register', id);
  await command(owner, 'assign_arbiter', id, { user_id: arbiter });
  const teams = [];
  for (let i = 0; i < 4; i++) {
    const entry = await command(owner, 'approve_team', id, { name: 'Team ' + (i + 1), captain_id: i === 0 ? captain : null });
    teams.push({ id: entry.team_id, seed: i + 1 });
  }

  await t.test('private rows and commands do not follow public club or captain membership', async () => {
    for (const who of [arbiter, captain, member, outsider]) {
      await assert.rejects(command(who, 'create', null, { name: 'Fake event', rules }), pgError('42501'));
    }
    for (const who of [arbiter, captain, member, outsider, otherOwner]) {
      for (const action of ['register', 'approve_team', 'assign_arbiter', 'lock', 'publish', 'finish']) {
        await assert.rejects(command(who, action, id), pgError('42501'));
      }
    }
    for (const who of [member, outsider, otherOwner, null]) {
      assert.equal(await snapshot(who, id), null);
      assert.equal(await snapshot(who, id, false), null);
    }
    assert.equal(await snapshot(owner, otherId), null);
    assert.equal(await snapshot(owner, id, false), null);
    assert.deepEqual((await snapshot(owner, id)).roles, ['organizer']);
    assert.deepEqual((await snapshot(arbiter, id)).roles, ['arbiter']);
    assert.deepEqual((await snapshot(captain, id)).teams.map(x => x.id), [teams[0].id]);
    assert.deepEqual((await snapshot(captain, id)).roles, ['captain']);
    assert.equal((await snapshot(owner, id)).teams.length, 4);
    for (const [role, who] of [['anon', null], ['authenticated', owner], ['authenticated', arbiter]]) {
      await assert.rejects(as(role, who, callSql, [owner, 'publish', id, {}]), pgError('42501'));
      await assert.rejects(as(role, who, 'UPDATE public.team_tournament_rulesets SET win_points = 5 WHERE tournament_id = $1', [id]), pgError('42501'));
      await assert.rejects(as(role, who, "UPDATE public.team_tournaments SET status = 'published' WHERE id = $1", [id]), pgError('42501'));
    }
    for (const who of [owner, captain, member, outsider, otherOwner]) {
      for (const action of ['record', 'confirm', 'correct']) await assert.rejects(command(who, action, id), pgError('42501'));
    }
    await assert.rejects(command(arbiter, 'confirm', otherId), pgError('42501'));
    assert.equal((await as('authenticated', otherOwner, 'SELECT * FROM public.team_tournament_teams')).length, 0);
  });

  const rounds = bergerSchedule(teams.map(x => x.id), rules);
  await t.test('failed or concurrent publication never leaks a partial or duplicate schedule', async () => {
    await command(owner, 'lock', id);
    await assert.rejects(command(owner, 'approve_team', id, { name: 'Late team' }), pgError('55000'));
    await assert.rejects(as('service_role', null, 'UPDATE public.team_tournament_rulesets SET win_points=5 WHERE tournament_id=$1', [id]), pgError('42501'));
    const broken = structuredClone(rounds);
    broken[2].matches[0].away_team_id = broken[2].matches[0].home_team_id;
    await assert.rejects(command(owner, 'publish', id, { rounds: broken }), pgError('22023'));
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.team_tournament_rounds')).rows[0].n, 0);
    assert.equal(await snapshot(null, id, false), null);
    const first = await Promise.all(Array.from({ length: 4 }, () => command(owner, 'publish', id, { rounds })));
    assert.ok(first.every(x => JSON.stringify(x) === JSON.stringify(first[0])));
    assert.equal((await snapshot(null, id, false)).status, 'published');
    assert.deepEqual(await command(owner, 'publish', id), first[0]);
    const publicView = await snapshot(null, id, false);
    assert.deepEqual(publicView.roles, []);
    assert.equal(publicView.rounds.length, 3);
    assert.equal(publicView.matches.length, 6);
    assert.equal(publicView.matches.flatMap(x => x.boards).length, 24);
    for (const match of publicView.matches) {
      assert.deepEqual(match.boards.map(x => x.home_white), [true, false, true, false]);
    }
    assert.equal(await snapshot(null, otherId, false), null);
    assert.equal(await snapshot(outsider, id), null);
    assert.deepEqual(await snapshot(outsider, id, false), publicView);
  });

  await t.test('only the assigned arbiter confirms and corrects with revision and private audit', async () => {
    const published = await snapshot(null, id, false);
    const match = published.matches[0];
    const body = { match_id: match.id, board_no: 1, result: '+/-', reason: 'Arbiter report', revision: 0 };
    await assert.rejects(command(owner, 'finish', id), pgError('55000'));
    await assert.rejects(command(arbiter, 'correct', id, body), pgError('55000'));
    await assert.rejects(command(arbiter, 'confirm', id, { ...body, reason: ' ' }), pgError('22023'));
    await assert.rejects(command(arbiter, 'confirm', id, { ...body, result: 'pending' }), pgError('22023'));
    await assert.rejects(command(arbiter, 'confirm', id, { ...body, match_id: randomUUID() }), pgError('P0002'));
    const provisional = await command(arbiter, 'record', id, body);
    assert.equal(provisional.confirmed, false);
    assert.equal(provisional.revision, 1);
    await assert.rejects(command(arbiter, 'confirm', id, body), pgError('40001'));
    const confirm = { ...body, revision: 1 };
    const sameRevision = await Promise.allSettled([command(arbiter, 'confirm', id, confirm), command(arbiter, 'confirm', id, confirm)]);
    assert.equal(sameRevision.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(sameRevision.find(x => x.status === 'rejected').reason.code, '40001');
    const corrected = await command(arbiter, 'correct', id, { ...body, result: '1/2-1/2', reason: 'Signed scoresheet', revision: 2 });
    assert.equal(corrected.confirmed, true);
    assert.equal(corrected.revision, 3);
    const readAudit = 'SELECT action, actor_id, old_result, new_result, reason FROM public.team_tournament_result_audit ORDER BY revision';
    const audit = await as('authenticated', owner, readAudit);
    assert.deepEqual(audit.map(x => [x.action, x.actor_id, x.old_result, x.new_result]), [
      ['record', arbiter, 'pending', '+/-'], ['confirm', arbiter, '+/-', '+/-'], ['correct', arbiter, '+/-', '1/2-1/2'],
    ]);
    assert.equal(audit[2].reason, 'Signed scoresheet');
    assert.deepEqual(await as('authenticated', arbiter, readAudit), audit);
    for (const who of [captain, member, outsider, otherOwner]) assert.deepEqual(await as('authenticated', who, readAudit), []);
    await assert.rejects(as('anon', null, readAudit), pgError('42501'));
    await assert.rejects(as('service_role', null, 'DELETE FROM public.team_tournament_result_audit'), pgError('42501'));
  });

  await t.test('broader role visibility does not expose unpublished tournaments, teams or audit rows', async () => {
    const { id: draftId } = await command(otherOwner, 'create', null, { name: 'Private draft', rules });
    await command(otherOwner, 'register', otherId);
    await command(otherOwner, 'approve_team', otherId, { name: 'Unpublished team' });
    await db.pool.query('ALTER POLICY own_tournament_roles ON public.team_tournament_roles TO anon, authenticated USING (true)');
    try {
      const draft = 'SELECT id FROM public.team_tournaments WHERE id = $1';
      const unpublished = 'SELECT id FROM public.team_tournament_teams WHERE tournament_id = $1';
      const audit = 'SELECT revision FROM public.team_tournament_result_audit WHERE tournament_id = $1';
      assert.equal((await as('authenticated', otherOwner, draft, [draftId])).length, 1);
      assert.equal((await as('authenticated', otherOwner, unpublished, [otherId])).length, 1);
      assert.ok((await as('authenticated', owner, audit, [id])).length > 0);
      for (const [role, who] of [['authenticated', outsider], ['anon', null]]) {
        const roles = await as(role, who, 'SELECT user_id FROM public.team_tournament_roles WHERE tournament_id = $1', [draftId]);
        assert.deepEqual(roles, [{ user_id: otherOwner }], 'fixture exposes a foreign role row');
        assert.deepEqual(await as(role, who, draft, [draftId]), [], role + ' draft access');
        assert.deepEqual(await as(role, who, unpublished, [otherId]), [], role + ' unpublished team access');
      }
      assert.deepEqual(await as('authenticated', outsider, audit, [id]), [], 'outsider audit access');
      await assert.rejects(as('anon', null, audit, [id]), pgError('42501'));
    } finally {
      await db.pool.query(`ALTER POLICY own_tournament_roles ON public.team_tournament_roles
        TO authenticated USING (user_id = (SELECT auth.uid()))`);
    }
  });

  await t.test('the complete pilot finishes with six matches and correct shared standings', async () => {
    const published = await snapshot(null, id, false);
    for (const match of published.matches) {
      for (const board of match.boards.filter(x => !x.confirmed)) {
        await command(arbiter, 'confirm', id, { match_id: match.id, board_no: board.board_no,
          result: '1/2-1/2', reason: 'Pilot scoresheet', revision: board.revision });
      }
    }
    assert.equal((await command(owner, 'finish', id)).status, 'finished');
    const final = await snapshot(null, id, false);
    const scores = calculateTable(final.teams, final.matches, final.rules);
    assert.deepEqual(scores.standings.map(x => [x.rank, x.played, x.match_points, x.board_points, x.berliner_wertung]),
      Array.from({ length: 4 }, () => [1, 3, 3, 6, 15]));
    assert.equal(scores.matches.length, 6);
    assert.ok(scores.matches.every(m => m.remaining_boards === 0 && m.scenarios.outcome === 'draw'));
    await assert.rejects(command(arbiter, 'correct', id, { match_id: final.matches[0].id, board_no: 1 }), pgError('55000'));
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM public.matches')).rows[0].n, 0);
  });
});
