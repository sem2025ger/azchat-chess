'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { isolatedPostgres } = require('./test-support/durablePostgres.cjs');
const { bergerSchedule } = require('./teamRoundRobin');
const { cleanupEvents } = require('./scripts/qaM3PilotDb');

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
        await command(player, 'consent', id, { entry_id: redeemed.entry_id });
      }
    }
    const wrongEntry = (await db.pool.query(
      'SELECT id FROM public.team_tournament_m3_entries WHERE tournament_id=$1 AND captain_id=$2',
      [id, captains[1]])).rows[0].id;
    await assert.rejects(command(players[0], 'consent', id, {}),
      error => error.code === '22023');
    await assert.rejects(command(players[0], 'consent', id, { entry_id: wrongEntry }),
      error => error.code === '42501');
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

  await t.test('revoked invitation cannot be redeemed and outsiders see no predeadline roster', async () => {
    const hash = createHash('sha256').update('revoked-fixture').digest('hex');
    const invite = await command(owner,'create_invite',id,{club_name:'Revoked',token_hash:hash});
    assert.equal((await command(owner,'revoke_invite',id,{invite_id:invite.invite_id})).revoked,true);
    await assert.rejects(command(stranger,'redeem_invite',id,{token_hash:hash}),
      error=>error.code==='P0001');
    const publicBefore = await as('anon',null,
      'SELECT count(*)::int n FROM public.team_tournament_m3_lineups');
    assert.equal(publicBefore[0].n,0);
    const own = await as('authenticated',players[0],
      'SELECT count(*)::int n FROM public.team_tournament_m3_lineups');
    assert.equal(own[0].n,4);
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
      as('service_role', null, 'SELECT public.team_tournament_m3_tick($1,$2::jsonb) AS data',[id,JSON.stringify(rounds)])));
    assert.ok(publication.every(x => x[0].data.status === 'published'));
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.team_tournament_rounds WHERE tournament_id=$1',[id])).rows[0].n,3);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM public.team_tournament_board_results WHERE tournament_id=$1',[id])).rows[0].n,24);
    await assert.rejects(command(captains[0],'withdraw',id),error=>error.code==='55000');
    const allPublished = await as('authenticated',stranger,
      'SELECT count(*)::int n FROM public.team_tournament_m3_lineups');
    assert.equal(allPublished[0].n,16);
    const publicPublished = await as('anon',null,
      'SELECT count(*)::int n FROM public.team_tournament_m3_lineups');
    assert.equal(publicPublished[0].n,16);
  });
  await t.test('minimum of two teams cancels one, publishes two, and gives three teams byes', async () => {
    for (const number of [1,2,3]) {
      const [created] = await as('service_role',null,
        'SELECT public.team_tournament_m3_create($1,$2,$3,$4,$5,$6,$7) AS data',
        [owner,'Minimum '+number,rules,start,deadline,2,4]);
      const eventId = created.data.id;
      const teamIds = [];
      for(let i=0;i<number;i++) {
        // Fixture injection uses the already-reviewed M1 team create transaction.
        // The five-captain test above independently covers self-service capacity.
        const [team] = await as('service_role',null,
          'SELECT public.team_tournament_command($1,$2,$3,$4) AS data',
          [owner,'approve_team',eventId,{name:'Fixture '+i}]);
        teamIds.push(team.data.team_id);
      }
      await as('service_role',null,
        "UPDATE public.team_tournament_m3_config SET registration_deadline=clock_timestamp()-interval '1 second' WHERE tournament_id=$1",[eventId]);
      const rounds = number>=2 ? bergerSchedule(teamIds,rules) : [];
      const response = await Promise.all(Array.from({length:3},()=>as('service_role',null,
        'SELECT public.team_tournament_m3_tick($1,$2::jsonb) AS data',
        [eventId,JSON.stringify(rounds)])));
      const status = number===1?'cancelled':'published';
      assert.ok(response.every(x=>x[0].data.status===status));
      const stored = (await db.pool.query(
        'SELECT count(*)::int n,count(bye_team_id)::int byes FROM public.team_tournament_rounds WHERE tournament_id=$1',
        [eventId])).rows[0];
      assert.equal(stored.n,number===1?0:number===2?1:3);
      assert.equal(stored.byes,number===3?3:0);
      await assert.rejects(command(captains[0],'redeem_invite',eventId,{token_hash:'a'.repeat(64)}),
        error=>error.code==='55000');
    }
  });

  await t.test('players confirm, conflict disputes, staff adjudicates, captains proxy and audit sources stay distinct', async () => {
    const pairs = await db.pool.query(
      'SELECT id,home_team_id,away_team_id FROM public.team_tournament_matches WHERE tournament_id=$1 ORDER BY round_no,id LIMIT 1',[id]);
    const match = pairs.rows[0];
    const boards = await db.pool.query(
      'SELECT board_no,home_white FROM public.team_tournament_board_results WHERE match_id=$1 ORDER BY board_no',[match.id]);
    const whiteTeam = boards.rows[0].home_white ? match.home_team_id : match.away_team_id;
    const blackTeam = boards.rows[0].home_white ? match.away_team_id : match.home_team_id;
    async function player(team, boardNo) {
      const result = await db.pool.query(
        'SELECT player_id FROM public.team_tournament_m3_lineups WHERE entry_id=$1 AND board_no=$2',
        [team, boardNo]);
      return result.rows[0].player_id;
    }
    const white = await player(whiteTeam,1);
    const black = await player(blackTeam,1);
    async function result(who, action, boardNo, outcome, reason = null) {
      const [row] = await as('service_role',null,
        'SELECT public.team_tournament_m3_result($1,$2,$3,$4::jsonb) AS data',
        [who,action,id,JSON.stringify({match_id:match.id,board_no:boardNo,result:outcome,reason})]);
      return row.data;
    }
    await assert.rejects(result(stranger,'report',1,'1-0'),error=>error.code==='42501');
    assert.equal((await result(white,'report',1,'1-0')).status,'reported');
    assert.equal((await result(black,'confirm',1,null)).status,'confirmed');
    const official = await db.pool.query(
      'SELECT result,source,confirmed FROM public.team_tournament_board_results WHERE match_id=$1 AND board_no=1',[match.id]);
    assert.deepEqual(official.rows[0],{result:'1-0',source:'player_report',confirmed:true});
    const white2 = await player(whiteTeam,2);
    const black2 = await player(blackTeam,2);
    assert.equal((await result(white2,'report',2,'1-0')).status,'reported');
    assert.equal((await result(black2,'report',2,'0-1')).status,'disputed');
    assert.equal((await db.pool.query(
      'SELECT confirmed FROM public.team_tournament_board_results WHERE match_id=$1 AND board_no=2',[match.id])).rows[0].confirmed,false);
    assert.equal((await result(owner,'decide',2,'1/2-1/2','Signed scoresheets')).status,'confirmed');
    assert.equal((await db.pool.query(
      'SELECT source FROM public.team_tournament_board_results WHERE match_id=$1 AND board_no=2',[match.id])).rows[0].source,'organizer_decision');
    await assert.rejects(result(white2,'report',2,'1-0'),error=>error.code==='55000');
    await result(owner,'correct',2,'0-1','Appeal reviewed');
    const audit = await db.pool.query(
      'SELECT actor_id, actor_role, action, old_value, new_value, changed_at FROM public.team_tournament_m3_action_audit WHERE tournament_id=$1 ORDER BY id',[id]);
    assert.deepEqual(audit.rows.map(row=>row.action),
      ['report','confirm','report','report','decide','correct']);
    assert.ok(audit.rows.every(row=>row.actor_id && row.actor_role && row.changed_at && row.old_value && row.new_value));
    assert.equal((await as('authenticated',stranger,
      'SELECT * FROM public.team_tournament_m3_action_audit WHERE tournament_id=$1',[id])).length,0);
    assert.equal((await as('authenticated',owner,
      'SELECT * FROM public.team_tournament_m3_action_audit WHERE tournament_id=$1',[id])).length,6);
    const captainWhite = (await db.pool.query(
      'SELECT captain_id FROM public.team_tournament_m3_entries WHERE id=$1',[whiteTeam])).rows[0].captain_id;
    const captainBlack = (await db.pool.query(
      'SELECT captain_id FROM public.team_tournament_m3_entries WHERE id=$1',[blackTeam])).rows[0].captain_id;
    await assert.rejects(result(stranger,'forfeit',3,'+/-'),error=>error.code==='42501');
    assert.equal((await result(captainWhite,'forfeit',3,'+/-')).status,'reported');
    assert.equal((await result(captainBlack,'confirm',3,null)).status,'confirmed');
    const forfeit = (await db.pool.query(
      'SELECT source,confirmed,result FROM public.team_tournament_board_results WHERE match_id=$1 AND board_no=3',[match.id])).rows[0];
    assert.deepEqual(forfeit,{source:'captain',confirmed:true,result:'+/-'});
    assert.equal((await db.pool.query(
      'SELECT count(*)::int n FROM public.team_tournament_board_results WHERE tournament_id=$1 AND NOT confirmed',[id])).rows[0].n,21);
  });

  await t.test('hosted cleanup removes the fixture graph and preserves unrelated tournaments', async () => {
    const tag = 'QA-M3-123';
    await db.pool.query('UPDATE public.team_tournaments SET name=$1 WHERE id=$2', [`[${tag}] Scope`, id]);
    const remaining = () => db.pool.query(
      'SELECT id, name FROM public.team_tournaments WHERE id<>$1 ORDER BY id', [id]).then(res => res.rows);
    const otherEvents = await remaining();
    assert.ok(otherEvents.length > 0);
    const client = await db.pool.connect();
    try {
      await assert.rejects(cleanupEvents(client, tag, [stranger]), /unexpected_fixture_event_owner/);
      assert.equal((await client.query('SELECT id FROM public.team_tournaments WHERE id=$1', [id])).rowCount, 1);
      await cleanupEvents(client, tag, [owner]);
      await cleanupEvents(client, tag, [owner]);
      assert.equal((await client.query('SELECT id FROM public.team_tournaments WHERE id=$1', [id])).rowCount, 0);
      assert.deepEqual(await remaining(), otherEvents);
    } finally {
      client.release();
    }
  });

});
