'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { installTeamTournamentsFromEnv } = require('./teamTournaments');

test('tournament list uses caller-scoped Supabase reads, bounds results and derives the current round', async t => {
  const [actor, captain, privateId, publicId, finishedId, captainTeam] = Array.from({ length: 6 }, randomUUID);
  const captures = [];
  const app = express();
  installTeamTournamentsFromEnv(app, async token => {
    if (token === 'organizer-token') return { id: actor };
    if (token === 'captain-token') return { id: captain };
    return null;
  }, {
    TEAM_TOURNAMENTS_ENABLED: 'true', SUPABASE_URL: 'https://fixture.example',
    SUPABASE_ANON_KEY: 'anon-fixture', SUPABASE_SERVICE_KEY: 'service-fixture',
  }, (url, key, options) => createClient(url, key, {
    ...options,
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      const token = new Headers(init.headers).get('authorization');
      captures.push({ table: url.pathname.split('/').at(-1), query: url.searchParams, token });
      if (url.pathname.endsWith('/team_tournament_organizers')) {
        assert.equal(token, 'Bearer service-fixture');
        const matchesOwner = url.searchParams.get('user_id') === 'eq.' + actor;
        return Response.json(matchesOwner ? [{ user_id: actor }] : []);
      }
      assert.notEqual(token, 'Bearer service-fixture');
      const captainRead = token === 'Bearer captain-token';
      const ownerRead = token === 'Bearer organizer-token';
      if (url.pathname.endsWith('/team_tournaments')) {
        assert.equal(url.searchParams.get('limit'), '50');
        assert.equal(url.searchParams.get('assignments.user_id'), ownerRead ? 'eq.' + actor : captainRead ? 'eq.' + captain : null);
        const rows = [
          { id: publicId, name: 'Public event', status: 'published' },
          { id: finishedId, name: 'Finished event', status: 'finished' },
        ];
        if (ownerRead) rows.unshift({ id: privateId, name: 'Private event', status: 'locked', assignments: [{ role: 'organizer' }] });
        if (captainRead) rows[0].assignments = [{ role: 'captain', team_id: captainTeam }];
        return Response.json(rows);
      }
      assert.ok(url.pathname.endsWith('/team_tournament_rounds'));
      assert.equal(url.searchParams.get('tournament_id'), 'in.(' + publicId + ',' + finishedId + ')');
      assert.equal(url.searchParams.get('matches.boards.confirmed'), 'eq.false');
      assert.equal(url.searchParams.get('matches.limit'), '1');
      assert.equal(url.searchParams.get('matches.boards.limit'), '1');
      assert.equal(url.searchParams.get('limit'), '750');
      return Response.json([
        { tournament_id: publicId, round_no: 1, matches: [] },
        { tournament_id: finishedId, round_no: 1, matches: [] },
        { tournament_id: publicId, round_no: 2, matches: [{}] },
        { tournament_id: publicId, round_no: 3, matches: [{}] },
        { tournament_id: finishedId, round_no: 3, matches: [] },
      ]);
    } },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function read(token) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/team-tournaments',
      token ? { headers: { Authorization: 'Bearer ' + token } } : {});
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, data: await response.json() };
  }

  const anon = await read();
  assert.equal(anon.status, 200);
  assert.equal(anon.data.can_create, false);
  assert.deepEqual(anon.data.tournaments.map(x => [x.id, x.current_round]), [[publicId, 2], [finishedId, 3]]);
  assert.ok(anon.data.tournaments.every(x => !Object.hasOwn(x, 'captain_team_id')));
  assert.ok(captures.every(x => x.token === 'Bearer anon-fixture'));

  const organizer = await read('organizer-token');
  assert.equal(organizer.status, 200);
  assert.equal(organizer.data.can_create, true);
  assert.deepEqual(organizer.data.tournaments.map(x => [x.id, x.current_round]),
    [[privateId, null], [publicId, 2], [finishedId, 3]]);
  const capt = await read('captain-token');
  assert.equal(capt.status, 200);
  assert.equal(capt.data.can_create, false);
  assert.equal(capt.data.tournaments[0].captain_team_id, captainTeam);
  const count = captures.length;
  assert.equal((await read('invalid-token')).status, 401);
  assert.equal(captures.length, count);
});
