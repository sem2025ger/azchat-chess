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
      if (args.p_name === 'Changed name') {
        return { abortSignal: async () => ({ error: { code: 'P0001', message: 'idempotency_conflict' } }) };
      }
      return { abortSignal: async () => ({ data: { id, status: 'registration' }, error: null }) };
    },
  };
  const app = express();
  installTeamTournaments(app, {
    enabled: true, m3Enabled: true, now: () => Date.parse('2026-11-06T10:00:00Z'),
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
  for (const interval of [9, 10081, 10.5, '90']) {
    assert.equal((await submit({ ...valid, round_interval_minutes: interval })).status, 400);
  }
  assert.equal((await submit({ ...valid, client_request_id: 'invalid-uuid' })).status, 400);
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
  assert.equal(Object.hasOwn(calls[0].args, 'p_client_request_id'), false);
  const client_request_id = randomUUID();
  const payload = { ...valid, client_request_id, round_interval_minutes: 90 };
  assert.equal((await submit(payload)).status, 201);
  assert.equal(calls.at(-1).args.p_client_request_id, client_request_id);
  assert.equal(calls.at(-1).args.p_round_interval_minutes, 90);
  assert.deepEqual(await submit({ ...payload, name: 'Changed name' }),
    { status: 409, body: { code: 'idempotency_conflict' } });
  assert.equal((await submit({ ...valid, registration_deadline: '2026-11-05T10:00' })).status, 400);
  assert.equal((await submit({ ...payload, registration_deadline: '2026-11-05T10:00' })).status, 201);
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

test('M3 round editing and revision routes validate inputs, enforce flags and propagate SQL authorization and conflicts', async t => {
  const organizer = randomUUID();
  const captain = randomUUID();
  const id = randomUUID();
  const calls = [];
  const commandClient = {
    from() {
      const query = {
        select: () => query, eq: () => query, maybeSingle: () => query,
        abortSignal: async () => ({ data: null }),
      };
      return query;
    },
    rpc(name, args) {
      calls.push([name, args]);
      const error = name.endsWith('command')
        ? { code: 'P0001', message: 'revision_incomplete' }
        : args.p_actor === organizer ? null : { code: '42501' };
      return { abortSignal: async () => ({ error, data: { round_no: args.p_round_no, starts_at: args.p_starts_at } }) };
    },
  };
  const app = express();
  for (const m3Enabled of [true, false]) {
    const mount = express();
    installTeamTournaments(mount, {
      enabled: true, m3Enabled, commandClient,
      verifyToken: async token => token === 'owner' ? { id: organizer } : token === 'captain' ? { id: captain } : null,
    });
    app.use(m3Enabled ? '/m3' : '/legacy', mount);
  }
  const http = app.listen(0, '127.0.0.1');
  await new Promise(resolve => http.once('listening', resolve));
  t.after(() => new Promise(resolve => http.close(resolve)));
  const base = 'http://127.0.0.1:' + http.address().port;
  async function post(path, body, token = 'owner', flag = '/m3') {
    const response = await fetch(base + flag + '/api/team-tournaments/' + id + path, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const path = '/rounds/2/time';
  const valid = { start_time: '2027-02-15T13:45' };
  assert.equal((await post(path, valid, 'expired')).status, 401);
  assert.equal((await post(path, valid, 'owner', '/legacy')).status, 404);
  assert.equal((await post('/rounds/16/time', valid)).status, 400);
  for (const start_time of ['2027-03-28T02:30', '2027-10-31T02:30', '2027-02-15T13:45Z']) {
    assert.deepEqual(await post(path, { start_time }), { status: 400, body: { code: 'invalid_time' } });
  }
  assert.equal(calls.length, 0);
  assert.equal((await post(path, valid, 'captain')).status, 403);
  assert.deepEqual(await post(path, valid), { status: 200, body: { round_no: 2, starts_at: '2027-02-15T12:45:00.000Z' } });
  assert.deepEqual(calls.at(-1), ['team_tournament_m3_set_round_time', {
    p_actor: organizer, p_id: id, p_round_no: 2, p_starts_at: '2027-02-15T12:45:00.000Z',
  }]);
  assert.deepEqual(await post('/lineup/submit-revision', {}, 'captain'),
    { status: 409, body: { code: 'revision_incomplete' } });
  assert.deepEqual(calls.at(-1), ['team_tournament_m3_command', {
    p_actor: captain, p_id: id, p_action: 'submit_revision', p_input: {},
  }]);
});

test('online status and create are gated, and disabled durable storage fails closed', async t => {
  const actor = randomUUID();
  const calls = [];
  const commandClient = { rpc(name,args) {
    calls.push({ name,args });
    return { abortSignal: async () => ({ data:{ id:randomUUID() } }) };
  } };
  const app = express();
  for (const [route, onlineStatus] of [
    ['/off', undefined],
    ['/disabled', () => ({ online_play:true,durable:false })],
    ['/on', () => ({ online_play:true,durable:true })],
  ]) {
    const router = express();
    installTeamTournaments(router,{ enabled:true,m3Enabled:true,now:() => Date.parse('2026-11-01'),
      verifyToken:async () => ({id:actor}),commandClient,onlineStatus });
    app.use(route, router);
  }
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = route => 'http://127.0.0.1:' + server.address().port + route + '/api/team-tournaments';
  const format = { play_mode:'online',time_control:'5+0',round_interval_minutes:15,no_show_minutes:5 };
  const send = (route, overrides = {}) => fetch(base(route) + '/self-service',{
    method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer valid' },
    body:JSON.stringify({ name:'Bochum Cup',start_time:'2026-12-20T15:00',
      registration_deadline:'2026-12-19T18:00',...format,...overrides }),
  });
  assert.deepEqual(await (await fetch(base('/off') + '/online/status')).json(),{ online_play:false,durable:false });
  assert.deepEqual(await (await fetch(base('/disabled') + '/online/status')).json(),{ online_play:true,durable:false });
  assert.equal((await send('/off')).status,400);
  assert.equal((await send('/disabled')).status,503);
  assert.equal((await send('/on',{ time_control:'30+0' })).status,400);
  assert.equal((await send('/on',{ no_show_minutes:0 })).status,400);
  assert.equal(calls.length,0);
  assert.equal((await send('/on')).status,201);
  assert.equal(calls[0].args.p_play_mode,'online');
  assert.equal(calls[0].args.p_time_control,'5+0');
  assert.equal(calls[0].args.p_no_show_minutes,5);
  assert.equal(calls[0].args.p_round_interval_minutes,15);
});
