import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createTournamentM3Api } from '../src/services/teamTournaments.ts';

const event = '11111111-1111-4111-8111-111111111111';
const match = '22222222-2222-4222-8222-222222222222';
const signal = new AbortController().signal;

test('M3 typed API transmits authenticated no-store actions; denies unsafe values', async () => {
  const calls = [];
  const api = createTournamentM3Api('https://qa.example', 'fixture-token', async (url, options) => {
    calls.push({ url: new URL(url), ...options });
    return Response.json({ id: event, status: 'registration', users: [] });
  });
  await api.create({ name: 'Fixture', start_time: '2026-11-10T20:00',
    registration_deadline: '2026-11-09T20:00', boards_per_team: 4, min_teams: 2, max_teams: 4 }, signal);
  await api.invite(event, 'Fixture Club', signal);
  await api.redeem(event, 'a'.repeat(64), signal);
  await api.lineup(event, [event], signal);
  await api.consent(event, event, signal);
  await api.userSearch('check_user', signal);
  await api.boardAction(event, match, 1, 'report', '1-0', null, signal);
  assert.equal(calls.length, 7);
  assert.ok(calls.every(call => call.headers.Authorization === 'Bearer fixture-token' && call.cache === 'no-store'));
  assert.equal(calls[0].url.pathname, '/api/team-tournaments/self-service');
  assert.equal(calls[5].url.searchParams.get('q'), 'check_user');
  assert.equal(calls[6].url.pathname, '/api/team-tournaments/'+event+'/matches/'+match+'/boards/1/m3/report');
  assert.deepEqual(JSON.parse(calls[6].body), { result: '1-0', reason: null });
  assert.throws(() => createTournamentM3Api('https://qa.example', ''), {code:'authentication_required'});
  assert.throws(() => createTournamentM3Api('https://attacker:password@qa.example', 'token'), {code:'configuration'});
  assert.throws(() => api.lineup(event, ['../../../'], signal), {code:'invalid_input'});
  assert.throws(() => api.userSearch('%', signal), {code:'invalid_input'});
  assert.throws(() => api.boardAction(event, match, 17, 'report', '1-0', null, signal), {code:'invalid_input'});
});

test('M3 organizer form uses six existing locale translations and defaults', async () => {
  const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { M3Create } = await vite.ssrLoadModule('/src/components/teamTournaments/TeamTournamentsM3Panel.tsx');
    const { tournamentCopy } = await vite.ssrLoadModule('/src/components/teamTournaments/copy.ts');
    for (const language of ['de','en','az','tr','ua','ru']) {
      const tr = tournamentCopy(language);
      assert.ok(tr('m3Create') && tr('m3Consent') && tr('m3Disputes') && tr('myTournament'));
      const html = renderToStaticMarkup(createElement(M3Create, {
        tr, token: 'fixture', onCreated() {},
      }));
      assert.ok(html.includes(tr('m3Create')));
      assert.match(html, /name="boards_per_team"[^>]*value="4"/);
      assert.match(html, /name="min_teams"[^>]*value="2"/);
      assert.match(html, /name="max_teams"[^>]*value="4"/);
      assert.match(html, /type="datetime-local"/);
    }
  } finally { await vite.close(); }
});
