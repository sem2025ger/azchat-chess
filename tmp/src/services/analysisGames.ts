import { supabase } from './supabase';
import { analysisFromPgn } from '../utils/analysisWorkspace';

export interface AnalysisGameSummary {
  id: string;
  white_id: string | null;
  black_id: string | null;
  result: string;
  time_control: string;
  completed_at: string;
  white_profile: { username: string } | null;
  black_profile: { username: string } | null;
}
const PAGE_SIZE = 25;
function participantFilter(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Invalid user');
  return `white_id.eq.${userId},black_id.eq.${userId}`;
}
export async function fetchAnalysisGames(userId: string, page: number, signal: AbortSignal) {
  const { data, error } = await supabase.from('matches')
    .select('id,white_id,black_id,result,time_control,completed_at,white_profile:profiles!white_id(username),black_profile:profiles!black_id(username)')
    .eq('status', 'completed').or(participantFilter(userId))
    .order('completed_at', { ascending: false }).order('id', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).abortSignal(signal);
  if (error) throw error;
  const rows = (data || []) as unknown as AnalysisGameSummary[];
  return { games: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
export async function fetchAnalysisGame(userId: string, id: string, signal: AbortSignal) {
  const { data, error } = await supabase.from('matches').select('id,white_id,black_id,pgn,initial_fen')
    .eq('id', id).eq('status', 'completed').or(participantFilter(userId)).abortSignal(signal).single();
  if (error || !data || (data.white_id !== userId && data.black_id !== userId)) throw error || new Error('Game unavailable');
  return analysisFromPgn(data.pgn || '', data.initial_fen || undefined);
}
