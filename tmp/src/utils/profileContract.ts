export interface DbProfileRow {
  id: string;
  username: string;
  rating_blitz?: number | null;
  rating_rapid?: number | null;
  rating_bullet?: number | null;
  country_code?: string | null;
  role?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface UserProfileContract {
  id: string;
  username: string;
  ratingBlitz: number;
  ratingRapid: number;
  ratingBullet: number;
  countryCode: string;
  role: string;
  createdAt?: string;
  rating_blitz?: number;
  rating_rapid?: number;
  rating_bullet?: number;
  country_code?: string;
  created_at?: string;
}

/**
 * Authoritative mapping from database snake_case profile row to application profile shape.
 */
export function mapProfileRow(data: DbProfileRow | null | undefined): UserProfileContract | null {
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    ratingBlitz: data.rating_blitz ?? 1200,
    ratingRapid: data.rating_rapid ?? 1200,
    ratingBullet: data.rating_bullet ?? 1200,
    countryCode: data.country_code ?? 'AZ',
    role: data.role ?? 'player',
    createdAt: data.created_at ?? undefined,
    rating_blitz: data.rating_blitz ?? 1200,
    rating_rapid: data.rating_rapid ?? 1200,
    rating_bullet: data.rating_bullet ?? 1200,
    country_code: data.country_code ?? 'AZ',
    created_at: data.created_at ?? undefined,
  };
}

export interface DbMatchRow {
  white_id?: string | null;
  black_id?: string | null;
  winner_id?: string | null;
  result?: string | null;
  status?: string | null;
  termination_reason?: string | null;
  [key: string]: unknown;
}

export type PlayerMatchResult = 'win' | 'loss' | 'draw';

/**
 * Returns 'win', 'loss', or 'draw' for a player given a single match row.
 */
export function getMatchResultForPlayer(
  m: DbMatchRow,
  currentUserId: string
): PlayerMatchResult {
  const isWhite = m.white_id === currentUserId;
  if (
    m.result === '1/2-1/2' ||
    m.status === 'draw' ||
    m.termination_reason === 'stalemate' ||
    m.termination_reason === 'draw' ||
    m.termination_reason === 'draw_agreement'
  ) {
    return 'draw';
  }
  if (
    m.winner_id === currentUserId ||
    (m.result === '1-0' && isWhite) ||
    (m.result === '0-1' && !isWhite)
  ) {
    return 'win';
  }
  if (m.winner_id || m.result === '1-0' || m.result === '0-1') {
    return 'loss';
  }
  return 'draw';
}

export interface MatchStats {
  wins: number;
  losses: number;
  draws: number;
  rate: number;
}

/**
 * Calculates win, loss, draw counts and win rate for a player given a list of match rows.
 */
export function calculateMatchStats(
  matches: DbMatchRow[] | null | undefined,
  currentUserId: string
): MatchStats {
  let w = 0;
  let l = 0;
  let d = 0;

  for (const m of matches || []) {
    const res = getMatchResultForPlayer(m, currentUserId);
    if (res === 'win') {
      w++;
    } else if (res === 'loss') {
      l++;
    } else {
      d++;
    }
  }

  const total = w + l + d;
  const rate = total > 0 ? Number(((w / total) * 100).toFixed(1)) : 0;

  return { wins: w, losses: l, draws: d, rate };
}
