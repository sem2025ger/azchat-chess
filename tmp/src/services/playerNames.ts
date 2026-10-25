import { supabase } from './supabase';
import { displayPlayerName } from '../utils/displayPlayerName';

export type PlayerIds = { w: string; b: string };
export function readPlayerIds(value: unknown): PlayerIds | null {
  if (!value || typeof value !== 'object') return null;
  const ids = value as Record<string, unknown>;
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  return typeof ids.w === 'string' && typeof ids.b === 'string' && uuid.test(ids.w) && uuid.test(ids.b)
    ? { w: ids.w, b: ids.b } : null;
}

export async function fetchPlayerNames(ids: PlayerIds, signal: AbortSignal) {
  const valid = readPlayerIds(ids);
  if (!valid) throw new Error('Invalid player identities');
  const { data, error } = await supabase.from('profiles').select('id,username')
    .in('id', [...new Set([valid.w, valid.b])]).abortSignal(signal);
  if (error) throw error;
  const names = Object.fromEntries((data ?? []).map(row => [row.id, displayPlayerName(row.username, '')]));
  return { w: names[valid.w] || '', b: names[valid.b] || '' };
}
