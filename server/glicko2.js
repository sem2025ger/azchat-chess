'use strict';

// Mark Glickman's revised Illinois procedure (22 March 2022).
// https://glicko.net/glicko/glicko2.pdf
// Pure period calculation only: no database, clock, matchmaking or rating writes.
const SCALE = 173.7178;
const INITIAL_RATING = Object.freeze({ rating: 1500, deviation: 350, volatility: 0.06 });

function finite(value, name, positive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
    throw new RangeError('Invalid ' + name);
  }
  return value;
}

function validate(player, volatility = true) {
  if (!player || typeof player !== 'object') throw new TypeError('Rating required');
  finite(player.rating, 'rating');
  finite(player.deviation, 'deviation', true);
  if (volatility) finite(player.volatility, 'volatility', true);
}

function rate(player, matches, { tau = 0.5, epsilon = 0.000001, maxIterations = 100 } = {}) {
  validate(player);
  if (!Array.isArray(matches)) throw new TypeError('Matches must be an array');
  finite(tau, 'tau', true); finite(epsilon, 'epsilon', true);
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 10000) throw new RangeError('Invalid iteration limit');
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  if (!matches.length) {
    const deviation = finite(Math.hypot(phi, player.volatility) * SCALE, 'updated deviation', true);
    return { rating: player.rating, deviation, volatility: player.volatility };
  }
  let information = 0, residual = 0;
  for (const match of matches) {
    validate(match?.opponent, false);
    if (![0, 0.5, 1].includes(match.score)) throw new RangeError('Invalid chess result');
    const g = 1 / Math.sqrt(1 + 3 * (match.opponent.deviation / SCALE) ** 2 / Math.PI ** 2);
    const x = g * (mu - (match.opponent.rating - 1500) / SCALE);
    // The two branches avoid overflow in the logistic exponential.
    const e = x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
    information += g * g * e * (1 - e);
    residual += g * (match.score - e);
  }
  finite(information, 'period information', true);
  const variance = finite(1 / information, 'period variance', true);
  const delta = finite(variance * residual, 'period improvement');
  const a = finite(2 * Math.log(player.volatility), 'log volatility');
  const f = x => {
    const exponential = Math.exp(x), total = phi * phi + variance + exponential;
    return finite(exponential * (delta * delta - phi * phi - variance - exponential) / (2 * total * total) - (x - a) / (tau * tau), 'volatility objective');
  };
  let A = a, B;
  if (delta * delta > phi * phi + variance) {
    B = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      if (++k > maxIterations) throw new RangeError('Volatility bracket did not converge');
    }
    B = a - k * tau;
  }
  let fA = f(A), fB = f(B), iterations = 0;
  while (Math.abs(B - A) > epsilon) {
    if (++iterations > maxIterations) throw new RangeError('Volatility solver did not converge');
    const C = finite(A + (A - B) * fA / (fB - fA), 'volatility candidate');
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else { fA /= 2; }
    B = C; fB = fC;
  }
  const volatility = finite(Math.exp(A / 2), 'updated volatility', true);
  const prePeriod = Math.hypot(phi, volatility);
  const deviation = finite(1 / Math.sqrt(1 / (prePeriod * prePeriod) + 1 / variance), 'updated deviation', true);
  return {
    rating: finite(1500 + SCALE * (mu + deviation * deviation * residual), 'updated rating'),
    deviation: deviation * SCALE,
    volatility,
  };
}

// Calculate every player from the same pre-period snapshot. A sequential update
// that feeds the first player's new rating to the second player is incorrect.
function ratePeriod(players, games, options) {
  if (!players || typeof players !== 'object' || Array.isArray(players) || !Array.isArray(games)) throw new TypeError('Players and games required');
  const entries = Object.entries(players), matches = new Map();
  for (const [id, player] of entries) { validate(player); matches.set(id, []); }
  for (const game of games) {
    if (!game || game.white === game.black || !matches.has(game.white) || !matches.has(game.black) || ![0, 0.5, 1].includes(game.whiteScore)) throw new RangeError('Invalid period game');
    matches.get(game.white).push({ opponent: players[game.black], score: game.whiteScore });
    matches.get(game.black).push({ opponent: players[game.white], score: 1 - game.whiteScore });
  }
  return Object.fromEntries(entries.map(([id, player]) => [id, rate(player, matches.get(id), options)]));
}

module.exports = { rate, ratePeriod, INITIAL_RATING, SCALE };
