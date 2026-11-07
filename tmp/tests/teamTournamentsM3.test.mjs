import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createTournamentM3Api, tournamentsEnabled } from '../src/services/teamTournaments.ts';
import { nrwAuthReturnTarget } from '../src/lib/nrwAuthReturn.ts';

const event = '11111111-1111-4111-8111-111111111111';
const match = '22222222-2222-4222-8222-222222222222';
const signal = new AbortController().signal;
const tab = '/spieltag?tab=turniere';
const eventTarget = tab + '&tournament=' + event;
const invite = 'a'.repeat(64);
const inviteTarget = eventTarget + '&invite=' + invite;
const legacyReturns = { clubs: true, spieltag: true, preparation: true };
const returnsEnabled = { ...legacyReturns, tournaments: tournamentsEnabled('true') };

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

test('tournament auth accepts only canonical return paths with the flag enabled', () => {
  for (const target of [tab, eventTarget, inviteTarget]) {
    assert.equal(nrwAuthReturnTarget(target, returnsEnabled), target);
    for (const flag of [undefined, 'false', '1', true]) {
      assert.equal(nrwAuthReturnTarget(target, { ...legacyReturns, tournaments: tournamentsEnabled(flag) }), null);
    }
  }

  const rejected = {
    'embedded CR': tab + '\r&tournament=' + event,
    'trailing CRLF': inviteTarget + '\r\n',
    'trailing line separator': inviteTarget + '\u2028',
    'extra parameter': inviteTarget + '&next=/profile',
    'duplicate parameter': eventTarget + '&tournament=' + event,
    'reordered parameters': '/spieltag?tournament=' + event + '&tab=turniere',
    'invite before tournament': tab + '&invite=' + invite + '&tournament=' + event,
    'invite without tournament': tab + '&invite=' + invite,
    'encoded slash': '%2fspieltag?tab=turniere',
    'encoded slash inside target': tab + '&tournament=%2f' + event,
    'absolute URL': 'https://chessaz.de' + inviteTarget,
    'protocol-relative URL': '//foreign.example' + inviteTarget,
    'backslash': '/\\spieltag?tab=turniere',
    'fragment': inviteTarget + '#extra',
    'non-v4 UUID': tab + '&tournament=' + event.replace('-4111-', '-5111-'),
    'invalid UUID variant': tab + '&tournament=' + event.replace('-8111-', '-7111-'),
    'uppercase UUID': tab + '&tournament=' + event.replace(/^1/, 'A'),
    'uppercase token': eventTarget + '&invite=' + invite.toUpperCase(),
    'short token': eventTarget + '&invite=' + invite.slice(1),
    'long token': inviteTarget + 'a',
  };
  for (const [reason, target] of Object.entries(rejected)) {
    assert.equal(nrwAuthReturnTarget(target, returnsEnabled), null, reason);
  }
});

test('tournament sign-in links round-trip through the ProfileScreen allowlist', async () => {
  const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { tournamentSignInPath } = await vite.ssrLoadModule('/src/components/teamTournaments/TeamTournamentsTab.tsx');
    for (const [selected, search, expected] of [
      [null, '?tab=turniere', tab],
      [event, '?tab=turniere&tournament=' + event, eventTarget],
      [event, '?tab=turniere&tournament=' + event + '&invite=' + invite, inviteTarget],
      [event, '?invite=https://foreign.example', eventTarget],
      [null, '?invite=' + invite, tab],
      ['invalid-id', '?invite=' + invite, tab],
    ]) {
      const link = new URL(tournamentSignInPath(selected, search), 'https://fixture.invalid');
      assert.equal(link.pathname, '/profile');
      const target = link.searchParams.get('returnTo');
      assert.equal(target, expected);
      assert.equal(nrwAuthReturnTarget(target, returnsEnabled), target);
    }
  } finally { await vite.close(); }
});

test('M3 organizer form and board results use six existing locale translations without raw codes', async () => {
  const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { M3Create, M3BoardStatus } = await vite.ssrLoadModule('/src/components/teamTournaments/TeamTournamentsM3Panel.tsx');
    const { tournamentCopy, tournamentErrorMessage } = await vite.ssrLoadModule('/src/components/teamTournaments/copy.ts');
    for (const language of ['de','en','az','tr','ua','ru']) {
      const tr = tournamentCopy(language);
      assert.ok(tr('m3Create') && tr('m3Consent') && tr('m3Disputes') && tr('myTournament'));
      for (const [code, label] of [
        ['event_full', 'm3Full'],
        ['invalid_invite', 'm3InvalidInvite'],
        ['lineup_incomplete', 'm3LineupIncomplete'],
        ['player_already_registered', 'm3DuplicatePlayer'],
        ['no_previous_lineup', 'm3NoPrevious'],
      ]) {
        assert.equal(tournamentErrorMessage(code, tr), tr(label), language + ': ' + code);
      }
      for (const key of ['m3Pending','m3Reported','m3Confirmed','m3DisputedStatus',
        'm3Forfeit','m3Played','m3MoveUp','m3MoveDown','m3RemovePlayer']) {
        assert.ok(tr(key), language + ': ' + key);
      }
      const html = renderToStaticMarkup(createElement(M3Create, {
        tr, token: 'fixture', onCreated() {},
      }));
      assert.ok(html.includes(tr('m3Create')));
      assert.match(html, /name="boards_per_team"[^>]*value="4"/);
      assert.match(html, /name="min_teams"[^>]*value="2"/);
      assert.match(html, /name="max_teams"[^>]*value="4"/);
      assert.match(html, /type="datetime-local"/);
      for (const [status, label] of [
        [undefined, 'm3Pending'], ['pending', 'm3Pending'],
        ['reported', 'm3Reported'], ['confirmed', 'm3Confirmed'], ['disputed', 'm3DisputedStatus'],
      ]) {
        for (const [result, text] of [
          ['pending', ''], ['1-0', '1–0'], ['1/2-1/2', '½–½'], ['0-1', '0–1'],
          ['+/-', '+/−'], ['-/+', '−/+'], ['-/-', '−/−'],
        ]) {
          const board = renderToStaticMarkup(createElement(M3BoardStatus, { result, status, tr }));
          const visible = board.replace(/<[^>]*>/g, '');
          assert.equal(visible, (text ? text + ' · ' : '') + tr(label), language + ': ' + result + '/' + status);
          assert.doesNotMatch(visible, /\b(pending|reported|confirmed|disputed)\b/);
          assert.doesNotMatch(visible, /1\/2-1\/2/);
        }
      }
    }
  } finally { await vite.close(); }
});
