'use strict';

const express = require('express');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const results = new Set(['1-0', '0-1', '1/2-1/2']);
const conflicts = new Set(['event_full','registration_closed','create_limit','request_conflict','result_conflict','invalid_state']);

// Pair within score groups where possible. No repeated opponents or repeated byes.
function nextPairings(seeds, history) {
  const players = new Map(seeds.map((no, seed) => [no, { no, seed, points: 0, color: 0, bye: false, met: new Set() }]));
  for (const game of history) {
    const white = players.get(game.white_no);
    const black = players.get(game.black_no);
    if (!black) {
      white.bye = true;
      white.points += 2;
      continue;
    }
    white.met.add(black.no);
    black.met.add(white.no);
    white.color++;
    black.color--;
    if (game.result === '1-0') white.points += 2;
    else if (game.result === '0-1') black.points += 2;
    else { white.points++; black.points++; }
  }
  const ranked = [...players.values()].sort((a,b) => b.points - a.points || a.seed - b.seed);
  let budget = 20000;
  function draw(remaining) {
    if (!remaining.length) return [];
    if (--budget < 0) return null;
    const options = remaining.map(player => ({
      player, opponents: remaining.filter(other => other !== player && !player.met.has(other.no)),
    }));
    const { player, opponents } = options.reduce((a,b) => b.opponents.length < a.opponents.length ? b : a);
    opponents.sort((a,b) => Math.abs(a.points - player.points) - Math.abs(b.points - player.points) ||
      Math.abs(b.color - player.color) - Math.abs(a.color - player.color) || a.seed - b.seed);
    for (const other of opponents) {
      const whiteFirst = player.color < other.color ||
        (player.color === other.color && (player.seed + history.length) % 2 === 0);
      const rest = draw(remaining.filter(p => p !== player && p !== other));
      if (rest) return [{ white_no: whiteFirst ? player.no : other.no, black_no: whiteFirst ? other.no : player.no }, ...rest];
      if (budget < 0) break;
    }
    return null;
  }
  if (ranked.length % 2 === 0) return draw(ranked);
  for (const bye of [...ranked].reverse()) {
    if (bye.bye) continue;
    const pairings = draw(ranked.filter(player => player !== bye));
    if (pairings) return [...pairings, { white_no: bye.no, black_no: null }];
    if (budget < 0) break;
  }
  return null;
}

function label(value, max) {
  return typeof value === 'string' && value === value.trim() && value.length > 0 &&
    [...value].length <= max && !/\p{Cc}/u.test(value);
}

function validCommand(body) {
  const { action, input } = body ?? {};
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(body).length !== 2) return false;
  const fields = Object.keys(input).length;
  switch (action) {
    case 'publish': return fields === 0 || (fields === 3 && label(input.name,120) &&
      typeof input.starts_at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.starts_at) &&
      Number.isInteger(input.max_players) && input.max_players >= 2 && input.max_players <= 128);
    case 'join': return fields === 1 && label(input.name,40);
    case 'leave':
    case 'cancel': return fields === 0;
    case 'result': return fields === 3 && results.has(input.result) &&
      Number.isInteger(input.round_no) && input.round_no >= 1 && input.round_no <= 7 &&
      Number.isInteger(input.board_no) && input.board_no >= 1 && input.board_no <= 64;
    default: return false;
  }
}

function httpError(res, error) {
  const [status, code] = conflicts.has(error.message) ? [409, error.message] :
    error.message === 'invalid_time' ? [400, 'invalid_time'] :
    ({ '42501': [403,'not_allowed'], P0002: [404,'not_found'], '23505': [409,'already_exists'],
      '23514': [400,'invalid_input'], '22023': [400,'invalid_input'], '22007': [400,'invalid_time'],
      '22008': [400,'invalid_time'] })[error.code] ?? [503,'temporarily_unavailable'];
  return res.status(status).json({ code });
}

function installIndividualTournaments(app, { client, verifyToken, logError = () => {} }) {
  if (!client) return null;
  const router = express.Router();
  async function rpc(method, params = {}) {
    const { data, error } = await client.rpc('individual_tournament_' + method, params)
      .abortSignal(AbortSignal.timeout(8000));
    if (error) throw error;
    return data;
  }
  const limits = new Map();
  router.use(async (req,res,next) => {
    res.set('Cache-Control','no-store');
    const header = req.get('Authorization');
    if (header?.startsWith('Bearer ') && header.length < 8192) {
      try {
        const user = await verifyToken(header.slice(7));
        if (!user?.is_anonymous && uuid.test(user?.id ?? '')) req.actor = user.id;
      } catch { /* Authentication fails closed. */ }
    }
    if ((header || req.method !== 'GET') && !req.actor) {
      return res.status(401).json({ code: 'authentication_required' });
    }
    const minute = Math.floor(Date.now() / 60000);
    if (limits.size >= 5000) for (const [key,value] of limits) if (value.minute !== minute) limits.delete(key);
    const key = req.actor || req.ip;
    let limit = limits.get(key);
    if (limit?.minute !== minute) {
      if (!limit && limits.size >= 5000) return res.status(429).json({ code: 'rate_limit' });
      limit = { minute, count: 0 };
      limits.set(key,limit);
    }
    if (++limit.count > (req.actor ? 180 : 600)) return res.status(429).json({ code: 'rate_limit' });
    next();
  });
  router.get(['/', '/:id'], async (req,res) => {
    const id = req.params.id ?? null;
    if (id && !uuid.test(id)) return res.status(400).json({ code: 'invalid_input' });
    try {
      const data = await rpc('read', { p_actor: req.actor ?? null, p_id: id });
      return data === null ? res.status(404).json({ code: 'not_found' }) : res.json(data);
    } catch (error) { return httpError(res,error); }
  });
  router.post('/:id', express.json({ limit: '2kb' }), async (req,res) => {
    const id = req.params.id;
    if (!uuid.test(id) || !validCommand(req.body)) return res.status(400).json({ code: 'invalid_input' });
    try {
      const { action, input } = req.body;
      return res.json(await rpc('command', { p_actor: req.actor, p_id: id, p_action: action, p_input: input }));
    } catch (error) { return httpError(res,error); }
  });
  router.use((error,req,res,next) => {
    if (res.headersSent) return next(error);
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ code: 'invalid_input' });
  });
  app.use('/api/individual-tournaments',router);

  let running = false;
  return async function sweep() {
    if (running) return;
    running = true;
    try {
      const due = await rpc('due');
      for (const event of due) {
        try {
          const complete = event.seeds.length < 2 || (event.round_limit !== null && event.round_no >= event.round_limit);
          const pairs = complete ? null : nextPairings(event.seeds,event.history);
          await rpc('advance', { p_id: event.id, p_revision: event.revision, p_pairs: pairs });
        } catch (error) { logError(error.code ?? 'advance_failed'); }
      }
    } catch (error) { logError(error.code ?? 'sweep_failed'); }
    finally { running = false; }
  };
}

module.exports = { installIndividualTournaments, nextPairings };
