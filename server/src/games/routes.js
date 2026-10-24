'use strict';
const express = require('express');
const { Chess } = require('chess.js');
const { createCache } = require('./cache');
const { createLichessClient } = require('./lichessClient');
const validate = require('./validate');
const normalize = require('./normalize');
const { GamesError, errorResponse } = require('./errors');
function createGamesRouter({ env = process.env, client = createLichessClient({ token: env.LICHESS_API_TOKEN }), cache = createCache(), now = Date.now } = {}) {
  const router = express.Router();
  const buckets = new Map();
  router.use((req, res, next) => {
    const key = req.ip; const time = now();
    for (const [ip, value] of buckets) if (value.until <= time) buckets.delete(ip);
    let item = buckets.get(key);
    if (!item) {
      if (buckets.size >= 10000) return errorResponse(new GamesError('UPSTREAM_RATE_LIMITED', 60), res);
      item = { count: 0, until: time + 60000 }; buckets.set(key, item);
    }
    if (++item.count > 30) return errorResponse(new GamesError('UPSTREAM_RATE_LIMITED', Math.ceil((item.until - time) / 1000)), res);
    next();
  });
  const flags = () => ({ lichess: env.GAMES_LICHESS_ENABLED !== 'false', db: false, sources: env.GAMES_LICHESS_ENABLED !== 'false' ? ['lichess-masters','lichess'] : [] });
  const route = fn => (req, res) => Promise.resolve().then(() => fn(req, res)).catch(error => errorResponse(error, res));
  router.get('/status', (req, res) => res.json(flags()));
  router.use('/masters', (req, res, next) => flags().lichess ? next() : errorResponse(new GamesError('FEATURE_DISABLED'), res));
  router.get('/masters', route(async (req, res) => {
    const fen = validate.fen(req.query.fen);
    const top = validate.integer(req.query.top, 15, 15);
    validate.integer(req.query.recent, 15, 15);
    const data = await cache.get(`masters:${fen}:${top}`, 86400000, async () => normalize.masters(await client.request('/masters?' + new URLSearchParams({ fen: fen + ' 0 1', topGames: String(top) }), { explorer: true }), fen));
    res.json(data);
  }));
  router.get('/masters/:id/pgn', route(async (req, res) => {
    const id = validate.gameId(req.params.id);
    const pgn = await cache.get(`pgn:${id}`, 86400000, async () => {
      const text = await client.request('/masters/pgn/' + id, { explorer: true, accept: 'application/x-chess-pgn' });
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
  router.use((req, res) => errorResponse(new GamesError('NOT_FOUND'), res));
  return router;
}
module.exports = { createGamesRouter };
