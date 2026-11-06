'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { installTeamTournaments } = require('./teamTournaments');

test('M3 event creation validates Berlin wall times, authorization and atomically delegates to SQL', async t => {
  const actor = randomUUID();
  const id = randomUUID();
  const calls = [];
  const commandClient = {
    rpc(name, args) {
      calls.push({ name, args });
      return { abortSignal: async () => ({ data: { id, status: 'registration' }, error: null }) };
    },
  };
  const app = express();
  installTeamTournaments(app, {
    enabled: true, now: () => Date.parse('2026-11-06T10:00:00Z'),
    verifyToken: async token => token === 'valid' ? { id: actor } : null,
    commandClient,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/team-tournaments/self-service';
  async function submit(body, token = 'valid') {
    const result = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    assert.equal(result.headers.get('cache-control'), 'no-store');
    return { status: result.status, body: await result.json() };
  }
  const valid = {
    name: 'NRW Team Cup', start_time: '2026-12-20T15:00',
    registration_deadline: '2026-12-19T18:00',
  };
  assert.equal((await submit(valid, 'wrong')).status, 401);
  assert.equal((await submit({ ...valid, start_time: '2026-10-25T02:30' })).status, 400);
  assert.equal((await submit({ ...valid, registration_deadline: '2026-03-29T02:30' })).status, 400);
  assert.equal((await submit({ ...valid, max_teams: 1 })).status, 400);
  assert.equal((await submit({ ...valid, min_teams: 5, max_teams: 4 })).status, 400);
  assert.equal((await submit({ ...valid, extra: true })).status, 400);
  assert.equal(calls.length, 0);
  const ok = await submit(valid);
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.body, { id, status: 'registration' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'team_tournament_m3_create');
  assert.equal(calls[0].args.p_actor, actor);
  assert.equal(calls[0].args.p_starts_at, '2026-12-20T14:00:00.000Z');
  assert.equal(calls[0].args.p_registration_deadline, '2026-12-19T17:00:00.000Z');
  assert.equal(calls[0].args.p_min_teams, 2);
  assert.equal(calls[0].args.p_max_teams, 4);
  assert.equal(calls[0].args.p_rules.board_count, 4);
});

test('M3 event creation stays unavailable with the tournament flag disabled', async t => {
  const app = express();
  installTeamTournaments(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/team-tournaments/self-service',
    { method: 'POST', headers: { Authorization: 'Bearer ignored', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { code: 'feature_disabled' });
});
