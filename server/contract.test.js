'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Import the REAL production TypeScript utility directly
const {
  mapProfileRow,
  calculateMatchStats,
  getMatchResultForPlayer,
} = require('../tmp/src/utils/profileContract.ts');

test('CT-1: mapProfileRow maps all snake_case fields and preserves defaults', () => {
  const dbRow = {
    id: '12345678-1234-4234-8234-123456789abc',
    username: 'GrandmasterAZ',
    rating_blitz: 1850,
    rating_rapid: 1920,
    rating_bullet: 1780,
    country_code: 'TR',
    role: 'moderator',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const profile = mapProfileRow(dbRow);
  assert.equal(profile.id, '12345678-1234-4234-8234-123456789abc');
  assert.equal(profile.username, 'GrandmasterAZ');
  assert.equal(profile.ratingBlitz, 1850);
  assert.equal(profile.ratingRapid, 1920);
  assert.equal(profile.ratingBullet, 1780);
  assert.equal(profile.countryCode, 'TR');
  assert.equal(profile.role, 'moderator');
  assert.equal(profile.createdAt, '2026-01-01T00:00:00.000Z');

  // Compatibility getters/properties
  assert.equal(profile.rating_blitz, 1850);
  assert.equal(profile.rating_rapid, 1920);
  assert.equal(profile.rating_bullet, 1780);
  assert.equal(profile.country_code, 'TR');
  assert.equal(profile.created_at, '2026-01-01T00:00:00.000Z');
});

test('CT-2: mapProfileRow applies fallback defaults on missing/null fields', () => {
  const minimalRow = {
    id: '12345678-1234-4234-8234-123456789abc',
    username: 'NovicePlayer',
    rating_blitz: null,
    rating_rapid: null,
    rating_bullet: null,
    country_code: null,
    role: null,
    created_at: null,
  };

  const profile = mapProfileRow(minimalRow);
  assert.equal(profile.ratingBlitz, 1200);
  assert.equal(profile.ratingRapid, 1200);
  assert.equal(profile.ratingBullet, 1200);
  assert.equal(profile.countryCode, 'AZ');
  assert.equal(profile.role, 'player');
  assert.equal(profile.createdAt, undefined);

  assert.equal(mapProfileRow(null), null);
  assert.equal(mapProfileRow(undefined), null);
});

test('CT-3: calculateMatchStats correctly processes white win and black win', () => {
  const userId = 'player-uid-1';
  const matches = [
    // White win where player is white
    { white_id: userId, black_id: 'opp-1', winner_id: userId, result: '1-0', status: 'completed' },
    // Black win where player is black
    { white_id: 'opp-2', black_id: userId, winner_id: userId, result: '0-1', status: 'completed' },
    // Loss where player is white
    { white_id: userId, black_id: 'opp-3', winner_id: 'opp-3', result: '0-1', status: 'completed' },
    // Loss where player is black
    { white_id: 'opp-4', black_id: userId, winner_id: 'opp-4', result: '1-0', status: 'completed' },
  ];

  const stats = calculateMatchStats(matches, userId);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 2);
  assert.equal(stats.draws, 0);
  assert.equal(stats.rate, 50.0);
});

test('CT-4: calculateMatchStats correctly classifies draw scenarios (1/2-1/2, stalemate, draw agreement)', () => {
  const userId = 'player-uid-2';
  const matches = [
    // Generic draw result 1/2-1/2
    { white_id: userId, black_id: 'opp-1', result: '1/2-1/2', status: 'completed' },
    // Stalemate termination reason
    { white_id: 'opp-2', black_id: userId, termination_reason: 'stalemate', status: 'completed' },
    // Draw agreement termination reason
    { white_id: userId, black_id: 'opp-3', termination_reason: 'draw_agreement', status: 'completed' },
    // Status draw
    { white_id: 'opp-4', black_id: userId, status: 'draw' },
    // Termination reason 'draw'
    { white_id: userId, black_id: 'opp-5', termination_reason: 'draw' },
  ];

  const stats = calculateMatchStats(matches, userId);
  assert.equal(stats.wins, 0);
  assert.equal(stats.losses, 0);
  assert.equal(stats.draws, 5);
  assert.equal(stats.rate, 0);
});

test('CT-5: calculateMatchStats handles empty match list safely', () => {
  const statsEmpty = calculateMatchStats([], 'some-user');
  assert.deepEqual(statsEmpty, { wins: 0, losses: 0, draws: 0, rate: 0 });

  const statsNull = calculateMatchStats(null, 'some-user');
  assert.deepEqual(statsNull, { wins: 0, losses: 0, draws: 0, rate: 0 });

  const statsUndefined = calculateMatchStats(undefined, 'some-user');
  assert.deepEqual(statsUndefined, { wins: 0, losses: 0, draws: 0, rate: 0 });
});

test('CT-6: getMatchResultForPlayer resolves individual match perspective accurately', () => {
  const me = 'user-me';
  const opp = 'user-opp';

  assert.equal(getMatchResultForPlayer({ white_id: me, black_id: opp, result: '1-0' }, me), 'win');
  assert.equal(getMatchResultForPlayer({ white_id: opp, black_id: me, result: '1-0' }, me), 'loss');
  assert.equal(getMatchResultForPlayer({ white_id: opp, black_id: me, result: '0-1' }, me), 'win');
  assert.equal(getMatchResultForPlayer({ white_id: me, black_id: opp, result: '0-1' }, me), 'loss');
  assert.equal(getMatchResultForPlayer({ white_id: me, black_id: opp, result: '1/2-1/2' }, me), 'draw');
  assert.equal(getMatchResultForPlayer({ white_id: me, black_id: opp, termination_reason: 'stalemate' }, me), 'draw');
  assert.equal(getMatchResultForPlayer({ white_id: me, black_id: opp, termination_reason: 'draw_agreement' }, me), 'draw');
});
