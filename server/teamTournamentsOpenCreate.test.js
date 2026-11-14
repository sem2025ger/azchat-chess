'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const { installTeamTournaments } = require('./teamTournaments');

const organizer = randomUUID();
const member = randomUUID();
const eventId = randomUUID();

// Chainable stand-in for the Supabase query builder; records RPC calls.
function client(calls, { rpcError } = {}) {
  const query = table => {
    const builder = {
      select() { return builder; }, eq(column, value) { builder.user = value; return builder; },
      order() { return builder; }, limit() { return builder; }, in() { return builder; },
      maybeSingle() { return builder; }, single() { return builder; },
      async abortSignal() {
        if (table === 'team_tournament_organizers')
          return { data: builder.user === organizer ? [{ user_id: organizer }] : [], error: null };
        return { data: [], error: null };
      },
    };
    return builder;
  };
  return {
    from: query,
    rpc(name, args) {
      calls.push({ name, args });
      return { async abortSignal() {
        if (name === 'team_tournament_m3_due_events') return { data: [], error: null };
        if (rpcError) return { data: null, error: rpcError };
        return { data: { id: eventId, status: 'registration' }, error: null };
      } };
    },
  };
}

async function serve(t, { openCreate, rpcError } = {}) {
  const calls = [];
  const app = express();
  const shared = client(calls, { rpcError });
  installTeamTournaments(app, {
    enabled: true, m3Enabled: true, openCreate,
    verifyToken: async token => token === 'organizer' ? { id: organizer } : token === 'member' ? { id: member } : null,
    publicClient: shared, clientForToken: () => shared, commandClient: shared,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/team-tournaments';
  const request = async (path, token, body) => {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  return { calls, request };
}

const start = new Date(Date.now() + 4 * 86400000);
const berlin = date => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(date).replace(' ', 'T');
const input = {
  name: 'Open Cup', start_time: berlin(start), registration_deadline: berlin(new Date(start - 86400000)),
  boards_per_team: 4, min_teams: 2, max_teams: 4,
};
const creations = calls => calls.filter(call => call.name.startsWith('team_tournament_m3_create'));

test('list: open flag lets any signed-in member create and exposes the limit; anonymous never', async t => {
  const open = await serve(t, { openCreate: true });
  assert.deepEqual((await open.request('/', 'member')).body, { can_create: true, create_limit: 2, tournaments: [] });
  assert.deepEqual((await open.request('/', 'organizer')).body, { can_create: true, tournaments: [] });
  assert.deepEqual((await open.request('/')).body, { can_create: false, tournaments: [] });
  const closed = await serve(t, { openCreate: false });
  assert.deepEqual((await closed.request('/', 'member')).body, { can_create: false, tournaments: [] });
});

test('self-service: member uses the limited SQL function, organizer keeps the original one', async t => {
  const open = await serve(t, { openCreate: true });
  assert.equal((await open.request('/self-service', 'member', input)).status, 201);
  assert.equal((await open.request('/self-service', 'organizer', input)).status, 201);
  const [memberCall, organizerCall] = creations(open.calls);
  assert.equal(memberCall.name, 'team_tournament_m3_create_open');
  assert.equal(memberCall.args.p_actor, member);
  assert.equal(memberCall.args.p_active_limit, 2);
  assert.equal(organizerCall.name, 'team_tournament_m3_create');
  assert.ok(!Object.hasOwn(organizerCall.args, 'p_active_limit'));
});

test('self-service: flag off routes everyone to the allowlist function; limit maps to 409', async t => {
  const closed = await serve(t, { openCreate: false });
  await closed.request('/self-service', 'member', input);
  assert.deepEqual(creations(closed.calls).map(call => call.name), ['team_tournament_m3_create']);
  const limited = await serve(t, { openCreate: true, rpcError: { code: 'P0001', message: 'create_limit' } });
  assert.deepEqual(await limited.request('/self-service', 'member', input),
    { status: 409, body: { code: 'create_limit' } });
});
