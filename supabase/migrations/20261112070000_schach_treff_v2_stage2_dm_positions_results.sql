-- Schach-Treff v2 (stage 2): direct messages with blocking and "who can message me",
-- more seek time controls, positions inside messages and finished chat-challenge games.
-- QA first; production requires separate rollout approval. Forward-only.
BEGIN;

-- 1. Seek time controls: 1+0, 3+0, 3+2, 5+0, 10+0, 15+10 (all already allowed by the game server).
ALTER TABLE public.chess_club_challenges DROP CONSTRAINT chess_club_challenges_time_control_check;
ALTER TABLE public.chess_club_challenges ADD CONSTRAINT chess_club_challenges_time_control_check
  CHECK (time_control IN ('1+0','3+0','3+2','5+0','10+0','15+10'));

CREATE OR REPLACE FUNCTION public.club_challenge_action(p_action text,p_actor uuid,p_club uuid DEFAULT NULL,
 p_challenge uuid DEFAULT NULL,p_time text DEFAULT NULL,p_target uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE r public.chess_club_challenges%ROWTYPE; message uuid;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_action IN ('create','watch') THEN
  IF NOT EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=p_club AND user_id=p_actor) THEN
   RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
  UPDATE public.chess_club_challenges SET status='expired' WHERE club_id=p_club AND status='open' AND expires_at<=now();
  UPDATE public.chess_club_challenges SET status='expired' WHERE club_id=p_club AND status='accepted' AND room_id IS NULL AND accepted_at<=now()-interval '2 minutes';
  IF p_action='watch' THEN RETURN jsonb_build_object('ok',true); END IF;
  IF p_time IS NULL OR p_time NOT IN ('1+0','3+0','3+2','5+0','10+0','15+10') THEN RAISE EXCEPTION 'invalid_time_control' USING ERRCODE='22023'; END IF;
  IF p_target IS NOT NULL AND (p_target=p_actor OR NOT EXISTS(
   SELECT 1 FROM public.chess_club_members WHERE club_id=p_club AND user_id=p_target)) THEN
   RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));
  IF (SELECT count(*) FROM public.chess_club_challenges WHERE created_by=p_actor AND status='open' AND expires_at>now())>=3 THEN
   RAISE EXCEPTION 'challenge_limit' USING ERRCODE='23514'; END IF;
  INSERT INTO public.chess_club_messages(club_id,author_id,kind,body) VALUES(p_club,p_actor,'challenge','Herausforderung '||p_time) RETURNING id INTO message;
  INSERT INTO public.chess_club_challenges(club_id,message_id,created_by,target_user_id,time_control)
   VALUES(p_club,message,p_actor,p_target,p_time) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.chess_club_challenges WHERE id=p_challenge FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=r.club_id AND user_id=p_actor) THEN
   RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
  IF r.status='open' AND r.expires_at<=now() THEN
   UPDATE public.chess_club_challenges SET status='expired' WHERE id=r.id RETURNING * INTO r;
  END IF;
  IF p_action='accept' THEN
   IF r.status<>'open' THEN RETURN jsonb_build_object('ok',false,'code',CASE WHEN r.status='expired' THEN 'expired' ELSE 'already_taken' END); END IF;
   IF r.created_by=p_actor OR (r.target_user_id IS NOT NULL AND r.target_user_id<>p_actor) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=r.club_id AND user_id=r.created_by) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
   UPDATE public.chess_club_challenges SET status='accepted',accepted_by=p_actor,accepted_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSIF p_action='cancel' THEN
   IF r.created_by<>p_actor THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
   IF r.status='open' THEN UPDATE public.chess_club_challenges SET status='cancelled' WHERE id=r.id RETURNING * INTO r; END IF;
  ELSE RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'challenge',to_jsonb(r));
