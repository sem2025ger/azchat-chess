'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const { bergerSchedule } = require('./teamRoundRobin');

const rules = {
  board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1,
  loss_points: 0, forfeit_win_units: 2, forfeit_loss_units: 0,
};

test('M3 isolated PostgreSQL migration, 5-for-4 capacity and deadline transition', {
  skip: !process.env.CI && !process.env.DURABLE_TEST_DATABASE_URL,
  timeout: 60000,
}, async t => {
  const db = await isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL);
  t.after(() => db.close());
  const owner = randomUUID();
  const captains = Array.from({ length: 5 }, randomUUID);
  const players = Array.from({ length: 20 }, randomUUID);
  const stranger = randomUUID();
  const actors = [owner, ...captains, ...players, stranger];

  await db.pool.query(`CREATE SCHEMA auth;
    CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA auth, private TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    ALTER TABLE public.profiles ADD COLUMN username text;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
  await db.pool.query('INSERT INTO public.profiles(id,username) SELECT id, name FROM unnest($1::uuid[], $2::text[]) AS x(id,name)',
    [actors, actors.map((_, i) => 'm3fixture_' + i)]);
  await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations/20261105221809_team_tournaments_m1.sql'), 'utf8'));
  await db.pool.query(readFileSync(join(__dirname, '../supabase/migrations/20261106034400_team_tournaments_m3_foundation.sql'), 'utf8'));
  await db.pool.query('INSERT INTO public.team_tournament_organizers(user_id) VALUES($1)', [owner]);

  async function as(role, who, sql, params = []) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ' + role);
      await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [who ?? '']);
      const response = await client.query(sql, params);
      await client.query('COMMIT');
      return response.rows;
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  const command = async (who, action, id, input = {}) => {
    const [row] = await as('service_role', null,
      'SELECT public.team_tournament_m3_command($1,$2,$3,$4) AS data',
      [who, action, id, input]);
    return row.data;
  };
  const start = new Date(Date.now() + 86400000 * 4).toISOString();
  const deadline = new Date(Date.now() + 86400000 * 2).toISOString();
  const [created] = await as('service_role', null,
    'SELECT public.team_tournament_m3_create($1,$2,$3,$4,$5,$6,$7) AS data',
    [owner, 'Five captains', rules, start, deadline, 2, 4]);
  const id = created.data.id;
  assert.equal(created.data.status, 'registration');
  await t.test('single-use token, captain ownership and consent RLS', async () => {
    for (let i = 0; i < 5; i++) {
      const digest = createHash('sha256').update('fixture-token-' + i).digest('hex');
      const invite = await command(owner, 'create_invite', id,
        { club_name: 'Team ' + i, token_hash: digest });
      assert.ok(invite.invite_id);
      const redeemed = await command(captains[i], 'redeem_invite', id, { token_hash: digest });
      assert.equal(redeemed.club_name, 'Team ' + i);
      await assert.rejects(command(captains[i], 'redeem_invite', id, { token_hash: digest }),
        error => error.code === 'P0001');
      await command(captains[i], 'set_lineup', id, { players: players.slice(i * 4, i * 4 + 4) });
      for (const player of players.slice(i * 4, i * 4 + 4)) {
        await command(player, 'consent', id);
      }
    }
    const visible = await as('authenticated', captains[0],
      'SELECT board_no,player_id FROM public.team_tournament_m3_lineups ORDER BY board_no');
    assert.equal(visible.length, 4);
    assert.equal((await as('authenticated', captains[1],
      'SELECT player_id FROM public.team_tournament_m3_lineups WHERE player_id=$1',[players[0]])).length,0);
    assert.equal((await as('authenticated', stranger,
      'SELECT player_id FROM public.team_tournament_m3_lineups')).length,0);
    await assert.rejects(as('authenticated', captains[1],
      'SELECT public.team_tournament_m3_command($1,$2,$3,$4)',
      [captains[1], 'set_lineup', id, {players: [players[0]]}]),
    error => error.code === '42501');
  });

  await t.test('exactly four of five captains claim the last four places', async () => {
    const requests = await Promise.allSettled(captains.map(actor => command(actor, 'submit', id)));
    assert.equal(requests.filter(x => x.status === 'fulfilled').length, 4);
    assert.equal(requests.filter(x => x.status === 'rejected').length, 1);
    const loser = requests.find(x => x.status === 'rejected');
    assert.equal(loser.reason.code, 'P0001');
    assert.match(loser.reason.message, /event_full/);
    const count = (await db.pool.query('SELECT count(*)::int AS count FROM public.team_tournament_teams WHERE tournament_id=$1', [id])).rows[0].count;
    assert.equal(count, 4);
  });
  await t.test('single locked deadline publication and immutable lineups', async () => {
    await as('service_role', null,
      "UPDATE public.team_tournament_m3_config SET registration_deadline=clock_timestamp()-interval '1 second' WHERE tournament_id=$1", [id]);
    const entries = await as('service_role', null,
      'SELECT id FROM public.team_tournament_teams WHERE tournament_id=$1 ORDER BY seed',[id]);
    const rounds = bergerSchedule(entries.map(x => x.id), rules);
    const publication = await Promise.all(Array.from({ length: 4 }, () =>
      as('service_role', null, 'SELECT public.team_tournament_m3_tick($1,$2) AS data',[id,rounds])));
    assert.ok(publication.every(x => x[0].data.status === 'published'));
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.team_tournament_rounds WHERE tournament_id=$1',[id])).rows[0].n,3);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.team_tournament_board_results WHERE tournament_id=$1',[id])).rows[0].n,24);
    await assert.rejects(command(captains[0],'withdraw',id),error=>error.code==='55000');
    assert.equal((await as('authenticated',stranger,'SELECT count(*)::int n FROM public.team_tournament_m3_lineups')).length,1);
  });
});
