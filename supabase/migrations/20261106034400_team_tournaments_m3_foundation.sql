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

-- Configuration has no private data. An unconditional policy also avoids an
-- RLS recursion (the event's registration policy itself checks this table).
CREATE POLICY m3_config_visible ON public.team_tournament_m3_config FOR SELECT TO anon, authenticated
  USING (true);

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

-- Authenticated teammates need read-only visibility of their own club's
-- entire draft board order. The helper uses auth.uid(), never caller input
-- as an actor, and lives outside the exposed API schemas.
CREATE FUNCTION private.team_tournament_m3_is_teammate(p_entry uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $
  SELECT EXISTS (
    SELECT 1 FROM public.team_tournament_m3_lineups
      WHERE entry_id = p_entry AND player_id = (SELECT auth.uid())
  );
$;
REVOKE ALL ON FUNCTION private.team_tournament_m3_is_teammate(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.team_tournament_m3_is_teammate(uuid) TO authenticated;

GRANT SELECT (entry_id, board_no, player_id) ON public.team_tournament_m3_lineups TO anon;
CREATE POLICY m3_lineup_private ON public.team_tournament_m3_lineups FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = player_id
    OR (SELECT private.team_tournament_m3_is_teammate(entry_id))
    OR EXISTS (SELECT 1 FROM public.team_tournament_m3_entries e
      WHERE e.id = entry_id AND (
        e.captain_id = (SELECT auth.uid())
        OR EXISTS (SELECT 1 FROM public.team_tournament_roles r
          WHERE r.tournament_id = e.tournament_id AND r.user_id = (SELECT auth.uid())
            AND r.role IN ('organizer','arbiter'))))
    OR EXISTS (SELECT 1 FROM public.team_tournament_teams team
      JOIN public.team_tournaments event ON event.id = team.tournament_id
      WHERE team.id = entry_id AND event.status IN ('published','finished')));

CREATE POLICY m3_published_lineups_public
  ON public.team_tournament_m3_lineups FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.team_tournament_teams team
    JOIN public.team_tournaments event ON event.id = team.tournament_id
    WHERE team.id = entry_id AND event.status IN ('published','finished')));
CREATE POLICY m3_entry_player_team
  ON public.team_tournament_m3_entries FOR SELECT TO authenticated
  USING ((SELECT private.team_tournament_m3_is_teammate(id)));

-- Show cancellation to captains and spectators without exposing any draft lineup.
DROP POLICY published_or_assigned ON public.team_tournaments;
CREATE POLICY published_or_assigned ON public.team_tournaments FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'finished')
    OR (status IN ('registration','cancelled') AND EXISTS (
      SELECT 1 FROM public.team_tournament_m3_config c WHERE c.tournament_id = id))
    OR EXISTS (SELECT 1 FROM public.team_tournament_roles r
      WHERE r.tournament_id = team_tournaments.id AND r.user_id = (SELECT auth.uid())));

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

-- Only the trusted command RPC may modify submitted M1 team rows and role links.
GRANT DELETE ON public.team_tournament_teams, public.team_tournament_roles TO service_role;

