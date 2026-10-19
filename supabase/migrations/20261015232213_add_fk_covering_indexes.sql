
CREATE INDEX IF NOT EXISTS chat_messages_match_id_idx ON public.chat_messages(match_id);
CREATE INDEX IF NOT EXISTS chat_messages_player_id_idx ON public.chat_messages(player_id);
CREATE INDEX IF NOT EXISTS matches_winner_id_idx ON public.matches(winner_id);
CREATE INDEX IF NOT EXISTS matchmaking_queue_player_id_idx ON public.matchmaking_queue(player_id);
CREATE INDEX IF NOT EXISTS moves_player_id_idx ON public.moves(player_id);
