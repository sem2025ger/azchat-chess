'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function mapProfileRow(data) {
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    ratingBlitz: data.rating_blitz ?? 1200,
    ratingRapid: data.rating_rapid ?? 1200,
    ratingBullet: data.rating_bullet ?? 1200,
    countryCode: data.country_code ?? 'AZ',
    role: data.role ?? 'player',
    createdAt: data.created_at,
    rating_blitz: data.rating_blitz ?? 1200,
    rating_rapid: data.rating_rapid ?? 1200,
    rating_bullet: data.rating_bullet ?? 1200,
    country_code: data.country_code ?? 'AZ',
    created_at: data.created_at,
  };
}

function calculateMatchStats(matches, currentUserId) {
  let w = 0, l = 0, d = 0;

  for (const m of matches) {
    const isWhite = m.white_id === currentUserId;
    if (
      m.result === '1/2-1/2' ||
      m.status === 'draw' ||
      m.termination_reason === 'stalemate' ||
      m.termination_reason === 'draw' ||
      m.termination_reason === 'draw_agreement'
    ) {
      d++;
    } else if (
      m.winner_id === currentUserId ||
      (m.result === '1-0' && isWhite) ||
      (m.result === '0-1' && !isWhite)
    ) {
      w++;
    } else if (m.winner_id || m.result === '1-0' || m.result === '0-1') {
      l++;
    } else {
      d++;
    }
  }

  const total = w + l + d;
  const rate = total > 0 ? Number(((w / total) * 100).toFixed(1)) : 0;

  return { wins: w, losses: l, draws: d, rate };
}

test('CT-1: mapProfileRow correctly maps snake_case postgres columns to camelCase', () => {
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
  assert.equal(profile.ratingBlitz, 1850);
  assert.equal(profile.ratingRapid, 1920);
  assert.equal(profile.ratingBullet, 1780);
  assert.equal(profile.countryCode, 'TR');
  assert.equal(profile.role, 'moderator');
  assert.equal(profile.username, 'GrandmasterAZ');
});

test('CT-2: calculateMatchStats correctly increments draws for result 1/2-1/2 and status completed', () => {
  const userId = 'my-user-id';
  const matches = [
    { white_id: userId, black_id: 'opp-1', winner_id: userId, result: '1-0', status: 'completed' }, // win
    { white_id: 'opp-2', black_id: userId, winner_id: 'opp-2', result: '1-0', status: 'completed' }, // loss
    { white_id: userId, black_id: 'opp-3', winner_id: null, result: '1/2-1/2', status: 'completed', termination_reason: 'draw_agreement' }, // draw
    { white_id: 'opp-4', black_id: userId, winner_id: null, result: '1/2-1/2', status: 'completed', termination_reason: 'stalemate' }, // draw
  ];

  const stats = calculateMatchStats(matches, userId);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.draws, 2);
  assert.equal(stats.rate, 25.0); // 1 / 4 = 25%
});
