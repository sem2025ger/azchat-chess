'use strict';

const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { RESULTS, bergerSchedule, calculateTable } = require('./teamRoundRobin');
const { validateEventTimes } = require('./teamTournamentTime');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RULES = {
  board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1, loss_points: 0,
  forfeit_win_units: 2, forfeit_loss_units: 0,
};
const RESPONSE_ERRORS = {
  '42501': [403, 'not_allowed'], P0002: [404, 'not_found'], '55000': [409, 'invalid_state'],
  '40001': [409, 'result_conflict'], '23505': [409, 'already_exists'],
  '23503': [400, 'invalid_input'], '23514': [400, 'invalid_input'], '22023': [400, 'invalid_input'], '22P02': [400, 'invalid_input'],
};

function fail(status, code) {
  throw Object.assign(new Error(code), { status, code });
}

function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'invalid_input');
}

function label(value, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum ||
      /[\x00-\x1f\x7f]/.test(value)) fail(400, 'invalid_input');
  return value.trim();
}

function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) fail(400, 'invalid_input');
  return value.toLowerCase();
}

function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, 'invalid_input');
  return value;
}

function createInput(body) {
  fields(body, ['name', 'rules']);
  const overrides = body.rules ?? {};
  fields(overrides, Object.keys(RULES));
  const rules = { ...RULES, ...overrides };
  integer(rules.board_count, 1, 16);
  for (const key of ['win_points', 'draw_points', 'loss_points']) integer(rules[key], 0, 10);
  for (const key of ['forfeit_win_units', 'forfeit_loss_units']) integer(rules[key], 0, 2);
  if (typeof rules.home_white_board_one !== 'boolean' ||
      rules.win_points <= rules.draw_points || rules.draw_points <= rules.loss_points ||
      rules.forfeit_win_units <= rules.forfeit_loss_units ||
      rules.forfeit_win_units + rules.forfeit_loss_units > 2) fail(400, 'invalid_input');
  return { name: label(body.name, 120), rules };
}