END $fn$;
REVOKE ALL ON FUNCTION public.club_challenge_action(text,uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.club_challenge_action(text,uuid,uuid,uuid,text,uuid) TO service_role;

-- 2. Personal chat settings: who may message me, and whether my chat games appear in chat.
CREATE TABLE public.chess_chat_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dm_policy text NOT NULL DEFAULT 'all' CHECK (dm_policy IN ('all', 'clubs', 'none')),
  hide_games boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chess_chat_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chess_chat_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.chess_chat_settings TO authenticated;
CREATE POLICY chess_chat_settings_own ON public.chess_chat_settings
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.set_chat_settings(p_dm_policy text, p_hide_games boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_dm_policy IS NULL OR p_dm_policy NOT IN ('all', 'clubs', 'none') OR p_hide_games IS NULL THEN
    RAISE EXCEPTION 'invalid_settings' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.chess_chat_settings(user_id, dm_policy, hide_games) VALUES (actor, p_dm_policy, p_hide_games)
  ON CONFLICT (user_id) DO UPDATE SET dm_policy = excluded.dm_policy, hide_games = excluded.hide_games, updated_at = now();
END
$fn$;
REVOKE ALL ON FUNCTION public.set_chat_settings(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_chat_settings(text, boolean) TO authenticated;

-- 3. Blocking (one direction is enough to stop direct messages both ways).
CREATE TABLE public.chess_user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX chess_user_blocks_blocked_idx ON public.chess_user_blocks(blocked_id);
ALTER TABLE public.chess_user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chess_user_blocks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.chess_user_blocks TO authenticated;
GRANT INSERT (blocker_id, blocked_id) ON public.chess_user_blocks TO authenticated;
CREATE POLICY chess_user_blocks_read ON public.chess_user_blocks
  FOR SELECT TO authenticated USING (blocker_id = (SELECT auth.uid()));
CREATE POLICY chess_user_blocks_add ON public.chess_user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = (SELECT auth.uid()));
CREATE POLICY chess_user_blocks_remove ON public.chess_user_blocks
  FOR DELETE TO authenticated USING (blocker_id = (SELECT auth.uid()));

-- 4. Direct messages are two-member private rooms of kind 'dm'. They reuse messages,
-- reactions, threads, unread state and moderation; they are never open or invitable.
ALTER TABLE public.chess_clubs DROP CONSTRAINT chess_clubs_kind_check;
ALTER TABLE public.chess_clubs ADD CONSTRAINT chess_clubs_kind_check CHECK (kind IN ('community', 'room', 'dm'));
ALTER TABLE public.chess_clubs ADD COLUMN dm_key text UNIQUE,
  ADD CONSTRAINT chess_clubs_dm_shape_check CHECK ((kind = 'dm') = (dm_key IS NOT NULL) AND (kind <> 'dm' OR NOT is_open));

-- Returns NULL when sender may write to recipient, otherwise the refusal code.
CREATE FUNCTION private.dm_refusal(p_sender uuid, p_recipient uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE
    WHEN p_sender IS NULL OR p_recipient IS NULL OR p_sender = p_recipient THEN 'not_allowed'
    WHEN EXISTS (SELECT 1 FROM public.chess_user_blocks b
                 WHERE (b.blocker_id = p_sender AND b.blocked_id = p_recipient)
                    OR (b.blocker_id = p_recipient AND b.blocked_id = p_sender)) THEN 'blocked'
    WHEN coalesce((SELECT s.dm_policy FROM public.chess_chat_settings s WHERE s.user_id = p_recipient), 'all') = 'none' THEN 'dm_not_allowed'
    WHEN coalesce((SELECT s.dm_policy FROM public.chess_chat_settings s WHERE s.user_id = p_recipient), 'all') = 'clubs'
      AND NOT EXISTS (SELECT 1 FROM public.chess_club_members a
                      JOIN public.chess_club_members b ON b.club_id = a.club_id AND b.user_id = p_recipient
                      JOIN public.chess_clubs c ON c.id = a.club_id AND c.kind = 'room'
                      WHERE a.user_id = p_sender) THEN 'dm_not_allowed'
    ELSE NULL
  END
$fn$;
REVOKE ALL ON FUNCTION private.dm_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.open_direct_chat(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
  refusal text;
  pair text;
  room uuid;
BEGIN
  IF actor IS NULL OR p_user IS NULL OR p_user = actor
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  refusal := private.dm_refusal(actor, p_user);
  IF refusal IS NOT NULL THEN RAISE EXCEPTION '%', refusal USING ERRCODE = '42501'; END IF;
  pair := least(actor::text, p_user::text) || ':' || greatest(actor::text, p_user::text);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dm:' || pair, 0));
  SELECT id INTO room FROM public.chess_clubs WHERE dm_key = pair;
  IF room IS NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dm-limit:' || actor::text, 0));
    IF (SELECT count(*) FROM public.chess_clubs
        WHERE created_by = actor AND kind = 'dm' AND created_at > now() - interval '24 hours') >= 20 THEN
      RAISE EXCEPTION 'dm_limit' USING ERRCODE = '23514';
    END IF;
    room := gen_random_uuid();
    INSERT INTO public.chess_clubs(id, slug, name, country_code, is_open, kind, created_by, dm_key)
      VALUES (room, 'dm-' || replace(room::text, '-', ''), 'Direktnachricht', 'DE', false, 'dm', actor, pair);
  END IF;
  INSERT INTO public.chess_club_members(club_id, user_id, role)
    VALUES (room, actor, 'member'), (room, p_user, 'member') ON CONFLICT DO NOTHING;
  RETURN room;
END
$fn$;
REVOKE ALL ON FUNCTION public.open_direct_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_direct_chat(uuid) TO authenticated;

-- 5. Positions in messages (FEN) and message guard for direct chats.
ALTER TABLE public.chess_club_messages ADD COLUMN fen text CHECK (fen IS NULL OR (
  char_length(fen) <= 100
  AND fen ~ '^[1-8pnbrqkPNBRQK]{1,8}(/[1-8pnbrqkPNBRQK]{1,8}){7} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) [0-9]{1,4} [0-9]{1,4}$'
));
GRANT INSERT (fen) ON public.chess_club_messages TO authenticated;

CREATE FUNCTION public.chess_club_messages_dm_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE other uuid; refusal text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- A deleted message keeps no position either.
    IF NEW.deleted_at IS NOT NULL THEN NEW.fen := NULL; END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chess_clubs WHERE id = NEW.club_id AND kind = 'dm') THEN RETURN NEW; END IF;
  SELECT user_id INTO other FROM public.chess_club_members WHERE club_id = NEW.club_id AND user_id <> NEW.author_id LIMIT 1;
  refusal := CASE WHEN other IS NULL THEN 'dm_not_allowed' ELSE private.dm_refusal(NEW.author_id, other) END;
  IF refusal IS NOT NULL THEN RAISE EXCEPTION '%', refusal USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.chess_club_messages_dm_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chess_club_messages_dm_guard
  BEFORE INSERT OR UPDATE OF deleted_at ON public.chess_club_messages
  FOR EACH ROW EXECUTE FUNCTION public.chess_club_messages_dm_guard();

-- 6. Finished games that started from a chat challenge (players can opt out in settings).
CREATE FUNCTION public.club_chat_game_results(p_club uuid, p_since timestamptz DEFAULT NULL)
RETURNS TABLE (challenge_id uuid, message_id uuid, match_id uuid, white_id uuid, black_id uuid,
  white_name text, black_name text, result text, termination_reason text, time_control text,
  completed_at timestamptz, pgn text, initial_fen text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT ch.id, ch.message_id, m.id, m.white_id, m.black_id, pw.username, pb.username,
    m.result, m.termination_reason, m.time_control, m.completed_at, m.pgn, m.initial_fen
  FROM public.chess_club_challenges ch
  JOIN public.matches m ON m.source_room_id = ch.room_id::text
  LEFT JOIN public.profiles pw ON pw.id = m.white_id
  LEFT JOIN public.profiles pb ON pb.id = m.black_id
  WHERE ch.club_id = p_club AND ch.status = 'accepted' AND ch.room_id IS NOT NULL
    AND m.completed_at IS NOT NULL AND m.result IS NOT NULL
    AND (p_since IS NULL OR m.completed_at >= p_since)
    AND EXISTS (SELECT 1 FROM public.chess_club_members mm WHERE mm.club_id = p_club AND mm.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.chess_chat_settings s WHERE s.user_id IN (m.white_id, m.black_id) AND s.hide_games)
  ORDER BY m.completed_at DESC
  LIMIT 50
$fn$;
REVOKE ALL ON FUNCTION public.club_chat_game_results(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_chat_game_results(uuid, timestamptz) TO authenticated;

COMMIT;
