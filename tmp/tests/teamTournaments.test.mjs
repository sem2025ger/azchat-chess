import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createTournamentApi, tournamentDefaults, tournamentsEnabled } from '../src/services/teamTournaments.ts';

const tournament = '11111111-1111-4111-8111-111111111111';
const match = '22222222-2222-4222-8222-222222222222';
const actor = '33333333-3333-4333-8333-333333333333';

test('tournament API keeps the list and published events anonymous and scopes mutations to a bearer token', async () => {
  for (const value of [undefined, false, 'false', true, '1']) assert.equal(tournamentsEnabled(value), false);
  assert.equal(tournamentsEnabled('true'), true);
  const signal = new AbortController().signal;
  const calls = [];
  const wire = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({ id: tournament });
  };
  const spectator = createTournamentApi('https://qa.example', undefined, wire);
  await spectator.list(signal);
  await spectator.detail(tournament, signal);
  await assert.rejects(spectator.workspace(tournament, signal), { code: 'authentication_required' });
  await assert.rejects(spectator.transition(tournament, 'publish', signal), { code: 'authentication_required' });
  const staff = createTournamentApi('https://qa.example', 'staff-token', wire);
  await staff.list(signal);
  await staff.create('Cup', tournamentDefaults, signal);
  await staff.team(tournament, 'Alpha', null, signal);
  await staff.arbiter(tournament, actor, signal);
  await staff.transition(tournament, 'lock', signal);
  await staff.preview(tournament, signal);
  await staff.transition(tournament, 'publish', signal);
  await staff.result(tournament, match, { board_no: 2, revision: 7 }, 'correct', '-/+', 'Scoresheet', signal);

  assert.equal(calls[0].url.pathname, '/api/team-tournaments');
  assert.equal(calls[1].url.pathname, '/api/team-tournaments/' + tournament);
  assert.ok(calls.slice(0, 2).every(call => !call.headers.Authorization));
  assert.ok(calls.slice(2).every(call => call.headers.Authorization === 'Bearer staff-token' && call.cache === 'no-store'));
  assert.deepEqual(JSON.parse(calls[3].body), { name: 'Cup', rules: tournamentDefaults });
  assert.deepEqual(JSON.parse(calls[4].body), { name: 'Alpha', captain_id: null });
  assert.deepEqual(JSON.parse(calls[5].body), { user_id: actor });
  assert.equal(calls[7].url.pathname.endsWith('/preview'), true);
  assert.deepEqual(JSON.parse(calls[8].body), {});
  assert.equal(calls[9].url.pathname.endsWith('/matches/' + match + '/boards/2/correct'), true);
  assert.deepEqual(JSON.parse(calls[9].body), { result: '-/+', reason: 'Scoresheet', revision: 7 });
  assert.throws(() => staff.detail('../private', signal), { code: 'invalid_input' });
});

test('revision conflicts preserve the response code for the reload message', async () => {
  const api = createTournamentApi('https://qa.example', 'fixture', async () =>
    Response.json({ code: 'result_conflict' }, { status: 409 }));
  await assert.rejects(api.result(tournament, match, { board_no: 1, revision: 0 }, 'confirm', '1-0', 'Sheet',
    new AbortController().signal), { code: 'result_conflict' });
});

