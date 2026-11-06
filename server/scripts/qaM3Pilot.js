'use strict';

const { appendFileSync } = require('node:fs');
const { createHash, randomBytes } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { berlinLocal, berlinLocalToIso } = require('../teamTournamentTime');
const { qaTarget, QA_REF, M3_RENDER_HOST } = require('./qaM3PilotTarget');
const { connect, fixtureUsers, cleanupEvents, verifyUserCleanup, inviteStorage } = require('./qaM3PilotDb');

const steps = [
  'Organizer and Berlin schedule', 'Invite digest and storage privacy',
  'Revoked, expired and unauthenticated redemption', 'Single use and captain ownership',
  'Bounded lookup and incomplete roster', 'Player consent and team submission',
  'Edit, slot release and previous draft', 'Spectator and cross-team REST/RPC isolation',
  'Concurrent 5-for-4 and withdrawal', 'One publication at the deadline',
  'Three, two and one team', 'Published pairings, names, colors and standings',
  'Home card API and player JWT', 'Player win, opponent confirmation and score',
  'Dispute, organizer decision and audit', 'Captain boundaries and no-show confirmation',
  'Correction, standings and round progression',
];

const roles = ['O', 'A', 'C1', 'C2', 'C3', 'C4',
  ...Array.from({ length: 16 }, (_, i) => 'P' + (i + 1)), 'S'];
