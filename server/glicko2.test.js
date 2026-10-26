'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { rate, ratePeriod, INITIAL_RATING, SCALE } = require('./glicko2');
const close = (value, expected, tolerance) => assert.ok(Math.abs(value - expected) <= tolerance, `${value} differs from ${expected}`);

test('Glickman published three-opponent worked example', () => {
  const player = Object.freeze({ rating: 1500, deviation: 200, volatility: 0.06 });
  const result = rate(player, [
    { opponent: { rating: 1400, deviation: 30 }, score: 1 },
    { opponent: { rating: 1550, deviation: 100 }, score: 0 },
    { opponent: { rating: 1700, deviation: 300 }, score: 0 },
  ]);
  // The paper rounds intermediate quantities; preserve precision internally.
  close(result.rating, 1464.06, 0.02);
  close(result.deviation, 151.52, 0.01);
  close(result.volatility, 0.05999, 0.00001);
  assert.deepEqual(player, { rating: 1500, deviation: 200, volatility: 0.06 });
});

test('inactivity changes only deviation using the specified period formula', () => {
  const after = rate(INITIAL_RATING, []);
  assert.equal(after.rating, INITIAL_RATING.rating);
  assert.equal(after.volatility, INITIAL_RATING.volatility);
  close(after.deviation, Math.hypot(350 / SCALE, 0.06) * SCALE, 1e-10);
  assert.ok(after.deviation > 350);
});

test('equal opponents: wins/losses are symmetric and a draw preserves rating', () => {
  const win = rate(INITIAL_RATING, [{ opponent: INITIAL_RATING, score: 1 }]);
  const loss = rate(INITIAL_RATING, [{ opponent: INITIAL_RATING, score: 0 }]);
  const draw = rate(INITIAL_RATING, [{ opponent: INITIAL_RATING, score: 0.5 }]);
  assert.ok(win.rating > 1500 && loss.rating < 1500 && win.deviation < 350);
  close(win.rating - 1500, 1500 - loss.rating, 1e-10);
  close(draw.rating, 1500, 1e-10);
});

test('period updates use immutable snapshots and are independent of player/game order', () => {
  const players = Object.freeze({ a: INITIAL_RATING, b: Object.freeze({ rating: 1800, deviation: 80, volatility: 0.06 }), c: INITIAL_RATING });
  const games = [{ white: 'a', black: 'b', whiteScore: 1 }, { white: 'b', black: 'c', whiteScore: 0.5 }];
  const result = ratePeriod(players, games);
  assert.deepEqual(result, ratePeriod({ c: players.c, b: players.b, a: players.a }, [...games].reverse()));
  assert.deepEqual(result.a, rate(players.a, [{ opponent: players.b, score: 1 }]));
  assert.deepEqual(result.b, rate(players.b, [{ opponent: players.a, score: 0 }, { opponent: players.c, score: 0.5 }]));
  assert.equal(players.a.rating, 1500);
});

test('unexpected outcomes take the alternate volatility bracket and remain finite', () => {
  const player = { rating: 2000, deviation: 30, volatility: 0.06 };
  const result = rate(player, Array.from({ length: 15 }, () => ({ opponent: { rating: 1300, deviation: 40 }, score: 0 })));
  assert.ok(result.rating < player.rating && result.volatility > player.volatility);
  assert.ok(Object.values(result).every(Number.isFinite));
});

test('invalid numeric states, results and identity collisions fail closed', () => {
  for (const field of ['rating', 'deviation', 'volatility']) {
    for (const value of [NaN, Infinity, -Infinity, '1500', null]) assert.throws(() => rate({ ...INITIAL_RATING, [field]: value }, []));
  }
  for (const value of [0, -1]) {
    assert.throws(() => rate({ ...INITIAL_RATING, deviation: value }, []));
    assert.throws(() => rate({ ...INITIAL_RATING, volatility: value }, []));
  }
  for (const score of [-1, 0.4, 2, NaN, '1']) assert.throws(() => rate(INITIAL_RATING, [{ opponent: INITIAL_RATING, score }]));
  assert.throws(() => rate(INITIAL_RATING, [], { tau: 0 }));
  assert.throws(() => ratePeriod({ a: INITIAL_RATING }, [{ white: 'a', black: 'a', whiteScore: 1 }]));
  assert.throws(() => ratePeriod({ a: INITIAL_RATING }, [{ white: 'a', black: 'missing', whiteScore: 1 }]));
});

test('solver iteration budget prevents unbounded computation', () => {
  assert.throws(() => rate(INITIAL_RATING, [{ opponent: INITIAL_RATING, score: 1 }], { maxIterations: 1, epsilon: 1e-14 }), /did not converge/);
});
