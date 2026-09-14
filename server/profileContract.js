'use strict';

/**
 * Authoritative mapping from database snake_case profile row to application camelCase profile.
 */
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

/**
 * Calculates win, loss, draw counts and win rate for a player given a list of match rows.
 */
function calculateMatchStats(matches, currentUserId) {
  let w = 0, l = 0, d = 0;

  for (const m of matches || []) {
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

module.exports = {
  mapProfileRow,
  calculateMatchStats,
};