test('organizer, arbiter, captain and spectator views keep their controls and match scope separate', async () => {
  const vite = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { CreateTournament, TournamentDetail } = await vite.ssrLoadModule('/src/components/teamTournaments/TeamTournamentViews.tsx');
    const { tournamentCopy, tournamentErrorMessage } = await vite.ssrLoadModule('/src/components/teamTournaments/copy.ts');
    const tr = tournamentCopy('de');
    const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name, i) => ({ name, id: String(i), seed: i + 1 }));
    const boards = [
      { board_no: 1, home_white: true, result: '1-0', revision: 1, confirmed: false },
      { board_no: 2, home_white: false, result: '0-1', revision: 3, confirmed: true },
    ];
    const matches = [
      { id: 'alpha-match', round_no: 1, home_team_id: '0', away_team_id: '3', boards },
      { id: 'bravo-match', round_no: 1, home_team_id: '1', away_team_id: '2', boards },
    ];
    const scores = { standings: teams.map(team => ({ team_id: team.id, rank: 1, match_points: 1, board_points: 2, berliner_wertung: 5 })),
      matches: [{ match_id: matches[0].id, home_board_points: 3.5, away_board_points: 2.5, remaining_boards: 2, scenarios: {
        outcome: null, home: { draw_points_needed: 0.5, win_points_needed: 1 }, away: { draw_points_needed: 1.5, win_points_needed: 2 },
      } }] };
    const event = { id: tournament, name: 'Fixture Cup', status: 'published', roles: [], rules: tournamentDefaults, teams,
      rounds: [{ round_no: 1, bye_team_id: null }], matches, official: scores, provisional: scores };
    const actions = { team() {}, arbiter() {}, transition() {}, requestPreview() {} };
    const detail = (extra, preview = null, busy = false, captainId = null) => renderToStaticMarkup(createElement(TournamentDetail,
      { event: { ...event, ...extra }, tr, preview, busy, captainId, actions, onResult() {} }));
    const publicHtml = detail({});
    assert.match(publicHtml, /Offizielle Tabelle/);
    assert.match(publicHtml, /Vorläufig/);
    assert.match(publicHtml, /noch ½ für Remis, noch 1 für Sieg/);
    assert.match(publicHtml, /Weiß · Alpha/);
    assert.match(publicHtml, /Weiß · Delta/);
    assert.match(publicHtml, /1-0 · Weiß gewinnt/);
    assert.match(publicHtml, /0-1 · Schwarz gewinnt/);
    assert.doesNotMatch(publicHtml, /<form|Spielplan veröffentlichen|Korrigieren/);

    const captain = detail({ roles: ['captain'] }, null, false, '0');
    assert.match(captain, /Meine Mannschaft · Alpha/);
    assert.doesNotMatch(captain, /<form|Bravo – Charlie/);
    const arbiter = detail({ roles: ['arbiter'] });
    for (const label of ['Vorläufig erfassen', 'Bestätigen', 'Korrigieren', 'Weiß gewinnt kampflos', 'Schwarz gewinnt kampflos', 'Beide nicht angetreten']) {
      assert.ok(arbiter.includes(label), label);
    }
    assert.match(detail({ roles: ['arbiter'] }, null, true), /<fieldset disabled=""/);
    assert.doesNotMatch(detail({ roles: ['arbiter'], status: 'finished' }), /<form/);

    const organizer = { roles: ['organizer'], status: 'locked' };
    assert.doesNotMatch(detail(organizer), /Spielplan veröffentlichen/);
    assert.match(detail(organizer, { ruleset_version: 1, rounds: [{ round_no: 1, bye_team_id: null, matches }] }), /Spielplan veröffentlichen/);
    assert.match(detail({ roles: ['organizer'], status: 'registration' }), /Mannschaft zulassen/);
    assert.match(detail({ roles: ['organizer'], status: 'draft' }), /Anmeldung öffnen/);
    assert.match(renderToStaticMarkup(createElement(CreateTournament, { tr, busy: false, onCreate() {} })), /name="board_count"[^>]*value="4"/);
    for (const language of ['de', 'en', 'az', 'tr', 'ua', 'ru']) {
      const copy = tournamentCopy(language);
      assert.ok(copy('tab'));
      assert.ok(copy('whiteWins'));
      assert.ok(tournamentErrorMessage('result_conflict', copy).includes(copy('conflict')));
    }
    assert.match(tournamentErrorMessage('result_conflict', tr), /Lade das Turnier neu/);
  } finally {
    await vite.close();
  }
});
