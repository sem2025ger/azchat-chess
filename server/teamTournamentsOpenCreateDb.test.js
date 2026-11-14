'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');

const rules = {
  board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1,
  loss_points: 0, forfeit_win_units: 2, forfeit_loss_units: 0,
};
const migration = name => readFileSync(join(__dirname, '../supabase/migrations', name), 'utf8');

test('open M3 creation: two active events per creator, allowlist path unchanged', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL,
  timeout: 60000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  t.after(() => db.close());
  const member = randomUUID();
  const other = randomUUID();
  await db.pool.query(`CREATE SCHEMA auth;
    CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA auth, private TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    ALTER TABLE public.profiles ADD COLUMN username text;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
  await db.pool.query('INSERT INTO public.profiles(id,username) VALUES ($1,$2),($3,$4)',
    [member, 'open_member', other, 'open_other']);
  await db.pool.query(migration('20261105221809_team_tournaments_m1.sql'));
  await db.pool.query(migration('20261106034400_team_tournaments_m3_foundation.sql'));
  await db.pool.query(migration('20261111030000_team_tournaments_open_create.sql'));

  async function as(role, sql, params = []) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ' + role);
      const response = await client.query(sql, params);
      await client.query('COMMIT');
      return response.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  const start = new Date(Date.now() + 86400000 * 4).toISOString();
  const deadline = new Date(Date.now() + 86400000 * 2).toISOString();
  const openCreate = (who, name, role = 'service_role') => as(role,
    'SELECT public.team_tournament_m3_create_open($1,$2,$3,$4,$5,$6,$7,$8) AS data',
    [who, name, rules, start, deadline, 2, 4, 2]).then(rows => rows[0].data);

  await t.test('non-allowlisted member is still rejected by the unchanged allowlist path', async () => {
    await assert.rejects(as('service_role',
      'SELECT public.team_tournament_m3_create($1,$2,$3,$4,$5,$6,$7) AS data',
      [member, 'Allowlist only', rules, start, deadline, 2, 4]), error => error.code === '42501');
  });

  await t.test('only service_role may execute the open function', async () => {
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(openCreate(member, 'Direct call', role), error => error.code === '42501');
    }
  });

  await t.test('creates a registration event with organizer role, then enforces the limit', async () => {
    const first = await openCreate(member, '  Open cup one  ');
    assert.equal(first.status, 'registration');
    const [row] = await db.pool.query(`SELECT t.name, t.status, r.role, c.max_teams, s.board_count
      FROM public.team_tournaments t
      JOIN public.team_tournament_roles r ON r.tournament_id = t.id AND r.user_id = $2
      JOIN public.team_tournament_m3_config c ON c.tournament_id = t.id
      JOIN public.team_tournament_rulesets s ON s.tournament_id = t.id
      WHERE t.id = $1`, [first.id, member]).then(result => result.rows);
    assert.deepEqual(row, { name: 'Open cup one', status: 'registration', role: 'organizer', max_teams: 4, board_count: 4 });
    // Two concurrent attempts for the second slot: exactly one may win.
    const results = await Promise.allSettled([openCreate(member, 'Race A'), openCreate(member, 'Race B')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected');
    assert.equal(rejected.reason.code, 'P0001');
    assert.equal(rejected.reason.message, 'create_limit');
    await assert.rejects(openCreate(member, 'Third'), error => error.message === 'create_limit');
    // The limit is per creator.
    assert.equal((await openCreate(other, 'Other member cup')).status, 'registration');
  });

  await t.test('finished or cancelled events free a slot', async () => {
    await db.pool.query(`UPDATE public.team_tournaments t SET status = 'cancelled'
      FROM public.team_tournament_roles r
      WHERE r.tournament_id = t.id AND r.user_id = $1 AND t.name = 'Open cup one'`, [member]);
    assert.equal((await openCreate(member, 'After cancel')).status, 'registration');
  });

  await t.test('invalid input is rejected before any row is written', async () => {
    const before = await db.pool.query('SELECT count(*)::int AS n FROM public.team_tournaments');
    await assert.rejects(as('service_role',
      'SELECT public.team_tournament_m3_create_open($1,$2,$3,$4,$5,$6,$7,$8) AS data',
      [other, 'Bad window', rules, deadline, start, 2, 4, 2]), error => error.code === '22023');
    await assert.rejects(as('service_role',
      'SELECT public.team_tournament_m3_create_open($1,$2,$3,$4,$5,$6,$7,$8) AS data',
      [other, 'Bad limit', rules, start, deadline, 2, 4, 0]), error => error.code === '22023');
    const after = await db.pool.query('SELECT count(*)::int AS n FROM public.team_tournaments');
    assert.equal(after.rows[0].n, before.rows[0].n);
  });
});
