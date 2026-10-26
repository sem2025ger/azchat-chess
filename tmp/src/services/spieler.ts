import { analysisFromPgn } from '../utils/analysisWorkspace.ts';
import { saveAnalysisSession } from '../utils/analysisSession.ts';

export function spielerEnabled(value: unknown) { return value === 'true'; }
export interface SpielerPlayer {
  fide_id: string | number; name: string; surname: string; federation: string;
  title: string | null; fide_rating: number | null; club: string | null;
  source_date: string; source_url: string;
}
export interface SpielerGame { id: string; pgn: string; white: string; black: string; result: string; date: string; opening: string; eco: string | null }
export interface SpielerGames { games: SpielerGame[]; openings: { name: string; count: number }[]; rejected: number }
export class SpielerError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export function createSpielerApi(base: string, fetchImpl: typeof fetch = fetch) {
  const url = new URL(base);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new SpielerError('configuration');
  async function request(path: string, token: string, signal: AbortSignal, body?: object) {
    if (!token) throw new SpielerError('authentication_required');
    const response = await fetchImpl(new URL('/api/spieler/' + path, url), {
      signal, method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await response.json();
    if (!response.ok) throw new SpielerError(typeof value.code === 'string' ? value.code : 'temporarily_unavailable');
    return value;
  }
  return {
    search: async (surname: string, token: string, signal: AbortSignal): Promise<SpielerPlayer[]> => {
      const value = await request('search?' + new URLSearchParams({ q: surname }), token, signal);
      if (!Array.isArray(value.players)) throw new SpielerError('temporarily_unavailable');
      return value.players;
    },
    card: async (id: string, token: string, signal: AbortSignal): Promise<SpielerPlayer> => {
      if (!/^[1-9]\d{0,9}$/.test(id)) throw new SpielerError('invalid_query');
      return (await request(id, token, signal)).player;
    },
    games: async (id: string, source: string, nickname: string, token: string, signal: AbortSignal): Promise<SpielerGames> => {
      if (!/^[1-9]\d{0,9}$/.test(id)) throw new SpielerError('invalid_query');
      return request(id + '/games?' + new URLSearchParams({ source, nickname }), token, signal);
    },
    action: async (id: string, action: 'claim' | 'hide', token: string, signal: AbortSignal, club?: string): Promise<{ status: string }> => {
      if (!/^[1-9]\d{0,9}$/.test(id) || !token) throw new SpielerError('authentication_required');
      return request(id + '/' + action, token, signal, action === 'claim' && club !== undefined ? { club } : {});
    },
  };
}
// The existing analysis session validates PGN before changing stored state.
export function openSpielerAnalysis(pgn: string, storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const parsed = analysisFromPgn(pgn);
  saveAnalysisSession(parsed.moveHistory, -1, storage, parsed.positionHistory[0]);
  return '/game';
}
