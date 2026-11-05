BEGIN;

-- Retain message IDs and challenge references. Remove deleted text from storage.
ALTER TABLE public.chess_club_messages
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid,
  ADD COLUMN hidden_at timestamptz,
  ALTER COLUMN body DROP NOT NULL,
  ADD CONSTRAINT chess_club_messages_deletion_check CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND body IS NOT NULL)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND body IS NULL AND hidden_at IS NULL)
  );

-- Keep legacy message inserts working while letting the server own the clock
-- and moderation fields. The existing insert policy still checks membership.
REVOKE INSERT ON public.chess_club_messages FROM authenticated;
GRANT INSERT (club_id, author_id, body) ON public.chess_club_messages TO authenticated;

ALTER POLICY chess_club_messages_read ON public.chess_club_messages USING (
  EXISTS (
    SELECT 1 FROM public.chess_club_members m
    WHERE m.club_id = chess_club_messages.club_id AND m.user_id = (SELECT auth.uid())
      AND (chess_club_messages.hidden_at IS NULL OR m.role IN ('moderator', 'admin'))
  )
);

CREATE TABLE public.chess_club_message_reports (
  message_id uuid NOT NULL REFERENCES public.chess_club_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'abuse', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (message_id, reporter_id)
);
CREATE INDEX chess_club_message_reports_reporter_date_idx
  ON public.chess_club_message_reports(reporter_id, created_at);

CREATE TABLE public.chess_club_read_state (
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  PRIMARY KEY (club_id, user_id)
);
ALTER TABLE public.chess_club_message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_read_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chess_club_message_reports, public.chess_club_read_state
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.delete_club_message(p_message_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
  target public.chess_club_messages%ROWTYPE;
BEGIN
  SELECT msg.* INTO target
    FROM public.chess_club_messages msg
    LEFT JOIN public.chess_club_members m ON m.club_id = msg.club_id AND m.user_id = actor
    WHERE msg.id = p_message_id AND (msg.author_id = actor OR m.role IN ('moderator', 'admin'))
    FOR UPDATE OF msg;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF target.kind = 'challenge' THEN RAISE EXCEPTION 'has_challenge' USING ERRCODE = '22023'; END IF;
  IF target.deleted_at IS NOT NULL THEN RETURN; END IF;

  UPDATE public.chess_club_messages
    SET body = NULL, deleted_at = now(), deleted_by = actor, hidden_at = NULL WHERE id = p_message_id;
  UPDATE public.chess_club_message_reports SET resolved_at = now()
    WHERE message_id = p_message_id AND resolved_at IS NULL;
END
$fn$;

CREATE FUNCTION public.report_club_message(p_message_id uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
  utc_day timestamptz := date_trunc('day', now(), 'UTC');
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('spam', 'abuse', 'other') THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = '22023';
  END IF;
  -- Serialize submissions by reporter across rooms, and by message across reporters.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 3));
  PERFORM 1 FROM public.chess_club_messages msg
    JOIN public.chess_club_members m ON m.club_id = msg.club_id
    WHERE msg.id = p_message_id AND m.user_id = actor
      AND msg.author_id <> actor AND msg.deleted_at IS NULL
      AND (msg.hidden_at IS NULL OR m.role IN ('moderator', 'admin'))
    FOR UPDATE OF msg;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  IF EXISTS (SELECT 1 FROM public.chess_club_message_reports
    WHERE message_id = p_message_id AND reporter_id = actor) THEN
    RAISE EXCEPTION 'already_reported' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.chess_club_message_reports
    WHERE reporter_id = actor AND created_at >= utc_day) >= 20 THEN
    RAISE EXCEPTION 'report_limit' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.chess_club_message_reports(message_id, reporter_id, reason)
    VALUES (p_message_id, actor, p_reason);
  IF (SELECT count(*) FROM public.chess_club_message_reports
    WHERE message_id = p_message_id AND resolved_at IS NULL) >= 3 THEN
    UPDATE public.chess_club_messages SET hidden_at = now()
      WHERE id = p_message_id AND hidden_at IS NULL;
  END IF;
END
$fn$;

CREATE FUNCTION public.list_club_message_reports(p_club_id uuid)
RETURNS TABLE (message_id uuid, body text, kind text, hidden boolean, reasons text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chess_club_members m
    WHERE m.club_id = p_club_id AND m.user_id = auth.uid() AND m.role IN ('moderator', 'admin')) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT msg.id, msg.body, msg.kind, msg.hidden_at IS NOT NULL, array_agg(r.reason ORDER BY r.created_at)
    FROM public.chess_club_messages msg
    JOIN public.chess_club_message_reports r ON r.message_id = msg.id
    WHERE msg.club_id = p_club_id AND msg.deleted_at IS NULL AND r.resolved_at IS NULL
    GROUP BY msg.id
    ORDER BY min(r.created_at), msg.id
    LIMIT 50;