CREATE FUNCTION public.team_tournament_m3_command(
  p_actor uuid, p_action text, p_id uuid, p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.team_tournaments%ROWTYPE;
  config public.team_tournament_m3_config%ROWTYPE;
  invitation public.team_tournament_m3_invites%ROWTYPE;
  entry public.team_tournament_m3_entries%ROWTYPE;
  old_entry_id uuid;
  new_entry_id uuid;
  candidate_seed integer;
  boards_required integer;
  slot_count integer;
  lineup jsonb;
  entry_count integer;
  club text;
  digest text;
BEGIN
  IF p_actor IS NULL OR p_id IS NULL OR p_input IS NULL OR
     p_action NOT IN ('create_invite', 'revoke_invite', 'redeem_invite',
       'set_lineup', 'copy_previous', 'consent', 'submit', 'withdraw') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  -- Single serialization point for deadline, capacity, roster and consent.
  SELECT * INTO event FROM public.team_tournaments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO config FROM public.team_tournament_m3_config WHERE tournament_id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF event.status <> 'registration' OR clock_timestamp() >= config.registration_deadline THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000';
  END IF;
  IF p_action IN ('create_invite', 'revoke_invite') THEN
    IF NOT EXISTS (SELECT 1 FROM public.team_tournament_roles r
       WHERE r.tournament_id = p_id AND r.user_id = p_actor AND r.role = 'organizer') THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
  END IF;
  CASE p_action
    WHEN 'create_invite' THEN
      club := btrim(p_input->>'club_name');
      digest := p_input->>'token_hash';
      IF club IS NULL OR length(club) NOT BETWEEN 1 AND 120 OR
         digest IS NULL OR digest !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.team_tournament_m3_invites(tournament_id, club_name, token_hash)
        VALUES (p_id, club, digest)
        RETURNING * INTO invitation;
      RETURN jsonb_build_object('invite_id', invitation.id);
    WHEN 'revoke_invite' THEN
      UPDATE public.team_tournament_m3_invites
        SET revoked_at = clock_timestamp()
        WHERE tournament_id = p_id AND id = (p_input->>'invite_id')::uuid
          AND revoked_at IS NULL AND redeemed_at IS NULL
        RETURNING * INTO invitation;
      IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
      RETURN jsonb_build_object('invite_id', invitation.id, 'revoked', true);
    WHEN 'redeem_invite' THEN
      digest := p_input->>'token_hash';
      IF digest IS NULL OR digest !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO invitation FROM public.team_tournament_m3_invites
        WHERE tournament_id = p_id AND token_hash = digest FOR UPDATE;
      IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.redeemed_at IS NOT NULL
         THEN RAISE EXCEPTION 'invalid_invite' USING ERRCODE = 'P0001'; END IF;
      IF EXISTS (SELECT 1 FROM public.team_tournament_m3_entries e
        WHERE e.tournament_id = p_id AND e.captain_id = p_actor) THEN
        RAISE EXCEPTION 'already_exists' USING ERRCODE = '23505';
      END IF;
      INSERT INTO public.team_tournament_m3_entries(tournament_id, invite_id, club_name, captain_id)
        VALUES (p_id, invitation.id, invitation.club_name, p_actor)
        RETURNING * INTO entry;
      UPDATE public.team_tournament_m3_invites
        SET redeemed_at = clock_timestamp(), redeemed_by = p_actor WHERE id = invitation.id;
      RETURN jsonb_build_object('entry_id', entry.id, 'club_name', entry.club_name);
    WHEN 'consent' THEN
      UPDATE public.team_tournament_m3_lineups l SET consented_at = coalesce(l.consented_at, clock_timestamp())
        FROM public.team_tournament_m3_entries e
        WHERE e.id = l.entry_id AND e.tournament_id = p_id
          AND e.submitted_at IS NULL AND l.player_id = p_actor;
      IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
      RETURN jsonb_build_object('consented', true);
    ELSE
      SELECT * INTO entry FROM public.team_tournament_m3_entries e
        WHERE e.tournament_id = p_id AND e.captain_id = p_actor;
      IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

      IF p_action IN ('set_lineup', 'copy_previous', 'withdraw') AND entry.submitted_at IS NOT NULL THEN
        -- A modified/withdrawn roster may not continue occupying a place.
        DELETE FROM public.team_tournament_roles
          WHERE tournament_id = p_id AND team_id = entry.id AND role = 'captain';
        DELETE FROM public.team_tournament_teams
          WHERE tournament_id = p_id AND id = entry.id;
        UPDATE public.team_tournament_m3_entries SET submitted_at = NULL WHERE id = entry.id;
        entry.submitted_at := NULL;
      END IF;
      CASE p_action
        WHEN 'set_lineup' THEN
          lineup := p_input->'players';
          SELECT board_count INTO boards_required FROM public.team_tournament_rulesets
            WHERE tournament_id = p_id;
          IF lineup IS NULL OR jsonb_typeof(lineup) <> 'array' OR
             jsonb_array_length(lineup) > boards_required THEN
            RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
          END IF;
          DELETE FROM public.team_tournament_m3_lineups WHERE entry_id = entry.id;
          INSERT INTO public.team_tournament_m3_lineups(entry_id, board_no, player_id)
            SELECT entry.id, player.ordinality::smallint, player.value::uuid
            FROM jsonb_array_elements_text(lineup) WITH ORDINALITY AS player(value, ordinality);
          RETURN jsonb_build_object('entry_id', entry.id, 'boards', jsonb_array_length(lineup));
        WHEN 'copy_previous' THEN
          SELECT e.id INTO old_entry_id
          FROM public.team_tournament_m3_entries e
          JOIN public.team_tournament_m3_config c ON c.tournament_id = e.tournament_id
          JOIN public.team_tournaments t ON t.id = e.tournament_id
          WHERE lower(e.club_name) = lower(entry.club_name)
            AND e.tournament_id <> p_id AND c.starts_at < config.starts_at
            AND e.submitted_at IS NOT NULL AND t.status IN ('published', 'finished')
          ORDER BY c.starts_at DESC, e.id DESC LIMIT 1;
          IF old_entry_id IS NULL THEN
            RAISE EXCEPTION 'no_previous_lineup' USING ERRCODE = 'P0001';
          END IF;
          DELETE FROM public.team_tournament_m3_lineups WHERE entry_id = entry.id;
          INSERT INTO public.team_tournament_m3_lineups(entry_id, board_no, player_id)
            SELECT entry.id, board_no, player_id FROM public.team_tournament_m3_lineups
            WHERE entry_id = old_entry_id;
          RETURN jsonb_build_object('entry_id', entry.id, 'copied', true);
        WHEN 'submit' THEN
          IF entry.submitted_at IS NOT NULL THEN
            RETURN jsonb_build_object('entry_id', entry.id, 'submitted', true);
          END IF;
          SELECT board_count INTO boards_required FROM public.team_tournament_rulesets
            WHERE tournament_id = p_id;
          SELECT count(*), count(*) FILTER (WHERE consented_at IS NULL)
            INTO entry_count, slot_count FROM public.team_tournament_m3_lineups
            WHERE entry_id = entry.id;
          IF entry_count <> boards_required OR slot_count > 0 THEN
            RAISE EXCEPTION 'lineup_incomplete' USING ERRCODE = 'P0001';
          END IF;
          IF EXISTS (
            SELECT 1 FROM public.team_tournament_m3_lineups candidate
            JOIN public.team_tournament_m3_entries other ON other.id = candidate.entry_id
            WHERE other.tournament_id = p_id AND other.submitted_at IS NOT NULL
              AND candidate.player_id IN (
                SELECT player_id FROM public.team_tournament_m3_lineups WHERE entry_id = entry.id
              )
          ) THEN
            RAISE EXCEPTION 'player_already_registered' USING ERRCODE = 'P0001';
          END IF;
          SELECT count(*) INTO slot_count FROM public.team_tournament_m3_entries
            WHERE tournament_id = p_id AND submitted_at IS NOT NULL;
          IF slot_count >= config.max_teams THEN
            RAISE EXCEPTION 'event_full' USING ERRCODE = 'P0001';
          END IF;
          SELECT n INTO candidate_seed FROM generate_series(1, 16) n WHERE NOT EXISTS
            (SELECT 1 FROM public.team_tournament_teams t
             WHERE t.tournament_id = p_id AND t.seed = n)
            ORDER BY n LIMIT 1;
          INSERT INTO public.team_tournament_teams(id, tournament_id, name, seed)
            VALUES (entry.id, p_id, entry.club_name, candidate_seed);
          INSERT INTO public.team_tournament_roles(tournament_id, user_id, role, team_id)
            VALUES (p_id, p_actor, 'captain', entry.id);
          UPDATE public.team_tournament_m3_entries SET submitted_at = clock_timestamp()
            WHERE id = entry.id;
          RETURN jsonb_build_object('entry_id', entry.id, 'submitted', true);
        WHEN 'withdraw' THEN
          RETURN jsonb_build_object('entry_id', entry.id, 'submitted', false);
      END CASE;
  END CASE;
  RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_m3_command(uuid, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_m3_command(uuid, text, uuid, jsonb) TO service_role;
