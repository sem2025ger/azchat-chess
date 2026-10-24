export type SourceGame = {
  id: string; white: { name: string; rating?: number | null }; black: { name: string; rating?: number | null };
  result: string; year?: number; date?: string; eco?: string; pgn?: string; url?: string;
};
export type MoveStat = { uci: string; san: string; white: number; draws: number; black: number; games: number };
export type MastersResult = { total: { white: number; draws: number; black: number }; moves: MoveStat[]; topGames: SourceGame[]; recentGames: SourceGame[] };
export type GamesStatus = { lichess: boolean; db: boolean; sources: string[] };
export class GamesApiError extends Error {
  code: string; retryAfter: number;
  constructor(code: string, retryAfter = 0) { super(code); this.code = code; this.retryAfter = retryAfter; }
}
export async function gamesRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const base = import.meta.env.VITE_SERVER_URL;
  if (!base) throw new GamesApiError('UPSTREAM_UNAVAILABLE');
  let response: Response;
  try { response = await fetch(`${base.replace(/\/$/, '')}/api/games${path}`, { signal }); }
  catch (error) { if (signal.aborted) throw error; throw new GamesApiError('UPSTREAM_UNAVAILABLE'); }
  let body;
  try { body = await response.json(); } catch { throw new GamesApiError('UPSTREAM_UNAVAILABLE'); }
  if (!response.ok) throw new GamesApiError(body?.error?.code || 'UPSTREAM_UNAVAILABLE', Number(response.headers.get('Retry-After')) || 0);
  return body as T;
}

export type UserGamesResult = { games: SourceGame[]; openings: { white: OpeningStat[]; black: OpeningStat[] } };
export type OpeningStat = { eco: string; name: string; games: number; scorePct: number };
