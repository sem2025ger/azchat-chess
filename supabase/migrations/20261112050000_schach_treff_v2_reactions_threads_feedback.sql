-- Schach-Treff v2 (stage 1): chess reactions, reply threads and owner feedback.
-- QA first; production requires separate rollout approval. Forward-only.
BEGIN;

-- 1. Reply threads: one level deep, same room, ordinary text only.
ALTER TABLE public.chess_club_messages
  ADD COLUMN parent_id uuid REFERENCES public.chess_club_messages(id) ON DELETE CASCADE;
CREATE INDEX chess_club_messages_thread_idx
  ON public.chess_club_messages(parent_id, created_at) WHERE parent_id IS NOT NULL;
GRANT INSERT (parent_id) ON public.chess_club_messages TO authenticated;

CREATE FUNCTION public.chess_club_messages_thread_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE parent public.chess_club_messages%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
      RAISE EXCEPTION 'invalid_parent' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM public.chess_club_messages WHERE id = NEW.parent_id;
  IF NOT FOUND OR parent.club_id <> NEW.club_id OR parent.parent_id IS NOT NULL
     OR parent.deleted_at IS NOT NULL OR parent.hidden_at IS NOT NULL OR NEW.kind <> 'text' THEN
    RAISE EXCEPTION 'invalid_parent' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.chess_club_messages_thread_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chess_club_messages_thread_guard
  BEFORE INSERT OR UPDATE OF parent_id ON public.chess_club_messages
  FOR EACH ROW EXECUTE FUNCTION public.chess_club_messages_thread_guard();

-- 2. Chess-annotation reactions: !!, ! and !? (one of each per member and message).
CREATE TABLE public.chess_club_message_reactions (
  message_id uuid NOT NULL REFERENCES public.chess_club_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('!!', '!', '!?')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, reaction)
);
CREATE INDEX chess_club_message_reactions_user_idx ON public.chess_club_message_reactions(user_id);
ALTER TABLE public.chess_club_message_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chess_club_message_reactions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.chess_club_message_reactions TO authenticated;
GRANT INSERT (message_id, user_id, reaction) ON public.chess_club_message_reactions TO authenticated;

CREATE POLICY chess_club_message_reactions_read ON public.chess_club_message_reactions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.chess_club_messages msg
    JOIN public.chess_club_members m ON m.club_id = msg.club_id
    WHERE msg.id = chess_club_message_reactions.message_id AND m.user_id = (SELECT auth.uid())
      AND (msg.hidden_at IS NULL OR m.role IN ('moderator', 'admin'))
  ));
CREATE POLICY chess_club_message_reactions_add ON public.chess_club_message_reactions
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.chess_club_messages msg
      JOIN public.chess_club_members m ON m.club_id = msg.club_id
      WHERE msg.id = chess_club_message_reactions.message_id AND m.user_id = (SELECT auth.uid())
        AND msg.deleted_at IS NULL AND msg.hidden_at IS NULL
    ));
CREATE POLICY chess_club_message_reactions_remove ON public.chess_club_message_reactions
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- 3. "Ihre Meinung": ideas and problems, readable only by the team (no client SELECT).
CREATE TABLE public.chessaz_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 3 AND 2000),
  page text CHECK (page IS NULL OR char_length(page) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chessaz_feedback_user_date_idx ON public.chessaz_feedback(user_id, created_at);
ALTER TABLE public.chessaz_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chessaz_feedback FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.submit_chessaz_feedback(p_body text, p_page text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'invalid_feedback' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('feedback:' || actor::text, 0));
  IF (SELECT count(*) FROM public.chessaz_feedback
      WHERE user_id = actor AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'feedback_limit' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.chessaz_feedback(user_id, body, page)
    VALUES (actor, btrim(p_body), nullif(left(btrim(coalesce(p_page, '')), 200), ''));
END
$fn$;
REVOKE ALL ON FUNCTION public.submit_chessaz_feedback(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_chessaz_feedback(text, text) TO authenticated;

COMMIT;
