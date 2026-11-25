import { supabase } from './supabase';
import { berlinDateTimeToIso } from './spieltag';
import { TournamentError, type IndividualOrganizerDraft } from './teamTournaments';
import { abortWithTimeout } from '../lib/abortWithTimeout';

const table = 'individual_tournament_drafts';
const columns = 'id,name,starts_at,max_players';
type TournamentInput = { name: string; starts_at: string; max_players: number };
export type IndividualTournament = TournamentInput & { id: string };

export function individualTournamentInput(draft: IndividualOrganizerDraft): TournamentInput {
  const name = draft.name?.trim() ?? '';
  if (!name || name.length > 120 || /\p{Cc}/u.test(name) ||
    draft.max_players === null || !Number.isInteger(draft.max_players) || draft.max_players < 2 || draft.max_players > 128) {
    throw new TournamentError('invalid_input');
  }
  let starts_at: string;
  try {
    starts_at = berlinDateTimeToIso(draft.start_time ?? '');
    if (Date.parse(starts_at) <= Date.now()) throw new Error('past start');
  } catch {
    throw new TournamentError('invalid_time');
  }
  return { name, starts_at, max_players: draft.max_players };
}

export async function listIndividualTournaments(organizerId: string, signal: AbortSignal): Promise<IndividualTournament[]> {
  const timeout = abortWithTimeout(signal, 15000);
  try {
    const { data, error } = await supabase.from(table).select(columns).eq('organizer_id', organizerId)
      .order('created_at', { ascending: false }).limit(50).abortSignal(timeout.signal);
    if (error) throw new TournamentError('temporarily_unavailable');
    return data;
  } finally {
    timeout.cancel();
  }
}

export async function saveIndividualTournament(
  id: string, organizerId: string, input: TournamentInput, signal: AbortSignal,
): Promise<IndividualTournament> {
  const timeout = abortWithTimeout(signal, 15000);
  try {
    const { data, error } = await supabase.from(table).insert({ id, organizer_id: organizerId, ...input })
      .select(columns).abortSignal(timeout.signal).single();
    if (!error) return data;
    if (error.code === '23505') {
      // Retrying the same request after a timeout can hit an already committed insert.
      const existing = await supabase.from(table).select(columns).eq('id', id).eq('organizer_id', organizerId)
        .abortSignal(timeout.signal).maybeSingle();
      const event = existing.data;
      if (event && event.name === input.name && event.max_players === input.max_players &&
          Date.parse(event.starts_at) === Date.parse(input.starts_at)) return event;
    }
    throw new TournamentError('temporarily_unavailable');
  } finally {
    timeout.cancel();
  }
}

export const liveIndividualEvents = import.meta.env.VITE_INDIVIDUAL_TOURNAMENTS_LIVE_ENABLED === 'true';
export type EventStatus = 'registration' | 'playing' | 'finished' | 'cancelled' | 'pairing_blocked';
export type EventSummary = IndividualTournament & { status: EventStatus };
export type Result = '1-0' | '1/2-1/2' | '0-1';
export type Pair = { round_no: number; board_no: number; white_no: number; black_no: number | null;
  result: Result | 'bye' | null };
export type EventDetail = EventSummary & {
  round_no: number; round_limit: number | null; organizer: boolean; joined: boolean;
  players: { no: number; name: string }[]; pairs: Pair[];
};
export type EventCommand =
  { action: 'publish'; input: TournamentInput | Record<string, never> } |
  { action: 'join'; input: { name: string } } |
  { action: 'leave' | 'cancel'; input: Record<string, never> } |
  { action: 'result'; input: Pick<Pair, 'round_no' | 'board_no'> & { result: Result } };

export function createIndividualEventsApi(token?: string) {
  async function request<T>(id: string, signal: AbortSignal, command?: EventCommand): Promise<T> {
    let origin: URL;
    try { origin = new URL(import.meta.env.VITE_SERVER_URL); }
    catch { throw new TournamentError('configuration'); }
    if (origin.username || origin.password || (origin.protocol !== 'https:' &&
        !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
      throw new TournamentError('configuration');
    }
    const timeout = abortWithTimeout(signal, 12000);
    try {
      const headers = new Headers();
      if (token) headers.set('Authorization', 'Bearer ' + token);
      if (command) headers.set('Content-Type', 'application/json');
      const url = new URL('/api/individual-tournaments' + (id ? '/' + encodeURIComponent(id) : ''), origin);
      const response = await fetch(url, {
        headers, signal: timeout.signal, cache: 'no-store', redirect: 'error',
        ...(command ? { method: 'POST', body: JSON.stringify(command) } : {}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new TournamentError(body?.code ?? 'temporarily_unavailable');
      }
      return await response.json() as T;
    } finally { timeout.cancel(); }
  }
  return {
    list: (signal: AbortSignal) => request<EventSummary[]>('', signal),
    detail: (id: string, signal: AbortSignal) => request<EventDetail>(id, signal),
    command: (id: string, command: EventCommand, signal: AbortSignal) => request<EventDetail>(id, signal, command),
  };
}
