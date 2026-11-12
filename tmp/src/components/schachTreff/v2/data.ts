import { supabase } from '../../../services/supabase';
import { countReplies, type ReactionRow } from './core';

export type V2Extras = {
  reactions: ReactionRow[];
  reactionsAvailable: boolean;
  replyCounts: Map<string, number>;
  /** Newest visible message in the room including thread replies (for read state). */
  newestId?: string;
};

/** Loads reactions, reply counts and the newest message id for the visible main-feed messages. */
export async function loadV2Extras(clubId: string, messageIds: string[]): Promise<V2Extras> {
  const [reactions, replies, newest] = await Promise.all([
    messageIds.length
      ? supabase.from('chess_club_message_reactions').select('message_id,user_id,reaction').in('message_id', messageIds)
      : Promise.resolve({ data: [] as ReactionRow[], error: null }),
    messageIds.length
      ? supabase.from('chess_club_messages').select('parent_id').eq('club_id', clubId).in('parent_id', messageIds).limit(2000)
      : Promise.resolve({ data: [] as { parent_id: string | null }[], error: null }),
    supabase.from('chess_club_messages').select('id').eq('club_id', clubId).order('created_at', { ascending: false }).limit(1),
  ]);
  return {
    reactions: reactions.error ? [] : (reactions.data ?? []) as ReactionRow[],
    reactionsAvailable: !reactions.error,
    replyCounts: countReplies(replies.error ? [] : (replies.data ?? []) as { parent_id: string | null }[]),
    newestId: newest.error ? undefined : (newest.data?.[0] as { id: string } | undefined)?.id,
  };
}