function makeClient(env, key, factory, token) {
  return factory(env.SUPABASE_URL, key, {
    ...(token ? { accessToken: async () => token } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function readQuery(query) {
  const { data, error } = await query.abortSignal(AbortSignal.timeout(8000));
  if (error?.code === 'P0001' && [
    'event_full', 'invalid_invite', 'lineup_incomplete', 'player_already_registered', 'no_previous_lineup',
  ].includes(error.message)) fail(error.message === 'no_previous_lineup' ? 404 : 409, error.message);
  if (error) fail(...(RESPONSE_ERRORS[error.code] ?? [503, 'temporarily_unavailable']));
  return data;
}

function rpc(client, name, args) {
  if (!client) fail(503, 'storage_unavailable');
  return readQuery(client.rpc(name, args));
}

async function listTournaments(client, actor, commandClient) {
  if (!client) fail(503, 'storage_unavailable');
  const fields = actor ? 'id,name,status,assignments:team_tournament_roles(role,team_id)' : 'id,name,status';
  let query = client.from('team_tournaments').select(fields)
    .order('published_at', { ascending: false, nullsFirst: true }).order('id').limit(50);
  if (actor) query = query.eq('assignments.user_id', actor);
  const [events, organizer] = await Promise.all([
    readQuery(query),
    actor && commandClient ? readQuery(commandClient.from('team_tournament_organizers')
      .select('user_id').eq('user_id', actor).limit(1)) : [],
  ]);
  const published = events.filter(e => e.status === 'published' || e.status === 'finished');
  // PostgREST keeps all visible rounds. The inner board embed selects only
  // matches with pending confirmation, with one marker per round.
  const rounds = published.length ? await readQuery(client.from('team_tournament_rounds')
    .select('tournament_id,round_no,matches:team_tournament_matches(boards:team_tournament_board_results!inner(board_no))')
    .in('tournament_id', published.map(e => e.id))
    .eq('matches.boards.confirmed', false)
    .limit(1, { referencedTable: 'matches' })
    .limit(1, { referencedTable: 'matches.boards' })
    .order('round_no').limit(50 * 15)) : [];
  const byEvent = new Map();
  for (const round of rounds) {
    const state = byEvent.get(round.tournament_id) ?? { firstOpen: null, last: null };
    if (round.matches.length) state.firstOpen ??= round.round_no;
    state.last = round.round_no;
    byEvent.set(round.tournament_id, state);
  }
  return {
    can_create: organizer.length > 0,
    tournaments: events.map(({ id, name, status, assignments }) => {
      const round = byEvent.get(id);
      return { id, name, status, current_round: (status === 'finished' ? round?.last : round?.firstOpen ?? round?.last) ?? null,
        ...(actor ? { captain_team_id: assignments?.find(role => role.role === 'captain')?.team_id ?? null } : {}) };
    }),
  };
}

function installTeamTournaments(app, {
  enabled = false, verifyToken = async () => null, clientForToken, publicClient, commandClient, now = Date.now,
} = {}) {
  const router = express();
  const budgets = new Map();
  router.set('trust proxy', 1);
  function limited(key, limit) {
    const time = now();
    let entry = budgets.get(key);
    if (entry && time - entry.start < 60000) return ++entry.count > limit;
    if (budgets.size >= 2000) {
      for (const [id, budget] of budgets) if (time - budget.start >= 60000) budgets.delete(id);
      if (budgets.size >= 2000) return true;
    }
    entry = { start: time, count: 1 };
    budgets.set(key, entry);
    return false;
  }

  const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!enabled) return next(Object.assign(new Error(), { status: 404, code: 'feature_disabled' }));
    if (limited('ip:' + req.ip, 120)) return next(Object.assign(new Error(), { status: 429, code: 'rate_limit' }));
    next();
  });
  router.param('tournament', wrap((req, res, next) => {
    req.tournamentId = uuid(req.params.tournament);
    next();
  }));

  async function snapshot(client, tournament, workspace) {
    const data = await rpc(client, 'team_tournament_snapshot', { p_id: tournament, p_workspace: workspace });
    if (!data) fail(404, 'not_found');
    return data;
  }
  function withStandings(data) {
    return { ...data, official: calculateTable(data.teams, data.matches, data.rules),
      provisional: calculateTable(data.teams, data.matches, data.rules, true) };
  }
  router.get('/:tournament', wrap(async (req, res) => res.json(withStandings(
    await snapshot(publicClient, req.tournamentId, false)))));

  // Anonymous registration overview: never include lineup rows, consent or captain IDs.
  router.get('/:tournament/self-service/public', wrap(async (req, res) => {
    const [event, config] = await Promise.all([
      readQuery(publicClient.from('team_tournaments').select('id,name,status')
        .eq('id', req.tournamentId).maybeSingle()),
      readQuery(publicClient.from('team_tournament_m3_config')
        .select('starts_at,registration_deadline,min_teams,max_teams')
        .eq('tournament_id', req.tournamentId).maybeSingle()),
    ]);
    if (!event || !config) fail(404, 'not_found');
    const teams = await readQuery(publicClient.from('team_tournament_teams')
      .select('id,name').eq('tournament_id', req.tournamentId).order('seed').limit(16));
    res.json({ ...event, ...config, teams, remaining_spots: Math.max(0, config.max_teams - teams.length) });
  }));
  async function authenticate(req) {
    const header = req.headers.authorization || '';
    let user;
    if (header.length <= 8192 && /^Bearer [^\s]+$/.test(header)) {
      try { user = await verifyToken(header.slice(7)); } catch { /* Fail closed. */ }
    }
    if (!UUID.test(user?.id ?? '') || user.is_anonymous) fail(401, 'authentication_required');
    if (limited('user:' + user.id, 60)) fail(429, 'rate_limit');
    req.tournamentActor = user.id;
    req.tournamentClient = clientForToken?.(header.slice(7));
  }
  router.get('/', wrap(async (req, res) => {
    if (req.headers.authorization !== undefined) await authenticate(req);
    const client = req.tournamentActor ? req.tournamentClient : publicClient;
    res.json(await listTournaments(client, req.tournamentActor, commandClient));
  }));
  router.use(wrap(async (req, res, next) => {
    await authenticate(req);
    next();
  }));
  router.use(express.json({ limit: '12kb' }));
  const command = (req, action, input) => rpc(commandClient, 'team_tournament_command', {
    p_actor: req.tournamentActor, p_action: action, p_id: req.tournamentId ?? null, p_input: input,
  });
  router.post('/', wrap(async (req, res) => res.status(201).json(await command(req, 'create', createInput(req.body)))));
  // M3 creation is atomic: M1 event, ruleset, M3 deadlines and registration
  // commit or roll back together. Local wall times are checked again server-side.
  router.post('/self-service', wrap(async (req, res) => {
    fields(req.body, ['name', 'start_time', 'registration_deadline', 'boards_per_team', 'min_teams', 'max_teams']);
    const name = label(req.body.name, 120);
    const boardCount = integer(req.body.boards_per_team ?? 4, 1, 16);
    const minimum = integer(req.body.min_teams ?? 2, 2, 16);
    const maximum = integer(req.body.max_teams ?? 4, minimum, 16);
    let times;
    try {
      times = validateEventTimes(req.body.start_time, req.body.registration_deadline, now());
    } catch { fail(400, 'invalid_time'); }
    res.status(201).json(await rpc(commandClient, 'team_tournament_m3_create', {
      p_actor: req.tournamentActor,
      p_name: name,
      p_rules: { ...RULES, board_count: boardCount },
      p_starts_at: times.starts_at,
      p_registration_deadline: times.registration_deadline,
      p_min_teams: minimum,
      p_max_teams: maximum,
    }));
  }));
  router.get('/:tournament/workspace', wrap(async (req, res) => res.json(withStandings(
    await snapshot(req.tournamentClient, req.tournamentId, true)))));
  const m3command = (req, action, input = {}) => rpc(commandClient, 'team_tournament_m3_command', {
    p_actor: req.tournamentActor, p_action: action, p_id: req.tournamentId, p_input: input,
  });
  router.post('/:tournament/invites', wrap(async (req, res) => {
    fields(req.body, ['club_name']);
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await m3command(req, 'create_invite', {
      club_name: label(req.body.club_name, 120), token_hash: tokenHash,
    });
    // The raw token is returned exactly once and never stored by the API.
    res.status(201).json({ ...result, token });
  }));
  router.post('/:tournament/invites/:invite/revoke', wrap(async (req, res) => {
    fields(req.body ?? {}, []);
    res.json(await m3command(req, 'revoke_invite', { invite_id: uuid(req.params.invite) }));
  }));
  router.post('/:tournament/redeem', wrap(async (req, res) => {
    fields(req.body, ['token']);
    if (typeof req.body.token !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.token)) {
      fail(400, 'invalid_input');
    }
    res.json(await m3command(req, 'redeem_invite', {
      token_hash: createHash('sha256').update(req.body.token).digest('hex'),
    }));
  }));
  router.post('/:tournament/lineup', wrap(async (req, res) => {
    fields(req.body, ['players']);
    if (!Array.isArray(req.body.players) || req.body.players.length > 16) fail(400, 'invalid_input');
    res.json(await m3command(req, 'set_lineup', { players: req.body.players.map(uuid) }));
  }));
  for (const [route, action] of [
    ['previous', 'copy_previous'], ['consent', 'consent'],
    ['submit', 'submit'], ['withdraw', 'withdraw'],
  ]) {
    router.post('/:tournament/lineup/' + route, wrap(async (req, res) => {
      fields(req.body ?? {}, []);
      res.json(await m3command(req, action));
    }));
  }

  router.get('/:tournament/self-service', wrap(async (req, res) => {
    const client = req.tournamentClient;
    const [config, event] = await Promise.all([
      readQuery(client.from('team_tournament_m3_config').select(
        'starts_at,registration_deadline,min_teams,max_teams').eq('tournament_id', req.tournamentId).maybeSingle()),
      readQuery(client.from('team_tournaments').select('id,name,status').eq('id', req.tournamentId).maybeSingle()),
    ]);
    if (!config || !event) fail(404, 'not_found');
    const teams = await readQuery(client.from('team_tournament_teams')
      .select('id,name').eq('tournament_id', req.tournamentId).order('seed').limit(16));
    const entries = await readQuery(client.from('team_tournament_m3_entries')
      .select('id,club_name,submitted_at').eq('tournament_id', req.tournamentId).limit(16));
    const ownRows = await readQuery(client.from('team_tournament_m3_lineups')
      .select('entry_id,board_no,player_id').eq('player_id', req.tournamentActor).limit(32));
    const rosterIds = [...new Set([...teams.map(team => team.id),
      ...entries.map(entry => entry.id), ...ownRows.map(row => row.entry_id)])];
    const lineups = rosterIds.length ? await readQuery(client.from('team_tournament_m3_lineups')
      .select('entry_id,board_no,player_id').in('entry_id', rosterIds).order('board_no').limit(256)) : [];
    res.json({ ...event, ...config, teams, remaining_spots: config.max_teams - teams.length,
      entries, lineups });
  }));

  router.post('/:tournament/teams', wrap(async (req, res) => {
    fields(req.body, ['name', 'captain_id']);
    const captain = req.body.captain_id == null ? null : uuid(req.body.captain_id);
    res.status(201).json(await command(req, 'approve_team', { name: label(req.body.name, 120), captain_id: captain }));
  }));
  router.post('/:tournament/arbiters', wrap(async (req, res) => {
    fields(req.body, ['user_id']);
    res.json(await command(req, 'assign_arbiter', { user_id: uuid(req.body.user_id) }));
  }));
  for (const action of ['register', 'lock', 'finish']) {
    router.post('/:tournament/' + action, wrap(async (req, res) => {
      fields(req.body ?? {}, []);
      res.json(await command(req, action, {}));
    }));
  }
  async function organizerWorkspace(req) {
    const data = await snapshot(req.tournamentClient, req.tournamentId, true);
    if (!data.roles.includes('organizer')) fail(403, 'not_allowed');
    return data;
  }
  router.get('/:tournament/preview', wrap(async (req, res) => {
    const data = await organizerWorkspace(req);
    if (data.status !== 'locked') fail(409, 'invalid_state');
    res.json({ ruleset_version: data.rules.version, rounds: bergerSchedule(data.teams.map(team => team.id), data.rules) });
  }));
  router.post('/:tournament/publish', wrap(async (req, res) => {
    fields(req.body ?? {}, []);
    const data = await organizerWorkspace(req);
    if (!['locked', 'published', 'finished'].includes(data.status)) fail(409, 'invalid_state');
    const rounds = data.status === 'locked' ? bergerSchedule(data.teams.map(team => team.id), data.rules) : [];
    res.json(await command(req, 'publish', { rounds }));
  }));

  for (const action of ['record', 'confirm', 'correct']) {
    router.post('/:tournament/matches/:match/boards/:board/' + action, wrap(async (req, res) => {
      fields(req.body, ['result', 'reason', 'revision']);
      if (!RESULTS.includes(req.body.result) || req.body.result === 'pending' ||
          !/^(?:[1-9]|1[0-6])$/.test(req.params.board)) fail(400, 'invalid_input');
      res.json(await command(req, action, {
        match_id: uuid(req.params.match), board_no: Number(req.params.board), result: req.body.result,
        reason: label(req.body.reason, 500), revision: integer(req.body.revision, 0, 2147483646),
      }));
    }));
  }
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ code: 'invalid_input' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ code: 'invalid_input' });
    if (!error.status || !error.code) return res.status(503).json({ code: 'temporarily_unavailable' });
    res.status(error.status).json({ code: error.code });
  });
  app.use('/api/team-tournaments', router);
}

function installTeamTournamentsFromEnv(app, verifyToken, env = process.env, factory = createClient) {
  const enabled = env.TEAM_TOURNAMENTS_ENABLED === 'true';
  const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const configured = enabled && env.SUPABASE_URL && publicKey;
  return installTeamTournaments(app, {
    enabled, verifyToken,
    publicClient: configured ? makeClient(env, publicKey, factory) : null,
    clientForToken: configured ? token => makeClient(env, publicKey, factory, token) : null,
    commandClient: configured && serviceKey ? makeClient(env, serviceKey, factory) : null,
  });
}

module.exports = { installTeamTournaments, installTeamTournamentsFromEnv };
