'use strict';
const { GamesError } = require('./errors');
const count = x => { if (!Number.isSafeInteger(x) || x < 0) throw new GamesError('UPSTREAM_UNAVAILABLE'); return x; };
const result = winner => winner === 'white' ? '1-0' : winner === 'black' ? '0-1' : '1/2-1/2';
function masters(text, fen) {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data.moves) || !Array.isArray(data.topGames)) throw new Error();
    return { source: 'lichess-masters', fen, total: { white: count(data.white), draws: count(data.draws), black: count(data.black) },
      moves: data.moves.map(m => ({ uci: m.uci, san: m.san, white: count(m.white), draws: count(m.draws), black: count(m.black), games: m.white + m.draws + m.black })),
      topGames: data.topGames.map(g => {
        if (!/^[a-z0-9]{8}$/i.test(g.id) || !g.white?.name || !g.black?.name || !Number.isInteger(g.year) || ![null,'white','black'].includes(g.winner)) throw new Error();
        return { id: g.id, white: g.white, black: g.black, year: g.year, ...(g.month ? { month: g.month } : {}), result: result(g.winner) };
      }), recentGames: [] }; // Not supplied by the current official Masters schema.
  } catch { throw new GamesError('UPSTREAM_UNAVAILABLE'); }
}
module.exports = { masters, result };