const captainRoles = ['C1', 'C2', 'C3', 'C4'];
const draw = '1/2-1/2';
const matchOutcomes = ['1-0', '0-1', draw, '+/-', '-/+', '-/-'];
const boardPath = (match, board) => `/matches/${match.id}/boards/${board.board_no}/m3`;
const summarize = (value) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, value + '\n');
};
const mask = (value) => {
  if (process.env.GITHUB_ACTIONS === 'true' && value) {
    process.stdout.write(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}\n`);
  }
};

class PilotFailure extends Error {}
function check(value, message) {
  if (!value) throw new PilotFailure(message);
}
function safeFailure(error) {
  return error instanceof PilotFailure ? error.message : 'Unexpected HTTP, PostgreSQL or runner error. Diagnostics withheld.';
}

async function request(origin, path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(origin + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

function expect(response, status, code) {
  check(response.status === status && (code === undefined || response.data?.code === code),
    `Expected HTTP ${status}${code ? ' (' + code + ')' : ''}; received HTTP ${response.status}.`);
  return response.data;
}

function timeInBerlin(instant) {
  // Wall time has minute precision and rejects DST gaps and overlaps.
  const minute = Math.ceil(instant / 60000) * 60000;
  for (let offset = 0; offset < 120; offset++) {
    const candidate = minute + offset * 60000;
    const wall = berlinLocal(candidate);
    try {
      if (Date.parse(berlinLocalToIso(wall)) === candidate) return { wall, candidate };
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  throw new PilotFailure('Could not find an unambiguous Berlin wall time.');
}

async function runPilot({ target, db, tag, email, anonKey, serviceKey, step, signal }) {
  const users = {};
  const recentRequests = [];
  async function reserveApiBudget(count) {
    // Leave headroom below the server's 120/minute IP budget. Reserve
    // concurrent test calls together so the race still reaches the server.
    while (true) {
      signal.throwIfAborted();
      const now = Date.now();
      while (recentRequests[0] <= now - 61000) recentRequests.shift();
      if (recentRequests.length + count <= 100) return;
      await sleep(recentRequests[0] + 61000 - now, undefined, { signal });
    }
  }
  const api = async (path, user, body) => {
    await reserveApiBudget(1);
    recentRequests.push(Date.now());
    return request(target.api, '/api/team-tournaments' + path, {
      method: body === undefined ? 'GET' : 'POST', body,
      headers: user ? { Authorization: `Bearer ${user.token}` } : {},
    });
  };
  const rest = (user, resource, params, options = {}) => {
    signal.throwIfAborted();
    return request(target.supabase, '/rest/v1/' + resource + (params ? '?' + new URLSearchParams(params) : ''), {
      ...options, headers: { apikey: anonKey, Authorization: `Bearer ${user?.token ?? anonKey}` },
    });
  };
  const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  expect(await api('/user-search?q=m3'), 401, 'authentication_required');
  for (const role of roles) {
    signal.throwIfAborted();
    const username = 'm3p' + BigInt(process.env.GITHUB_RUN_ID).toString(36) + role.toLowerCase();
    const password = randomBytes(32).toString('base64url') + '!a1';
    mask(password);
    const created = await request(target.supabase, '/auth/v1/admin/users', {
      method: 'POST', headers: admin, body: {
        email: email(role), password, email_confirm: true, user_metadata: { username },
        app_metadata: { chessaz_m3_pilot: tag },
      },
    });
    check([200, 201].includes(created.status) && created.data?.id && created.data.email === email(role),
      'Supabase Auth could not create a synthetic account.');
    const signed = expect(await request(target.supabase, '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: anonKey }, body: { email: email(role), password },
    }), 200);
    check(signed?.access_token && signed.user?.id === created.data.id, 'Supabase Auth did not return the expected JWT.');
    mask(signed.access_token);
    mask(signed.refresh_token);
    users[role] = { id: created.data.id, token: signed.access_token, username };
  }
  const { O, A, C1, C2, P1, S } = users;
  const query = async (sql, args) => (await db.query(sql, args)).rows;
  const profile = await query('SELECT username FROM public.profiles WHERE id=$1', [O.id]);
  check(profile.length === 1, 'The QA Auth account did not produce a profile in the guarded QA database.');
  const fixture = await fixtureUsers(db, tag, roles.map(email));
  check(fixture.length === roles.length, 'The SQL connection does not see all run-owned QA Auth accounts.');
  expect(await api('/user-search?q=m3', S), 200);
  const due = await query(`SELECT 1 FROM public.team_tournament_m3_config c
    JOIN public.team_tournaments t ON t.id=c.tournament_id
    WHERE t.status='registration' AND c.registration_deadline < clock_timestamp() + interval '15 minutes'
    LIMIT 1`);
  check(due.length === 0, 'Another QA registration is due during this run; global tournament reads would advance it.');
  await db.query('INSERT INTO public.team_tournament_organizers(user_id) VALUES($1)', [O.id]);

  const event = async (label, boards, deadline, start = deadline + 3600000) => {
    const name = `[${tag}] ${label}`;
    const payload = {
      name, boards_per_team: boards, min_teams: 2, max_teams: 4,
      registration_deadline: berlinLocal(deadline), start_time: timeInBerlin(start).wall,
    };
    const created = expect(await api('/self-service', O, payload), 201);
    check(created?.id && created.status === 'registration', 'Event was not created in registration.');
    return { id: created.id, name, deadline, payload };
  };
  const route = (e, path) => '/' + e.id + path;
  const open = (e, user) => api(route(e, '/self-service' + (user ? '' : '/public')), user).then(r => expect(r, 200));
  const invite = async (e, name) => {
    const value = expect(await api(route(e, '/invites'), O, { club_name: name }), 201);
    check(value?.invite_id && /^[a-f0-9]{64}$/.test(value.token), 'Invite response was invalid.');
    mask(value.token);
    return { ...value, name };
  };
  const redeem = (e, user, value) => api(route(e, '/redeem'), user, { token: value.token });
  const lineup = (e, user, action, body = {}) => api(route(e, '/lineup' + action), user, body);
  const submit = (e, user) => lineup(e, user, '/submit');
  const draft = async (e, captain, value, players) => {
    const data = expect(await redeem(e, captain, value), 200);
    check(data.club_name === value.name && data.entry_id, 'Captain received an unexpected entry.');
    const roster = { id: data.entry_id, captain, players, name: value.name };
    await setLineup(e, roster);
    return roster;
  };
  const setLineup = async (e, roster) => {
    const data = expect(await lineup(e, roster.captain, '', { players: roster.players.map(p => p.id) }), 200);
    check(data.entry_id === roster.id && data.boards === roster.players.length, 'Saved lineup was incorrect.');
  };
  const consent = async (e, roster) => {
    for (const player of roster.players) {
      const data = expect(await lineup(e, player, '/consent', { entry_id: roster.id }), 200);
      check(data.consented === true && data.entry_id === roster.id, 'Consent was not tied to its exact entry.');
    }
  };
  const submitted = async (e, roster) => {
    const data = expect(await submit(e, roster.captain), 200);
    check(data.submitted === true && data.entry_id === roster.id, 'Complete lineup was not submitted.');
  };
  const club = index => `${tag} Club ${index + 1}`;
  const commandArgs = (e) => ({
    p_actor: O.id, p_action: 'withdraw', p_id: e.id, p_input: {},
  });
  const readBoard = async (user) => expect(await api('/my-board', user), 200).board;
  const getSnapshot = (e) => api(route(e, '')).then(r => expect(r, 200));

  const deadline = timeInBerlin(Date.now() + 4 * 60000).candidate;
  check(deadline - Date.now() <= 5 * 60000, 'Run outside the Berlin daylight-saving transition.');
  const later = timeInBerlin(deadline + 3600000).candidate;
  let main;
  let invites;
  let unused;
  let rosters;
  await step(1, async () => {
    main = await event('Four teams', 4, deadline);
    const publicEvent = await open(main);
    check(publicEvent.name === main.name && publicEvent.board_count === 4 &&
      publicEvent.min_teams === 2 && publicEvent.max_teams === 4 &&
      publicEvent.remaining_spots === 4 && publicEvent.teams.length === 0 &&
      Date.parse(publicEvent.starts_at) === Date.parse(berlinLocalToIso(main.payload.start_time)) &&
      Date.parse(publicEvent.registration_deadline) === deadline, 'Public event configuration did not match the request.');
    expect(await api('/self-service', S, main.payload), 403, 'not_allowed');
    expect(await api(route(main, '/arbiters'), O, { user_id: A.id }), 200);
  });
  await step(2, async () => {
    invites = [];
    for (let i = 0; i < 4; i++) invites.push(await invite(main, club(i)));
    const stored = await inviteStorage(db, main.id);
    const storedInvites = stored.filter(row => row.source === 'invites').map(row => row.data);
    check(new Set(invites.map(value => value.token)).size === 4 && storedInvites.length === 4,
      'Expected four distinct invite tokens and rows.');
    const serialized = JSON.stringify(stored);
    for (const value of invites) {
      const digest = createHash('sha256').update(value.token).digest('hex');
      check(!serialized.includes(value.token), 'SECURITY: plaintext invite token found in QA PostgreSQL.');
      check(storedInvites.some(row => row.id === value.invite_id && row.token_hash === digest),
        'Invite did not persist the matching SHA-256 digest.');
    }
    for (const actor of [S, C2]) {
      const denied = await rest(actor, 'team_tournament_m3_invites', { tournament_id: 'eq.' + main.id, select: 'token_hash' });
      check(denied.status === 403 && denied.data?.code === '42501',
        'SECURITY: could not verify that invite digest reads are denied.');
    }
    const revoked = await invite(main, `${tag} Revoked`);
    unused = await invite(main, `${tag} Expired`);
    expect(await api(route(main, '/invites/' + revoked.invite_id + '/revoke'), O, {}), 200);
    expect(await redeem(main, S, revoked), 409, 'invalid_invite');
    expect(await redeem(main, null, unused), 401, 'authentication_required');
  });
  await step(4, async () => {
    rosters = [];
    for (let i = 0; i < 4; i++) {
      const captain = users[captainRoles[i]];
      const data = expect(await redeem(main, captain, invites[i]), 200);
      check(data.club_name === club(i) && data.entry_id, 'Wrong captain entry after redemption.');
      rosters.push({ id: data.entry_id, captain, name: club(i),
        players: Array.from({ length: 4 }, (_, board) => users['P' + (i * 4 + board + 1)]) });
    }
    expect(await redeem(main, C1, invites[0]), 409, 'invalid_invite');
    expect(await redeem(main, C2, invites[0]), 409, 'invalid_invite');
    expect(await redeem(main, C1, unused), 409, 'already_exists');
    check(new Set(rosters.map(row => row.id)).size === 4, 'Each captain must have exactly one entry.');
  });
  await step(5, async () => {
    expect(await api('/user-search?q=m', C1), 400, 'invalid_input');
    expect(await api('/user-search?q=' + 'x'.repeat(31), C1), 400, 'invalid_input');
    const matches = expect(await api('/user-search?q=' + P1.username, C1), 200).users;
    check(matches.length <= 10 && matches.some(row => row.id === P1.id), 'Bounded username search did not find P1.');
    for (const roster of rosters) {
      await setLineup(main, roster);
      expect(await submit(main, roster.captain), 409, 'lineup_incomplete');
    }
  });
  await step(6, async () => {
    expect(await lineup(main, C1, '/consent', { entry_id: rosters[0].id }), 403, 'not_allowed');
    expect(await lineup(main, P1, '/consent', { entry_id: rosters[1].id }), 403, 'not_allowed');
    for (const roster of rosters) {
      await consent(main, roster);
      await submitted(main, roster);
    }
    const publicEvent = await open(main);
    check(publicEvent.remaining_spots === 0 && publicEvent.teams.length === 4, 'Expected all four spots to be held.');
    await setLineup(main, rosters[0]);
    check((await open(main)).remaining_spots === 1, 'Editing the roster did not release its spot.');
    expect(await submit(main, C1), 409, 'lineup_incomplete');
    await consent(main, rosters[0]);
    await submitted(main, rosters[0]);
    check((await open(main)).remaining_spots === 0, 'Resubmission did not reclaim the spot.');
  });
  await step(8, async () => {
    const publicEvent = await open(main);
    const spectator = await open(main, S);
    const rival = await open(main, C2);
    const c1Selection = { entry_id: 'eq.' + rosters[0].id, select: 'board_no,player_id' };
    const playerIds = rosters.flatMap(row => row.players.map(p => p.id));
    const privateKeys = /"(?:player_id|board_no|captain_id|consented_at)"\s*:/;
    const noRoster = (data) => !privateKeys.test(JSON.stringify(data)) &&
      playerIds.every(id => !JSON.stringify(data).includes(id));
    const visibleClubs = data => data.remaining_spots === 0 &&
      JSON.stringify(data.teams.map(row => row.name).sort()) === JSON.stringify(rosters.map(row => row.name).sort());
    check(visibleClubs(publicEvent) && visibleClubs(spectator) && noRoster(publicEvent) && noRoster(spectator) &&
      !publicEvent.published_lineups && spectator.lineups.length === 0 && spectator.entries.length === 0 &&
      spectator.profiles.length === 0, 'SECURITY: spectator response did not preserve pre-publication privacy.');
    check(rival.lineups.length === 4 && rival.lineups.every(row => row.entry_id === rosters[1].id) &&
      rival.entries.every(row => row.id !== rosters[0].id), 'SECURITY: a captain saw a foreign roster.');
    for (const actor of [null, S, C2]) {
      const foreign = expect(await rest(actor, 'team_tournament_m3_lineups', c1Selection), 200);
      check(foreign.length === 0, 'SECURITY: direct REST returned a foreign roster.');
    }
    for (const actor of [S, C2]) {
      const write = await rest(actor, 'team_tournament_m3_lineups', c1Selection,
        { method: 'PATCH', body: { player_id: S.id } });
      check(write.status === 403 && write.data?.code === '42501',
        'SECURITY: could not verify that direct foreign lineup writes are denied.');
      const rpc = await rest(actor, 'rpc/team_tournament_m3_command', null, { method: 'POST', body: commandArgs(main) });
      check(rpc.status === 403 && rpc.data?.code === '42501',
        'SECURITY: could not verify that user JWTs cannot call the privileged RPC.');
    }
    expect(await redeem(main, S, invites[0]), 409, 'invalid_invite');
  });

  const variants = [];
  for (const count of [3, 2, 1]) {
    const variant = await event(`${count} teams`, 1, deadline, later + 3600000);
    for (let i = 0; i < count; i++) {
      const roster = await draft(variant, users[captainRoles[i]], await invite(variant, `${tag} Variant ${i}`),
        [users['P' + (i * 4 + 3)]]);
      await consent(variant, roster);
      await submitted(variant, roster);
    }
    variants.push({ ...variant, count });
  }
  await step(9, async () => {
    const race = await event('Capacity race', 1, later);
    const entries = [];
    for (const [i, role] of [...captainRoles, 'A'].entries()) {
      const roster = await draft(race, users[role], await invite(race, `${tag} Race ${i + 1}`),
        [users['P' + (i + 1)]]);
      await consent(race, roster);
      entries.push(roster);
    }
    await reserveApiBudget(entries.length);
    const settled = await Promise.allSettled(entries.map(row => submit(race, row.captain)));
    check(settled.every(row => row.status === 'fulfilled'), 'Capacity race HTTP request failed.');
    const replies = settled.map(row => row.value);
    const winners = replies.flatMap((reply, i) =>
      reply.status === 200 && reply.data?.entry_id === entries[i].id && reply.data.submitted ? [i] : []);
    const losers = replies.flatMap((reply, i) => reply.status === 409 && reply.data?.code === 'event_full' ? [i] : []);
    check(winners.length === 4 && losers.length === 1, 'Expected exactly four successes and one event_full.');
    expect(await lineup(race, entries[winners[0]].captain, '/withdraw'), 200);
    check((await open(race)).remaining_spots === 1, 'Withdrawal did not release a spot.');
    await submitted(race, entries[losers[0]]);
    check((await open(race)).remaining_spots === 0, 'Replacement captain did not claim the freed spot.');
  });

  let snapshot;
  await step(10, async () => {
    await sleep(Math.max(0, deadline + 1500 - Date.now()), undefined, { signal });
    const before = await query('SELECT status,published_at FROM public.team_tournaments WHERE id=$1', [main.id]);
    check(before[0]?.status === 'registration' && !before[0].published_at, 'Event transitioned without an M3 access.');
    await reserveApiBudget(2);
    const parallel = await Promise.allSettled([api(route(main, ''), null), submit(main, C1)]);
    check(parallel.every(row => row.status === 'fulfilled'), 'Concurrent deadline GET/command failed.');
    snapshot = expect(parallel[0].value, 200);
    expect(parallel[1].value, 409, 'invalid_state');
    const [counts] = await query(`
      SELECT
        (SELECT count(*)::int FROM public.team_tournament_rounds WHERE tournament_id=$1) AS rounds,
        (SELECT count(*)::int FROM public.team_tournament_matches WHERE tournament_id=$1) AS matches,
        (SELECT count(*)::int FROM public.team_tournament_board_results WHERE tournament_id=$1) AS boards`, [main.id]);
    check(snapshot.status === 'published' && snapshot.published_at &&
      counts.rounds === 3 && counts.matches === 6 && counts.boards === 24 &&
      (await getSnapshot(main)).published_at === snapshot.published_at, 'Deadline publication was missing or duplicated.');
  });
  await step(3, async () => {
    expect(await redeem(main, S, unused), 409, 'invalid_state');
    const [row] = await query(
      'SELECT redeemed_by, redeemed_at FROM public.team_tournament_m3_invites WHERE id=$1 AND tournament_id=$2',
      [unused.invite_id, main.id]);
    check(row && row.redeemed_by === null && row.redeemed_at === null, 'Expired invite was recorded as redeemed.');
  });
  await step(7, async () => {
    const next = await event('Previous lineup', 4, later, later + 3600000);
    const previousInvite = await invite(next, rosters[0].name);
    const entry = expect(await redeem(next, C1, previousInvite), 200);
    expect(await lineup(next, C1, '/previous'), 200);
    const copied = (await open(next, C1)).lineups.filter(row => row.entry_id === entry.entry_id);
    check(copied.length === 4 && copied.every(row =>
      row.player_id === rosters[0].players[row.board_no - 1]?.id && row.consented_at === null),
    'Previous lineup did not preserve order or carried over consent.');
    expect(await submit(next, C1), 409, 'lineup_incomplete');
  });
  await step(11, async () => {
    for (const variant of variants) {
      const overview = await open(variant, C1);
      if (variant.count === 1) {
        check(overview.status === 'cancelled' && overview.matches.length === 0, 'One team must cancel without matches.');
      } else {
        const view = await getSnapshot(variant);
        check(view.rounds.length === (variant.count === 3 ? 3 : 1) &&
          view.matches.length === view.rounds.length &&
          view.rounds.every(row => Boolean(row.bye_team_id) === (variant.count === 3)) &&
          new Set(view.rounds.map(row => row.bye_team_id)).size === view.rounds.length,
        'Wrong rounds, pairings or byes for the team count.');
      }
      expect(await lineup(variant, C1, '', { players: [] }), 409, 'invalid_state');
      const own = overview.entries.find(row => row.captain_id === C1.id);
      check(own?.id, 'Captain did not see their own entry after the deadline.');
      const patch = await rest(C1, 'team_tournament_m3_lineups', { entry_id: 'eq.' + own.id },
        { method: 'PATCH', body: { player_id: S.id } });
      check(patch.status === 403 && patch.data?.code === '42501', 'SECURITY: post-deadline direct REST write was not denied.');
      const rpc = await rest(C1, 'rpc/team_tournament_m3_command', null, { method: 'POST', body: commandArgs(variant) });
      check(rpc.status === 403 && rpc.data?.code === '42501', 'SECURITY: post-deadline privileged RPC was not denied.');
    }
  });

  const byTeam = new Map(rosters.map(row => [row.id, row]));
  const inRound = (view, round) => view.matches.filter(row => row.round_no === round);
  const rosterAt = (match, team, board) => byTeam.get(match[team + '_team_id']).players[board.board_no - 1];
  const byColor = (match, board) => {
    const home = rosterAt(match, 'home', board);
    const away = rosterAt(match, 'away', board);
    return board.home_white ? [home, away] : [away, home];
  };
  const outcomeFor = (match, board, team, forfeit = false) => {
    const isWhite = (match.home_team_id === team) === board.home_white;
    return forfeit ? (isWhite ? '+/-' : '-/+'): (isWhite ? '1-0' : '0-1');
  };
  const result = (match, board, actor, action, value = null, reason = null) =>
    api(route(main, boardPath(match, board) + '/' + action), actor, { result: value, reason });
  const recorded = async (match, board, actor, action, state, value, reason) => {
    const row = expect(await result(match, board, actor, action, value, reason), 200);
    check(row.status === state && row.confirmed === (state === 'confirmed'), 'Unexpected board state or confirmation.');
    return row;
  };
  const getReports = (match, board, actor) => api(route(main, boardPath(match, board) + '/reports'), actor).then(r => expect(r, 200));
  const auditFor = (match, board, actor) => rest(actor, 'team_tournament_m3_action_audit',
    { tournament_id: 'eq.' + main.id, match_id: 'eq.' + match.id, board_no: 'eq.' + board.board_no, order: 'id' })
    .then(r => expect(r, 200));
  await step(12, async () => {
    const overview = await open(main);
    const [pairCount, playerCount] = [new Set(snapshot.matches.map(m => [m.home_team_id, m.away_team_id].sort().join(':'))).size,
      overview.published_lineups.length];
    check(pairCount === 6 && playerCount === 16 &&
      snapshot.rounds.every((round, i) => round.round_no === i + 1 && round.bye_team_id === null &&
        new Set(inRound(snapshot, i + 1).flatMap(row => [row.home_team_id, row.away_team_id])).size === 4),
    'Expected one round-robin pairing per team pair and all 16 board assignments.');
    const expectedProfiles = await query('SELECT id,username FROM public.profiles WHERE id=ANY($1::uuid[])',
      [rosters.flatMap(row => row.players.map(p => p.id))]);
    const names = new Map(expectedProfiles.map(row => [row.id, row.username]));
    check(overview.published_lineups.every(row => row.username &&
      row.username === names.get(byTeam.get(row.entry_id)?.players[row.board_no - 1]?.id)),
    'Published names or board order were incorrect.');
    check(snapshot.matches.every(match => match.boards.length === 4 && match.boards.every((board, i) =>
      board.board_no === i + 1 && board.home_white === (i % 2 === 0) && !board.confirmed &&
      board.result === 'pending' && board.source === null)), 'New board order, colors or sources were incorrect.');
    check(snapshot.official.standings.length === 4 && snapshot.official.standings.every(row =>
      row.played === 0 && row.match_points === 0 && row.board_points === 0 && row.rank === 1),
    'Initial standings were incorrect.');
  });

  const c1Team = rosters[0].id;
  const match = inRound(snapshot, 1).find(row => [row.home_team_id, row.away_team_id].includes(c1Team));
  const other = inRound(snapshot, 1).find(row => row.id !== match.id);
  const rivalTeam = match.home_team_id === c1Team ? match.away_team_id : match.home_team_id;
  const [one, two, three, four] = match.boards;
  const opponent = byColor(match, one).find(p => p.id !== P1.id);
  const p1Win = outcomeFor(match, one, c1Team);
  await step(13, async () => {
    const home = await readBoard(P1);
    const rpc = expect(await rest(P1, 'rpc/team_tournament_m3_my_board', null, { method: 'POST', body: {} }), 200);
    const [opponentProfile] = await query('SELECT username FROM public.profiles WHERE id=$1', [opponent.id]);
    check(home?.tournament_id === main.id && home.match_id === match.id && home.tournament_name === main.name &&
      home.round_no === 1 && home.board_no === 1 && home.opponent === opponentProfile.username &&
      home.side === (p1Win === '1-0' ? 'white' : 'black') && home.status === 'pending' && !home.confirmed &&
      rpc?.match_id === home.match_id && rpc.board_no === home.board_no && rpc.side === home.side,
    'Home card API or authenticated RPC returned the wrong player board.');
    check((await readBoard(S)) === null, 'SECURITY: spectator received another player’s Home board.');
  });
  const matchScore = view => view.official.matches.find(row => row.match_id === match.id);
  const standings = view => view.official.standings.find(row => row.team_id === c1Team);
  const teamPoints = score => match.home_team_id === c1Team ? score.home_board_points : score.away_board_points;
  await step(14, async () => {
    await recorded(match, one, P1, 'report', 'reported', p1Win);
    const opponentBoard = await readBoard(opponent);
    check(opponentBoard?.opponent_report === p1Win && opponentBoard.match_id === match.id &&
      opponentBoard.side === (p1Win === '1-0' ? 'black' : 'white') &&
      opponentBoard.status === 'reported' && !opponentBoard.confirmed,
    'Opponent did not receive the pending report from their own side.');
    await recorded(match, one, opponent, 'confirm', 'confirmed');
    const view = await getSnapshot(main);
    const board = view.matches.find(row => row.id === match.id).boards[0];
    const audit = await auditFor(match, one, O);
    check(board.result === p1Win && board.confirmed && board.source === 'player_report' &&
      audit.length === 2 && audit[0].actor_id === P1.id && audit[1].actor_id === opponent.id &&
      audit[1].action === 'confirm' && teamPoints(matchScore(view)) === 1 &&
      matchScore(view).remaining_boards === 3 && standings(view).played === 0,
    'Confirmed result, audit, match score or standings were incorrect.');
  });
  await step(15, async () => {
    const [white, black] = byColor(match, two);
    await recorded(match, two, white, 'report', 'reported', '1-0');
    await recorded(match, two, black, 'report', 'disputed', '0-1');
    const reports = await getReports(match, two, O);
    check(reports.status === 'disputed' && reports.reports.length === 2 &&
      reports.reports.some(row => row.side === 'white' && row.result === '1-0') &&
      reports.reports.some(row => row.side === 'black' && row.result === '0-1'),
    'Staff did not see both conflicting reports.');
    const spectator = await getReports(match, two, S);
    check(spectator.status === 'pending' && spectator.reports.length === 0 &&
      (await auditFor(match, two, S)).length === 0, 'SECURITY: spectator saw private board reports or audit.');
    const reason = 'Synthetic scoresheets reviewed';
    await recorded(match, two, O, 'decide', 'confirmed', draw, reason);
    const audit = await auditFor(match, two, O);
    const decision = audit.at(-1);
    check(audit.length === 3 && decision.action === 'decide' && decision.actor_id === O.id &&
      decision.actor_role === 'organizer' && Number.isFinite(Date.parse(decision.changed_at)) &&
      decision.reason === reason && decision.old_value.status === 'disputed' &&
      decision.new_value.board_result === draw && decision.new_value.source === 'organizer_decision',
    'Organizer decision did not retain source, actor, time and old/new values.');
  });
  await step(16, async () => {
    const [player] = byColor(match, three);
    const ownForfeitWin = outcomeFor(match, three, c1Team, true);
    const rivalCaptain = byTeam.get(rivalTeam).captain;
    expect(await result(other, other.boards[0], C1, 'report', '1-0'), 403, 'not_allowed');
    expect(await api(route(main, boardPath(match, three) + '/report'), C1,
      { result: '1-0', player_id: users.P5.id }), 400, 'invalid_input');
    expect(await result(match, three, player, 'forfeit', ownForfeitWin), 403, 'not_allowed');
    await recorded(match, four, C1, 'report', 'reported', outcomeFor(match, four, c1Team));
    const proxy = (await auditFor(match, four, O)).at(-1);
    check(proxy.actor_id === C1.id && proxy.actor_role === 'captain' &&
      proxy.new_value.side === (outcomeFor(match, four, c1Team) === '1-0' ? 'white' : 'black'),
    'Captain report was not attributed to their own side.');
    await recorded(match, three, C1, 'forfeit', 'reported', ownForfeitWin);
    expect(await result(match, three, C1, 'confirm'), 409, 'invalid_state');
    const rivalPlayer = byTeam.get(rivalTeam).players[2];
    expect(await result(match, three, rivalPlayer, 'confirm'), 409, 'invalid_state');
    await recorded(match, three, rivalCaptain, 'confirm', 'confirmed');
    const audit = await auditFor(match, three, O);
    check(audit.length === 2 && audit[0].actor_id === C1.id && audit[0].actor_role === 'captain' &&
      audit[0].new_value.side === (ownForfeitWin === '+/-' ? 'white' : 'black') &&
      audit[1].actor_id === rivalCaptain.id && audit[1].new_value.source === 'captain',
    'No-show was not restricted to the two captain sides.');
  });
  await step(17, async () => {
    await recorded(match, four, A, 'decide', 'confirmed', draw, 'Synthetic arbiter decision');
    const before = await getSnapshot(main);
    check(teamPoints(matchScore(before)) === 3 && standings(before).match_points === 2 &&
      standings(before).board_points === 3, 'Expected C1 to lead 3–1 after all boards in their match.');
    const corrected = p1Win === '1-0' ? '0-1' : '1-0';
    const reason = 'Synthetic appeal verified';
    await recorded(match, one, O, 'correct', 'confirmed', corrected, reason);
    const after = await getSnapshot(main);
    const trace = (await auditFor(match, one, O)).at(-1);
    check(teamPoints(matchScore(after)) === 2 && standings(after).match_points === 1 &&
      standings(after).board_points === 2 && trace.action === 'correct' && trace.reason === reason &&
      trace.old_value.board_result === p1Win && trace.new_value.board_result === corrected,
    'Correction did not change the confirmed standings and audit.');
    const next = inRound(after, 2).find(row => [row.home_team_id, row.away_team_id].includes(c1Team));
    expect(await result(next, next.boards[0], P1, 'report', '1-0'), 409, 'invalid_state');
    for (const board of other.boards.slice(0, 3)) {
      await recorded(other, board, O, 'decide', 'confirmed', draw, 'Synthetic round progression');
    }
    check((await readBoard(P1))?.round_no === 1, 'Round advanced with a prior board still pending.');
    await recorded(other, other.boards[3], O, 'decide', 'confirmed', draw, 'Synthetic last board');
    check((await readBoard(P1))?.round_no === 2, 'Round did not advance after the last board was confirmed.');
    const afterRounds = await getSnapshot(main);
    check(afterRounds.matches.every(row => row.boards.every(board =>
      !board.confirmed || matchOutcomes.includes(board.result) &&
      ['player_report', 'captain', 'organizer_decision', 'arbiter'].includes(board.source))),
    'Unexpected confirmed board result or online-game source.');
  });
}

async function cleanup(db, target, serviceKey, tag, email) {
  const emails = roles.map(email);
  const users = await fixtureUsers(db, tag, emails);
  await cleanupEvents(db, tag, users.filter(user => user.email === email('O')).map(user => user.id));
  let failed = false;
  for (const user of users) {
    try {
      const response = await request(target.supabase, '/auth/v1/admin/users/' + user.id, {
        method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      failed ||= ![200, 204, 404].includes(response.status);
    } catch {
      failed = true;
    }
  }
  await verifyUserCleanup(db, users.map(user => user.id), emails);
  check(!failed, 'Auth Admin did not acknowledge every cleanup request.');
}

async function main() {
  let target;
  let db;
  let connected = false;
  let pilotStarted = false;
  let exit = 0;
  const status = steps.map(() => 'NOT RUN');
  const controller = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => controller.abort());
  const { QA_SUPABASE_ANON_KEY: anonKey, QA_SUPABASE_SERVICE_KEY: serviceKey,
    QA_DATABASE_URL: databaseUrl, GITHUB_RUN_ID: runId } = process.env;
  const cleanupOnly = process.argv[2] === '--cleanup';
  const tag = 'QA-M3-' + runId;
  const email = role => tag.toLowerCase() + '-' + role.toLowerCase() + '@example.com';

  async function step(number, action) {
    try {
      controller.signal.throwIfAborted();
      await action();
      status[number - 1] = 'PASS';
    } catch (error) {
      status[number - 1] = 'FAIL';
      throw error;
    }
  }

  try {
    target = qaTarget(process.env);
    check(/^[1-9][0-9]{0,19}$/.test(runId ?? ''), 'GITHUB_RUN_ID is required.');
    check(anonKey && serviceKey && databaseUrl && anonKey !== serviceKey, 'Required QA credentials are missing or invalid.');
    for (const value of [anonKey, serviceKey, databaseUrl]) mask(value);
    console.log(`QA Supabase project: ${QA_REF}; Render host: ${M3_RENDER_HOST}`);
    db = connect(databaseUrl);
    await db.connect();
    connected = true;
    // Re-running the same Actions run ID also recovers a runner interrupted during a previous attempt.
    await cleanup(db, target, serviceKey, tag, email);
    if (cleanupOnly) {
      summarize('Cleanup retry **PASS** · 0 pilot rows, Auth accounts, sessions or profiles remain.');
    } else {
      pilotStarted = true;
      await runPilot({ target, db, tag, email, anonKey, serviceKey, step, signal: controller.signal });
      check(!controller.signal.aborted && status.every(value => value === 'PASS'), 'Pilot was interrupted or incomplete.');
    }
  } catch (error) {
    exit = 1;
    const note = safeFailure(error);
    summarize(`Failure · ${note}`);
    console.error(note);
  } finally {
    if (connected && pilotStarted) {
      try {
        await cleanup(db, target, serviceKey, tag, email);
        summarize('Cleanup **PASS** · 0 pilot rows, Auth accounts, sessions or profiles remain.');
      } catch {
        exit = 1;
        summarize('Cleanup **FAIL** · zero remaining pilot rows could not be verified.');
        console.error('Cleanup failed; inspect the retry step for its result.');
      }
    }
    if (db) await db.end().catch(() => {});
    if (!cleanupOnly) {
      summarize(`\n### Hosted M3 pilot · ${tag}\n\n| Step | Automated coverage | Result |\n| --- | --- | --- |`);
      steps.forEach((label, i) => summarize(`| ${i + 1} | ${label} | ${status[i]} |`));
      summarize('\nThe browser redirect, Home controls and hosted log review are manual acceptance items.');
    }
  }
  return exit;
}

main().then(code => { process.exitCode = code; }).catch(() => {
  console.error('Could not finish or write the hosted M3 pilot summary.');
  process.exitCode = 1;
});
