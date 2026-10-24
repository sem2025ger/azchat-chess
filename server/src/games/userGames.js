'use strict';
const { GamesError } = require('./errors');
const { result } = require('./normalize');
function userGames(text, username, max) {
  try {
    const rows = text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
    if (rows.length > max) throw new Error();
    const totals = { white: new Map(), black: new Map() };
    const games = rows.map(g => {
      if (!/^[A-Za-z0-9]{8}$/.test(g.id) || typeof g.pgn !== 'string' || !g.pgn.trim() || !Number.isFinite(g.createdAt) || !g.players?.white || !g.players?.black) throw new Error();
      const white = { name: g.players.white.user?.name || g.players.white.name || 'Anonymous', rating: g.players.white.rating ?? null };
      const black = { name: g.players.black.user?.name || g.players.black.name || 'Anonymous', rating: g.players.black.rating ?? null };
      const outcome = g.winner ? result(g.winner) : ['draw','stalemate'].includes(g.status) ? '1/2-1/2' : '*';
      const color = (g.players.white.user?.id || white.name).toLowerCase() === username ? 'white' : (g.players.black.user?.id || black.name).toLowerCase() === username ? 'black' : null;
      if (!color) throw new Error();
      if (g.opening && outcome !== '*') {
        const key = g.opening.eco + ':' + g.opening.name;
        const item = totals[color].get(key) || { eco: g.opening.eco, name: g.opening.name, games: 0, score: 0 };
        item.games++; item.score += outcome === '1/2-1/2' ? 0.5 : (outcome === '1-0') === (color === 'white') ? 1 : 0;
        totals[color].set(key, item);
      }
      return { id: g.id, url: 'https://lichess.org/' + g.id, white, black, speed: g.speed, result: outcome, date: new Date(g.createdAt).toISOString(), opening: g.opening ? { eco: g.opening.eco, name: g.opening.name } : null, pgn: g.pgn };
    });
    const stats = color => [...totals[color].values()].sort((a,b) => b.games - a.games || a.name.localeCompare(b.name)).slice(0,5).map(({ score, ...item }) => ({ ...item, scorePct: Math.round(score / item.games * 1000) / 10 }));
    return { source: 'lichess', username, games, openings: { white: stats('white'), black: stats('black') } };
  } catch { throw new GamesError('UPSTREAM_UNAVAILABLE'); }
}
module.exports = { userGames };
