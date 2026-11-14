import { supabase } from '../../../services/supabase';
import { countReplies, type ChatGameResult, type ReactionRow } from './core';

export type V2Extras = {
  reactions: ReactionRow[];
  reactionsAvailable: boolean;
  replyCounts: Map<string, number>;
  /** Newest visible message in the room including thread replies (for read state). */
  newestId?: string;
  /** Stage 2: positions attached to visible messages (empty until its migration is applied). */
  fens: Map<string, string>;
  /** Stage 2: finished games that started from a challenge in this room. */
  results: ChatGameResult[];
};

/** Loads reactions, reply counts and the newest message id for the visible main-feed messages. */
export async function loadV2Extras(clubId: string, messageIds: string[], since?: string): Promise<V2Extras> {
  const [reactions, replies, newest, fens, results] = await Promise.all([
    messageIds.length
      ? supabase.from('chess_club_message_reactions').select('message_id,user_id,reaction').in('message_id', messageIds)
      : Promise.resolve({ data: [] as ReactionRow[], error: null }),
    messageIds.length
      ? supabase.from('chess_club_messages').select('parent_id').eq('club_id', clubId).in('parent_id', messageIds).limit(2000)
      : Promise.resolve({ data: [] as { parent_id: string | null }[], error: null }),
    supabase.from('chess_club_messages').select('id').eq('club_id', clubId).order('created_at', { ascending: false }).limit(1),
    messageIds.length
      ? supabase.from('chess_club_messages').select('id,fen').in('id', messageIds).not('fen', 'is', null)
      : Promise.resolve({ data: [] as { id: string; fen: string }[], error: null }),
    supabase.rpc('club_chat_game_results', { p_club: clubId, p_since: since ?? null }),
  ]);
  return {
    reactions: reactions.error ? [] : (reactions.data ?? []) as ReactionRow[],
    reactionsAvailable: !reactions.error,
    replyCounts: countReplies(replies.error ? [] : (replies.data ?? []) as { parent_id: string | null }[]),
    newestId: newest.error ? undefined : (newest.data?.[0] as { id: string } | undefined)?.id,
    fens: new Map(fens.error ? [] : ((fens.data ?? []) as { id: string; fen: string }[]).map(row => [row.id, row.fen])),
    results: results.error ? [] : (results.data ?? []) as ChatGameResult[],
  };
}
