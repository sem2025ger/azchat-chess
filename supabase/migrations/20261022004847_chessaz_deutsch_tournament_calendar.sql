-- ChessAZ Deutsch recurring tournament CALENDAR, based on community foundation.
-- No chess pairings, game launches, prize pools, or live tournaments in this milestone.
-- No pg_cron installation or scheduled jobs in this migration.
BEGIN;

CREATE TABLE public.chess_club_tournament_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,50}$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 4 AND 100),
  format text NOT NULL CHECK (format IN ('bullet', 'blitz', 'rapid')),
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  weekday_iso smallint CHECK (weekday_iso BETWEEN 1 AND 7),
  local_start_time time NOT NULL,
  time_zone text NOT NULL DEFAULT 'Europe/Berlin' CHECK (time_zone = 'Europe/Berlin'),
  registration_lead_hours smallint NOT NULL DEFAULT 24
    CHECK (registration_lead_hours BETWEEN 1 AND 168),
  min_players smallint NOT NULL DEFAULT 4 CHECK (min_players BETWEEN 2 AND 64),
  max_players smallint NOT NULL DEFAULT 32 CHECK (max_players BETWEEN 2 AND 128),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chess_club_template_cadence_check
    CHECK ((cadence = 'daily' AND weekday_iso IS NULL)
        OR (cadence = 'weekly' AND weekday_iso IS NOT NULL)),
  CONSTRAINT chess_club_template_capacity_check CHECK (min_players <= max_players),
  UNIQUE (club_id, slug)
);

CREATE TABLE public.chess_club_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.chess_clubs(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.chess_club_tournament_templates(id)
    ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 4 AND 100),
  format text NOT NULL CHECK (format IN ('bullet', 'blitz', 'rapid')),
  min_players smallint NOT NULL CHECK (min_players BETWEEN 2 AND 64),
  max_players smallint NOT NULL CHECK (max_players BETWEEN 2 AND 128),
  registration_opens_at timestamptz NOT NULL,
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chess_club_tournaments_capacity_check CHECK (min_players <= max_players),
  CONSTRAINT chess_club_tournaments_time_check CHECK (registration_opens_at < starts_at),
  CONSTRAINT chess_club_tournaments_unique_slot UNIQUE (template_id, starts_at)
);
CREATE INDEX chess_club_tournaments_feed_idx
  ON public.chess_club_tournaments(club_id, starts_at);

CREATE TABLE public.chess_club_tournament_entries (
  tournament_id uuid NOT NULL REFERENCES public.chess_club_tournaments(id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX chess_club_tournament_entries_user_idx
  ON public.chess_club_tournament_entries(user_id);

REVOKE ALL ON TABLE public.chess_club_tournament_templates,
  public.chess_club_tournaments, public.chess_club_tournament_entries
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chess_club_tournaments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.chess_club_tournament_entries TO authenticated;

ALTER TABLE public.chess_club_tournament_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_club_tournament_entries ENABLE ROW LEVEL SECURITY;

-- Templates are internal admin configuration. Browser roles get no policies or grants.
CREATE POLICY chess_club_tournaments_members_read
  ON public.chess_club_tournaments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chess_club_members m
    WHERE m.club_id = chess_club_tournaments.club_id
      AND m.user_id = (SELECT auth.uid())
  ));

CREATE POLICY chess_club_tournament_entries_members_read
  ON public.chess_club_tournament_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chess_club_tournaments t
    JOIN public.chess_club_members m ON m.club_id = t.club_id
    WHERE t.id = chess_club_tournament_entries.tournament_id
      AND m.user_id = (SELECT auth.uid())
  ));
CREATE POLICY chess_club_tournament_entries_join
  ON public.chess_club_tournament_entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chess_club_tournaments t
      JOIN public.chess_club_members m ON m.club_id = t.club_id
      WHERE t.id = chess_club_tournament_entries.tournament_id
        AND m.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY chess_club_tournament_entries_leave
  ON public.chess_club_tournament_entries FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Serialised capacity and registration checks, even under concurrent inserts.
