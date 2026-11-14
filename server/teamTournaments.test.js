'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { installTeamTournamentsFromEnv } = require('./teamTournaments');

async function fixture(t, enabled = true) {
  const [owner, arbiter, captain, outsider, tournament, otherTeam, match] = Array.from({ length: 7 }, randomUUID);
  const calls = [];
  const verifications = [];
  const clients = [];
  const rules = {
    version: 1, board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1, loss_points: 0,
    forfeit_win_units: 2, forfeit_loss_units: 0,
  };
  let state = 'locked';
  const members = { owner, arbiter, captain, outsider };
  const app = express();
  const publishedAt = '2026-11-06T12:00:00Z';
  const expected = { id: tournament, status: 'published', published_at: publishedAt };
  const env = {
    SUPABASE_URL: 'https://invalid.example', SUPABASE_ANON_KEY: 'test-public', SUPABASE_SERVICE_KEY: 'test-service',
    TEAM_TOURNAMENTS_ENABLED: enabled ? 'true' : 'false',
  };
  installTeamTournamentsFromEnv(app, async token => {
    verifications.push(token);
    return members[token] ? { id: members[token] } : null;
  }, env, (url, key, options) => {
    clients.push({ key, options });
    return {
      rpc(name, input) {
        return { async abortSignal(signal) {
          assert.ok(signal instanceof AbortSignal);
          const token = await options.accessToken?.();
          calls.push({ name, input, key, token });
          if (name === 'team_tournament_command') {
            if (input.p_action === 'publish') {
              if (state === 'locked') assert.equal(input.p_input.rounds.length, 1);
              state = 'published';
              return { data: expected };
            }
            if (['record','confirm','correct'].includes(input.p_action) && input.p_actor !== arbiter) {
              return { error: { code: '42501', message: 'private database diagnostic' } };
            }
            if (input.p_input.revision === 9) return { error: { code: '40001' } };
            return { data: { id: tournament } };
          }
          const roles = ['owner','arbiter','captain'].includes(token) ? [token === 'owner' ? 'organizer' : token] : [];
          if (input.p_id !== tournament || (input.p_workspace && !roles.length) ||
              (!input.p_workspace && state !== 'published')) return { data: null };
          return { data: { id: tournament, status: state, rules, roles, rounds: [], matches: [],
            teams: [{ id: tournament, seed: 1 }, { id: otherTeam, seed: 2 }] } };
        } };
      },
    };
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, { method = 'GET', token, body } = {}) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/team-tournaments' + path, {
      method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, data: await response.json() };
  }
  return { request, tournament, owner, arbiter, match, calls, verifications, clients, expected };
}

test('team tournament API defaults off before authentication or storage', async t => {
  const f = await fixture(t, false);
  assert.deepEqual(await f.request('/' + f.tournament), { status: 404, data: { code: 'feature_disabled' } });
  assert.equal((await f.request('/', { method: 'POST', token: 'owner', body: {} })).status, 404);
  assert.deepEqual([f.calls.length, f.verifications.length, f.clients.length], [0, 0, 0]);
});

test('allowlists and verified actor guard the privileged write RPC', async t => {
  const f = await fixture(t);
  const write = (body, token) => f.request('/', { method: 'POST', body, token });
  assert.equal((await write({ name: 'Test Cup' })).status, 401);
  assert.equal((await write({ name: 'Test Cup' }, 'fake')).status, 401);
  for (const body of [
    { name: 'Test Cup', actor_id: f.owner }, { name: 'Test Cup', rules: { token: 'bad' } },
    { name: 'Test Cup', rules: { home_white_board_one: 1 } }, { name: 'Test Cup', rules: { board_count: 17 } },
    { name: 'Test Cup', rules: { draw_points: 0 } }, { name: 'Test Cup', rules: { forfeit_win_units: 0 } },
  ]) assert.equal((await write(body, 'owner')).status, 400);
  assert.equal(f.calls.length, 0);
  assert.equal((await write({ name: ' Test Cup ', rules: { home_white_board_one: false } }, 'owner')).status, 201);
  const [call] = f.calls;
  assert.equal(call.key, 'test-service');
  assert.equal(call.token, undefined);
  assert.equal(call.input.p_actor, f.owner);
  assert.equal(call.input.p_input.name, 'Test Cup');
  assert.equal(call.input.p_input.rules.home_white_board_one, false);
  assert.equal((await f.request('/invalid-id')).status, 400);
  assert.equal((await f.request('/' + f.tournament)).status, 404);
});

test('workspace uses the user JWT and publish generates its own schedule and replays cleanly', async t => {
  const f = await fixture(t);
  const path = '/' + f.tournament;
  assert.equal((await f.request(path + '/preview', { token: 'captain' })).status, 403);
  assert.equal((await f.request(path + '/workspace', { token: 'outsider' })).status, 404);
  const preview = await f.request(path + '/preview', { token: 'owner' });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.data.rounds[0].matches[0].boards.map(b => b.home_white), [true, false, true, false]);
  assert.equal((await f.request(path + '/publish', { method: 'POST', token: 'owner', body: { rounds: [] } })).status, 400);
  for (let i = 0; i < 2; i++) {
    const result = await f.request(path + '/publish', { method: 'POST', token: 'owner' });
    assert.deepEqual(result, { status: 200, data: f.expected });
  }
  const publishes = f.calls.filter(c => c.input.p_action === 'publish');
  assert.deepEqual(publishes[0].input.p_input.rounds, preview.data.rounds);
  assert.deepEqual(publishes[1].input.p_input.rounds, []);
  assert.ok(f.calls.filter(c => c.input.p_workspace).every(c => c.key === 'test-public' && c.token));
  const published = await f.request(path);
  assert.equal(published.status, 200);
  assert.deepEqual(published.data.official.standings.map(x => x.rank), [1, 1]);
  assert.equal(f.calls.at(-1).token, undefined);
});

test('result API requires a reason and revision, separates arbiter access, and hides SQL errors', async t => {
  const f = await fixture(t);
  const path = '/' + f.tournament + '/matches/' + f.match + '/boards/1/correct';
  const result = (body, token = 'arbiter') => f.request(path, { method: 'POST', token, body });
  const input = { result: '+/-', reason: 'Scoresheet', revision: 0 };
  assert.equal((await result({ ...input, reason: '' })).status, 400);
  assert.equal((await result({ ...input, revision: undefined })).status, 400);
  assert.equal((await result({ ...input, result: 'pending' })).status, 400);
  assert.deepEqual(await result(input, 'captain'), { status: 403, data: { code: 'not_allowed' } });
  assert.deepEqual(await result({ ...input, revision: 9 }), { status: 409, data: { code: 'result_conflict' } });
  assert.equal((await result(input)).status, 200);
  assert.equal(f.calls.at(-1).input.p_actor, f.arbiter);
});