END
$fn$;

CREATE FUNCTION public.restore_club_message(p_message_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  PERFORM 1 FROM public.chess_club_messages msg
    JOIN public.chess_club_members m ON m.club_id = msg.club_id
    WHERE msg.id = p_message_id AND m.user_id = auth.uid()
      AND m.role IN ('moderator', 'admin') AND msg.deleted_at IS NULL
    FOR UPDATE OF msg;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  UPDATE public.chess_club_messages SET hidden_at = NULL WHERE id = p_message_id AND hidden_at IS NOT NULL;
  UPDATE public.chess_club_message_reports SET resolved_at = now()
    WHERE message_id = p_message_id AND resolved_at IS NULL;
END
$fn$;

CREATE FUNCTION public.mark_club_read(p_club_id uuid, p_message_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid();
  seen_at timestamptz;
BEGIN
  SELECT msg.created_at INTO seen_at
    FROM public.chess_club_messages msg
    JOIN public.chess_club_members m ON m.club_id = msg.club_id
    WHERE msg.club_id = p_club_id AND msg.id = p_message_id AND m.user_id = actor
      AND (msg.hidden_at IS NULL OR m.role IN ('moderator', 'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.chess_club_read_state AS state(club_id, user_id, last_read_at)
    VALUES (p_club_id, actor, seen_at)
    ON CONFLICT (club_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at
      WHERE state.last_read_at < excluded.last_read_at;
END
$fn$;

CREATE FUNCTION public.get_club_unread_counts()
RETURNS TABLE (club_id uuid, is_general boolean, unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT c.id, c.slug = 'chessaz-deutsch', count(msg.id)
  FROM public.chess_club_members m
  JOIN public.chess_clubs c ON c.id = m.club_id
  LEFT JOIN public.chess_club_read_state state ON state.club_id = m.club_id AND state.user_id = m.user_id
  LEFT JOIN public.chess_club_messages msg ON msg.club_id = m.club_id
    AND msg.created_at > coalesce(state.last_read_at, '-infinity'::timestamptz)
    AND msg.author_id <> m.user_id AND msg.deleted_at IS NULL
    AND (msg.hidden_at IS NULL OR m.role IN ('moderator', 'admin'))
  WHERE m.user_id = auth.uid()
  GROUP BY c.id;
$fn$;

CREATE FUNCTION public.clear_club_chat(p_club_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE actor uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chess_club_members m JOIN public.chess_clubs c ON c.id = m.club_id
    WHERE m.club_id = p_club_id AND m.user_id = actor AND m.role = 'admin'
      AND c.kind = 'room' AND NOT c.is_open AND c.slug <> 'chessaz-deutsch') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  WITH cleared AS (
    UPDATE public.chess_club_messages
      SET body = NULL, deleted_at = now(), deleted_by = actor, hidden_at = NULL
      WHERE club_id = p_club_id AND deleted_at IS NULL AND kind <> 'challenge' RETURNING id
  )
  UPDATE public.chess_club_message_reports SET resolved_at = now()
    WHERE resolved_at IS NULL AND message_id IN (SELECT id FROM cleared);
END
$fn$;

CREATE FUNCTION public.revoke_club_invites(p_club_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chess_club_members m JOIN public.chess_clubs c ON c.id = m.club_id
    WHERE m.club_id = p_club_id AND m.user_id = auth.uid() AND m.role = 'admin'
      AND c.kind = 'room' AND NOT c.is_open) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  -- Share the creation lock so a concurrently generated link has a defined order.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_club_id::text, 2));
  UPDATE public.chess_club_invites SET expires_at = now()
    WHERE club_id = p_club_id AND expires_at > now() AND uses < max_uses;
END
$fn$;

REVOKE ALL ON FUNCTION public.delete_club_message(uuid), public.report_club_message(uuid, text),
  public.list_club_message_reports(uuid), public.restore_club_message(uuid),
  public.mark_club_read(uuid, uuid), public.get_club_unread_counts(),
  public.clear_club_chat(uuid), public.revoke_club_invites(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_club_message(uuid), public.report_club_message(uuid, text),
  public.list_club_message_reports(uuid), public.restore_club_message(uuid),
  public.mark_club_read(uuid, uuid), public.get_club_unread_counts(),
  public.clear_club_chat(uuid), public.revoke_club_invites(uuid) TO authenticated;

COMMIT;