CREATE FUNCTION private.enforce_chess_club_tournament_entry()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $entry_guard$
DECLARE cap integer;
BEGIN
  SELECT t.max_players INTO cap
  FROM public.chess_club_tournaments t
  WHERE t.id = NEW.tournament_id
    AND t.status = 'scheduled'
    AND t.registration_opens_at <= now()
    AND t.starts_at > now()
  FOR UPDATE;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'Registration is closed' USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(*) FROM public.chess_club_tournament_entries e
      WHERE e.tournament_id = NEW.tournament_id) >= cap THEN
    RAISE EXCEPTION 'Tournament capacity reached' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$entry_guard$;
REVOKE ALL ON FUNCTION private.enforce_chess_club_tournament_entry()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chess_club_tournament_entry_guard
  BEFORE INSERT ON public.chess_club_tournament_entries
  FOR EACH ROW EXECUTE FUNCTION private.enforce_chess_club_tournament_entry();

-- Idempotent generation with Berlin wall time (including DST) and a
-- transaction-level advisory lock. It is NOT callable from browser JWT roles.
CREATE FUNCTION private.generate_chessaz_tournament_calendar(
  p_now timestamptz DEFAULT now(), p_horizon_days integer DEFAULT 14
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $calendar$
DECLARE
  template record;
  local_date date;
  local_today date;
  proposed_start timestamptz;
  created integer := 0;
  inserted integer;
BEGIN
  IF p_now IS NULL OR p_horizon_days IS NULL
     OR p_horizon_days NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid calendar generation window'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(4903021, 70001);
  local_today := (p_now AT TIME ZONE 'Europe/Berlin')::date;
  FOR template IN
    SELECT * FROM public.chess_club_tournament_templates
    WHERE enabled = true ORDER BY club_id, slug
  LOOP
    FOR local_date IN
      SELECT (local_today + n)::date
      FROM pg_catalog.generate_series(0, p_horizon_days) AS n
    LOOP
      IF template.cadence = 'daily'
        OR EXTRACT(isodow FROM local_date)::int = template.weekday_iso THEN
        proposed_start := pg_catalog.make_timestamptz(
          EXTRACT(year FROM local_date)::int,
          EXTRACT(month FROM local_date)::int,
          EXTRACT(day FROM local_date)::int,
          EXTRACT(hour FROM template.local_start_time)::int,
          EXTRACT(minute FROM template.local_start_time)::int,
          EXTRACT(second FROM template.local_start_time),
          template.time_zone
        );
        IF proposed_start > p_now THEN
          INSERT INTO public.chess_club_tournaments (
            club_id, template_id, title, format, min_players, max_players,
            registration_opens_at, starts_at
          ) VALUES (
            template.club_id, template.id, template.title, template.format,
            template.min_players, template.max_players,
            proposed_start - pg_catalog.make_interval(hours => template.registration_lead_hours),
            proposed_start
          )
          ON CONFLICT (template_id, starts_at) DO NOTHING;
          GET DIAGNOSTICS inserted = ROW_COUNT;
          created := created + inserted;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  RETURN created;
END;
$calendar$;
REVOKE ALL ON FUNCTION private.generate_chessaz_tournament_calendar(
  timestamptz, integer) FROM PUBLIC, anon, authenticated;

-- Suggested defaults are staged DISABLED until QA activation is explicitly reviewed.
INSERT INTO public.chess_club_tournament_templates (
  club_id, slug, title, format, cadence, weekday_iso, local_start_time,
  registration_lead_hours, min_players, max_players, enabled
)
SELECT c.id, x.slug, x.title, x.format, x.cadence, x.weekday_iso,
       x.local_start_time, 24, 4, 32, false
FROM public.chess_clubs c
CROSS JOIN (VALUES
  ('daily-blitz', 'ChessAZ Deutsch Blitzabend', 'blitz', 'daily', NULL::smallint, '20:00'::time),
  ('sunday-rapid', 'ChessAZ Deutsch Rapid Sonntag', 'rapid', 'weekly', 7::smallint, '18:00'::time)
) AS x(slug, title, format, cadence, weekday_iso, local_start_time)
WHERE c.slug = 'chessaz-deutsch';

COMMIT;
