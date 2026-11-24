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
