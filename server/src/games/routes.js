'use strict';
const express = require('express');
const { Chess } = require('chess.js');
const { createCache } = require('./cache');
const { createLichessClient } = require('./lichessClient');
const validate = require('./validate');
const normalize = require('./normalize');
const { GamesError, errorResponse } = require('./errors');
function createGamesRouter({ env = process.env, client = createLichessClient({ token: env.LICHESS_API_TOKEN }), cache = createCache(), now = Date.now, store } = {}) {
  const router = express.Router();
  const buckets = new Map();
  router.use((req, res, next) => {
    const key = require('./clientIp').clientIp(req, env.GAMES_TRUST_PROXY_HOPS); const time = now();
    for (const [ip, value] of buckets) if (value.until <= time) buckets.delete(ip);
    let item = buckets.get(key);
    if (!item) {
      if (buckets.size >= 10000) return errorResponse(new GamesError('UPSTREAM_RATE_LIMITED', 60), res);
      item = { count: 0, until: time + 60000 }; buckets.set(key, item);
    }
    if (++item.count > 30) return errorResponse(new GamesError('UPSTREAM_RATE_LIMITED', Math.ceil((item.until - time) / 1000)), res);
    next();
  });
  const flags = () => ({ lichess: env.GAMES_LICHESS_ENABLED !== 'false', db: env.GAMES_DB_ENABLED === 'true', sources: [...(env.GAMES_LICHESS_ENABLED !== 'false' ? ['lichess-masters','lichess'] : []), ...(env.GAMES_DB_ENABLED === 'true' ? ['twic'] : [])] });
  const route = fn => (req, res) => Promise.resolve().then(() => fn(req, res)).catch(error => errorResponse(error, res));
  router.get('/status', (req, res) => res.json(flags()));
  router.use('/masters', (req, res, next) => flags().lichess ? next() : errorResponse(new GamesError('FEATURE_DISABLED'), res));
  router.get('/masters', route(async (req, res) => {
    const fen = validate.fen(req.query.fen);
    const top = validate.integer(req.query.top, 15, 15, 0);
    validate.integer(req.query.recent, 15, 15, 0);
    const data = await cache.get(`masters:${fen}:${top}`, 86400000, async () => normalize.masters(await client.request('/masters?' + new URLSearchParams({ fen: fen + ' 0 1', topGames: String(top) }), { explorer: true }), fen));
    res.json(data);
  }));
  router.get('/masters/:id/pgn', route(async (req, res) => {
    const id = validate.gameId(req.params.id);
    const pgn = await cache.get(`pgn:${id}`, 86400000, async () => {
      const text = await client.request('/masters/pgn/' + id, { explorer: true, requiresAuth: false, accept: 'application/x-chess-pgn' });
      try { const game = new Chess(); game.loadPgn(text); if (!game.history().length) throw new Error(); } catch { throw new GamesError('UPSTREAM_UNAVAILABLE'); }
      return text;
    });
    res.json({ pgn });
  }));
  router.get('/lichess-user/:username', route(async (req, res) => {
    if (!flags().lichess) throw new GamesError('FEATURE_DISABLED');
    const username = validate.username(req.params.username);
    const max = validate.integer(req.query.max, 30, 50);
    const data = await cache.get(`user:${username}:${max}`, 900000, async () => {
      const text = await client.request('/api/games/user/' + username + '?' + new URLSearchParams({ max: String(max), moves: 'true', opening: 'true', pgnInJson: 'true', ongoing: 'false', finished: 'true', perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence' }), { accept: 'application/x-ndjson' });
      return require('./userGames').userGames(text, username, max);
    });
    res.json(data);
  }));
  const database = () => store || (store = require('./db').createGamesStore(env));
  router.use('/db', (req, res, next) => flags().db ? next() : errorResponse(new GamesError('FEATURE_DISABLED'), res));
  router.get('/db/search', route(async (req, res) => {
    let player = null, hash = null;
    if (req.query.player !== undefined) {
      if (typeof req.query.player !== 'string' || req.query.player.length > 100) throw new GamesError('INVALID_QUERY');
      player = require('./twic/pgn').normalizeName(req.query.player);
      if (player.length < 3) throw new GamesError('INVALID_QUERY');
    }
    if (req.query.fen !== undefined) hash = require('./twic/pgn').positionHash(validate.fen(req.query.fen));
    if (!player && !hash) throw new GamesError('INVALID_QUERY');
    const limit = validate.integer(req.query.limit, 20, 50);
    const offset = validate.integer(req.query.offset, 0, 100000, 0);
    res.json(await database().search({ p_player: player, p_hash: hash, p_limit: limit, p_offset: offset }));
  }));
  router.get('/db/:id/pgn', route(async (req, res) => {
    if (!/^[1-9][0-9]{0,18}$/.test(req.params.id) || BigInt(req.params.id) > 9223372036854775807n) throw new GamesError('INVALID_QUERY');
    res.json(await database().pgn(req.params.id));
  }));
  router.use((req, res) => errorResponse(new GamesError('NOT_FOUND'), res));
  return router;
}
module.exports = { createGamesRouter };
