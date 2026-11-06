-- M3 self-service foundation. Forward-only and independent of the M1 manual workflow.
-- QA ONLY until the complete M3 workflow and all security tests pass.
ALTER TABLE public.team_tournaments DROP CONSTRAINT team_tournaments_status_check;
ALTER TABLE public.team_tournaments
  ADD CONSTRAINT team_tournaments_status_check
  CHECK (status IN ('draft', 'registration', 'locked', 'published', 'finished', 'cancelled'));

CREATE TABLE public.team_tournament_m3_config (
  tournament_id uuid PRIMARY KEY REFERENCES public.team_tournaments(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  registration_deadline timestamptz NOT NULL,
  min_teams smallint NOT NULL DEFAULT 2 CHECK (min_teams BETWEEN 2 AND 16),
  max_teams smallint NOT NULL DEFAULT 4 CHECK (max_teams BETWEEN 2 AND 16),
  CHECK (min_teams <= max_teams),
  CHECK (registration_deadline < starts_at)
);

-- Invites contain only SHA-256 digests; plaintext tokens never enter PostgreSQL.
CREATE TABLE public.team_tournament_m3_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.team_tournaments(id),
  club_name text NOT NULL CHECK (length(btrim(club_name)) BETWEEN 1 AND 120),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tournament_id, id),
  CHECK ((redeemed_at IS NULL) = (redeemed_by IS NULL))
);
CREATE UNIQUE INDEX team_tournament_m3_invites_club
  ON public.team_tournament_m3_invites (tournament_id, lower(club_name));

CREATE TABLE public.team_tournament_m3_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.team_tournaments(id),
  invite_id uuid NOT NULL UNIQUE,
  club_name text NOT NULL CHECK (length(btrim(club_name)) BETWEEN 1 AND 120),
  captain_id uuid NOT NULL REFERENCES public.profiles(id),
  submitted_at timestamptz,
  FOREIGN KEY (tournament_id, invite_id) REFERENCES public.team_tournament_m3_invites(tournament_id, id),
  UNIQUE (tournament_id, id),
  UNIQUE (tournament_id, captain_id)
);
CREATE UNIQUE INDEX team_tournament_m3_entries_club
  ON public.team_tournament_m3_entries(tournament_id, lower(club_name));

CREATE TABLE public.team_tournament_m3_lineups (
  entry_id uuid NOT NULL REFERENCES public.team_tournament_m3_entries(id) ON DELETE CASCADE,
  board_no smallint NOT NULL CHECK (board_no BETWEEN 1 AND 16),
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  consented_at timestamptz,
  PRIMARY KEY (entry_id, board_no),
  UNIQUE (entry_id, player_id)
);
CREATE INDEX team_tournament_m3_lineups_player
  ON public.team_tournament_m3_lineups(player_id);

ALTER TABLE public.team_tournament_m3_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_m3_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_m3_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_m3_lineups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.team_tournament_m3_config, public.team_tournament_m3_invites,
  public.team_tournament_m3_entries, public.team_tournament_m3_lineups
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.team_tournament_m3_config TO anon, authenticated;
GRANT SELECT ON public.team_tournament_m3_entries, public.team_tournament_m3_lineups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_tournament_m3_config,
  public.team_tournament_m3_invites, public.team_tournament_m3_entries,
  public.team_tournament_m3_lineups TO service_role;

-- M3 registration becomes discoverable without changing any M1 private event.
DROP POLICY published_or_assigned ON public.team_tournaments;
CREATE POLICY published_or_assigned ON public.team_tournaments FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'finished')
    OR (status = 'registration' AND EXISTS (
      SELECT 1 FROM public.team_tournament_m3_config c WHERE c.tournament_id = id))
    OR EXISTS (SELECT 1 FROM public.team_tournament_roles r
      WHERE r.tournament_id = team_tournaments.id AND r.user_id = (SELECT auth.uid())));

CREATE POLICY m3_config_visible ON public.team_tournament_m3_config FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournaments e WHERE e.id = tournament_id));

-- Public sees submitted club names (from M1 team table), never draft lineups.
CREATE POLICY m3_submitted_team_names ON public.team_tournament_teams FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournament_m3_config c
    JOIN public.team_tournaments e ON e.id = c.tournament_id
    WHERE c.tournament_id = team_tournament_teams.tournament_id
      AND e.status IN ('registration', 'published', 'finished')));

CREATE POLICY m3_entry_private ON public.team_tournament_m3_entries FOR SELECT TO authenticated
  USING (captain_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.team_tournament_roles r
      WHERE r.tournament_id = team_tournament_m3_entries.tournament_id
        AND r.user_id = (SELECT auth.uid()) AND r.role IN ('organizer','arbiter'))
    OR EXISTS (SELECT 1 FROM public.team_tournaments e
      WHERE e.id = tournament_id AND e.status IN ('published','finished')));

CREATE POLICY m3_lineup_private ON public.team_tournament_m3_lineups FOR SELECT TO authenticated
  USING (player_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.team_tournament_m3_entries e
      WHERE e.id = entry_id AND (
        e.captain_id = (SELECT auth.uid())
        OR EXISTS (SELECT 1 FROM public.team_tournament_roles r
          WHERE r.tournament_id = e.tournament_id AND r.user_id = (SELECT auth.uid())
            AND r.role IN ('organizer','arbiter'))))
    OR EXISTS (SELECT 1 FROM public.team_tournament_m3_entries e
      JOIN public.team_tournaments t ON t.id = e.tournament_id
      WHERE e.id = entry_id AND t.status IN ('published','finished')));

-- Atomic M1-create + M3 configuration + opening of registration.
-- Calls are service-held only; the API authenticates p_actor.
CREATE FUNCTION public.team_tournament_m3_create(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  created jsonb;
  event_id uuid;
BEGIN
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120
     OR p_starts_at IS NULL OR p_registration_deadline IS NULL
     OR p_registration_deadline <= clock_timestamp()
     OR p_registration_deadline >= p_starts_at
     OR p_min_teams IS NULL OR p_max_teams IS NULL
     OR p_min_teams < 2 OR p_max_teams > 16 OR p_min_teams > p_max_teams
     OR (p_rules->>'board_count')::integer NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  created := public.team_tournament_command(p_actor, 'create', NULL,
    jsonb_build_object('name', btrim(p_name), 'rules', p_rules));
  event_id := (created->>'id')::uuid;
  INSERT INTO public.team_tournament_m3_config
    (tournament_id, starts_at, registration_deadline, min_teams, max_teams)
    VALUES (event_id, p_starts_at, p_registration_deadline, p_min_teams, p_max_teams);
  PERFORM public.team_tournament_command(p_actor, 'register', event_id, '{}'::jsonb);
  RETURN jsonb_build_object('id', event_id, 'status', 'registration');
END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_m3_create(
  uuid, text, jsonb, timestamptz, timestamptz, smallint, smallint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_m3_create(
  uuid, text, jsonb, timestamptz, timestamptz, smallint, smallint) TO service_role;
