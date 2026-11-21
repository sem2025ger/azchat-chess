-- M3 round scheduling, private lineup revisions and replay-safe creation.
ALTER TABLE public.team_tournament_rounds ADD COLUMN starts_at timestamptz;
ALTER TABLE public.team_tournament_m3_config ADD COLUMN round_interval_minutes integer
  CHECK (round_interval_minutes BETWEEN 10 AND 10080);
GRANT UPDATE (starts_at) ON public.team_tournament_rounds TO service_role;

ALTER TABLE public.team_tournament_m3_entries
  ADD COLUMN revision_pending boolean NOT NULL DEFAULT false;

CREATE TABLE public.team_tournament_m3_revision_lineups (
  entry_id uuid NOT NULL REFERENCES public.team_tournament_m3_entries(id) ON DELETE CASCADE,
  board_no smallint NOT NULL CHECK (board_no BETWEEN 1 AND 16),
  player_id uuid NOT NULL REFERENCES public.profiles(id),
  consented_at timestamptz,
  PRIMARY KEY (entry_id, board_no),
  UNIQUE (entry_id, player_id)
);
CREATE INDEX team_tournament_m3_revision_player
  ON public.team_tournament_m3_revision_lineups(player_id);

ALTER TABLE public.team_tournament_m3_revision_lineups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_tournament_m3_revision_lineups
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.team_tournament_m3_revision_lineups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_tournament_m3_revision_lineups TO service_role;

-- A newly added player may need to read the entry name before consenting.
CREATE FUNCTION private.team_tournament_m3_is_revision_player(p_entry uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_tournament_m3_revision_lineups
    WHERE entry_id = p_entry AND player_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.team_tournament_m3_is_revision_player(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.team_tournament_m3_is_revision_player(uuid) TO authenticated;

CREATE POLICY m3_entry_revision_player ON public.team_tournament_m3_entries
  FOR SELECT TO authenticated USING ((SELECT private.team_tournament_m3_is_revision_player(id)));
CREATE POLICY m3_revision_private ON public.team_tournament_m3_revision_lineups
  FOR SELECT TO authenticated USING (
    player_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_tournament_m3_entries e
      WHERE e.id = entry_id AND e.captain_id = (SELECT auth.uid())
    )
  );

GRANT USAGE ON SCHEMA private TO service_role;
CREATE TABLE private.team_tournament_m3_create_requests (
  creator uuid NOT NULL REFERENCES public.profiles(id),
  client_request_id uuid NOT NULL,
  payload_hash bytea NOT NULL,
  tournament_id uuid NOT NULL REFERENCES public.team_tournaments(id) ON DELETE CASCADE,
  PRIMARY KEY (creator, client_request_id)
);
ALTER TABLE private.team_tournament_m3_create_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.team_tournament_m3_create_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON private.team_tournament_m3_create_requests TO service_role;

-- The existing arities remain usable during rollout. The new signatures
-- share one replay store and delegate creation/limits to the original RPCs.
CREATE FUNCTION private.team_tournament_m3_create_with_request(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_round_interval_minutes integer, p_client_request_id uuid, p_active_limit smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  request_hash bytea;
  existing private.team_tournament_m3_create_requests%ROWTYPE;
  created jsonb;
  event_id uuid;
BEGIN
  IF p_actor IS NULL OR p_round_interval_minutes NOT BETWEEN 10 AND 10080 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF p_active_limit IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_tournament_organizers WHERE user_id = p_actor
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_client_request_id IS NOT NULL THEN
    -- Replays must be checked before the deadline and active-event limit.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'team_tournament_m3_create_request:' || p_actor::text || ':' || p_client_request_id::text, 0));
    request_hash := sha256(convert_to(jsonb_build_array(
      btrim(p_name), p_rules, extract(epoch FROM p_starts_at),
      extract(epoch FROM p_registration_deadline), p_min_teams, p_max_teams, p_round_interval_minutes
    )::text, 'UTF8'));
    SELECT * INTO existing FROM private.team_tournament_m3_create_requests
      WHERE creator = p_actor AND client_request_id = p_client_request_id;
    IF FOUND THEN
      IF existing.payload_hash <> request_hash THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object('id', existing.tournament_id, 'status', 'registration');
    END IF;
  END IF;

  IF p_registration_deadline <= clock_timestamp() THEN
    RAISE EXCEPTION 'invalid_time' USING ERRCODE = 'P0001';
  END IF;
  IF p_active_limit IS NULL THEN
    created := public.team_tournament_m3_create(
      p_actor, p_name, p_rules, p_starts_at, p_registration_deadline, p_min_teams, p_max_teams);
  ELSE
    created := public.team_tournament_m3_create_open(
      p_actor, p_name, p_rules, p_starts_at, p_registration_deadline, p_min_teams, p_max_teams, p_active_limit);
  END IF;
  event_id := (created->>'id')::uuid;
  IF p_round_interval_minutes IS NOT NULL THEN
    UPDATE public.team_tournament_m3_config SET round_interval_minutes = p_round_interval_minutes
      WHERE tournament_id = event_id;
  END IF;
  IF p_client_request_id IS NOT NULL THEN
    INSERT INTO private.team_tournament_m3_create_requests
      (creator, client_request_id, payload_hash, tournament_id)
      VALUES (p_actor, p_client_request_id, request_hash, event_id);
  END IF;
  RETURN created;
END;
$$;

CREATE FUNCTION public.team_tournament_m3_create(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_round_interval_minutes integer, p_client_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.team_tournament_m3_create_with_request(p_actor, p_name, p_rules,
    p_starts_at, p_registration_deadline, p_min_teams, p_max_teams,
    p_round_interval_minutes, p_client_request_id, NULL::smallint);
$$;
CREATE FUNCTION public.team_tournament_m3_create_open(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_active_limit smallint, p_round_interval_minutes integer, p_client_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_active_limit IS NULL OR p_active_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN private.team_tournament_m3_create_with_request(p_actor, p_name, p_rules,
    p_starts_at, p_registration_deadline, p_min_teams, p_max_teams,
    p_round_interval_minutes, p_client_request_id, p_active_limit);
END;
$$;
REVOKE ALL ON FUNCTION
  private.team_tournament_m3_create_with_request(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid,smallint),
  public.team_tournament_m3_create(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid),
  public.team_tournament_m3_create_open(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,smallint,integer,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  private.team_tournament_m3_create_with_request(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid,smallint),
  public.team_tournament_m3_create(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid),
  public.team_tournament_m3_create_open(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,smallint,integer,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.team_tournament_m3_command(
  p_actor uuid, p_action text, p_id uuid, p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.team_tournaments%ROWTYPE;
  config public.team_tournament_m3_config%ROWTYPE;
  invitation public.team_tournament_m3_invites%ROWTYPE;
  entry public.team_tournament_m3_entries%ROWTYPE;
  old_entry_id uuid;
  candidate_seed integer;
  boards_required integer;
  slot_count integer;
  lineup jsonb;
  consents jsonb;
  submitting_revision boolean;
  entry_count integer;
  club text;
  digest text;
BEGIN
  IF p_actor IS NULL OR p_id IS NULL OR p_input IS NULL OR
     p_action NOT IN ('create_invite', 'revoke_invite', 'redeem_invite',
       'set_lineup', 'copy_previous', 'consent', 'submit', 'submit_revision', 'withdraw') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  -- Single serialization point for deadline, capacity, roster and consent.
  SELECT * INTO event FROM public.team_tournaments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO config FROM public.team_tournament_m3_config WHERE tournament_id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF event.status <> 'registration' OR clock_timestamp() >= config.registration_deadline THEN
    IF p_action = 'submit_revision' THEN
      RAISE EXCEPTION 'revision_closed' USING ERRCODE = 'P0001';
    END IF;
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
      -- Consent is specific to a club entry, never a blanket approval of all
      -- draft entries that currently contain this player.
      IF p_input->>'entry_id' IS NULL THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      UPDATE public.team_tournament_m3_lineups l
        SET consented_at = coalesce(l.consented_at, clock_timestamp())
        FROM public.team_tournament_m3_entries e
        WHERE e.id = l.entry_id AND e.tournament_id = p_id
          AND e.id = (p_input->>'entry_id')::uuid
          AND e.submitted_at IS NULL AND l.player_id = p_actor;
      IF NOT FOUND THEN
        UPDATE public.team_tournament_m3_revision_lineups l
          SET consented_at = coalesce(l.consented_at, clock_timestamp())
          FROM public.team_tournament_m3_entries e
          WHERE e.id = l.entry_id AND e.tournament_id = p_id
            AND e.id = (p_input->>'entry_id')::uuid
            AND e.revision_pending AND l.player_id = p_actor;
        IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
      END IF;
      RETURN jsonb_build_object('consented', true, 'entry_id', p_input->>'entry_id');
    ELSE
      SELECT * INTO entry FROM public.team_tournament_m3_entries e
        WHERE e.tournament_id = p_id AND e.captain_id = p_actor;
      IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

      CASE p_action
        WHEN 'set_lineup', 'copy_previous' THEN
          SELECT board_count INTO boards_required FROM public.team_tournament_rulesets
            WHERE tournament_id = p_id;
          IF p_action = 'copy_previous' THEN
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
            SELECT coalesce(jsonb_agg(player_id ORDER BY board_no), '[]'::jsonb) INTO lineup
              FROM public.team_tournament_m3_lineups
              WHERE entry_id = old_entry_id;
          ELSE
            lineup := p_input->'players';
          END IF;
          IF lineup IS NULL OR jsonb_typeof(lineup) <> 'array' OR
             (p_action = 'set_lineup' AND jsonb_array_length(lineup) > boards_required) THEN
            RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
          END IF;

          -- Consent belongs to a player and this entry, independent of board number.
          SELECT jsonb_object_agg(player_id, consented_at ORDER BY consented_at NULLS FIRST)
            INTO consents
            FROM (
              SELECT player_id, consented_at FROM public.team_tournament_m3_lineups WHERE entry_id = entry.id
              UNION ALL
              SELECT player_id, consented_at FROM public.team_tournament_m3_revision_lineups WHERE entry_id = entry.id
            ) AS existing;
          IF entry.submitted_at IS NULL THEN
            DELETE FROM public.team_tournament_m3_lineups WHERE entry_id = entry.id;
            INSERT INTO public.team_tournament_m3_lineups(entry_id, board_no, player_id, consented_at)
              SELECT entry.id, player.ordinality::smallint, player.value::uuid,
                (consents->>player.value)::timestamptz
              FROM jsonb_array_elements_text(lineup) WITH ORDINALITY AS player(value, ordinality);
          ELSE
            DELETE FROM public.team_tournament_m3_revision_lineups WHERE entry_id = entry.id;
            INSERT INTO public.team_tournament_m3_revision_lineups(entry_id, board_no, player_id, consented_at)
              SELECT entry.id, player.ordinality::smallint, player.value::uuid,
                (consents->>player.value)::timestamptz
              FROM jsonb_array_elements_text(lineup) WITH ORDINALITY AS player(value, ordinality);
            UPDATE public.team_tournament_m3_entries SET revision_pending = true WHERE id = entry.id;
          END IF;
          IF p_action = 'copy_previous' THEN
            RETURN jsonb_build_object('entry_id', entry.id, 'copied', true);
          END IF;
          RETURN jsonb_build_object('entry_id', entry.id, 'boards', jsonb_array_length(lineup));

        WHEN 'submit', 'submit_revision' THEN
          submitting_revision := p_action = 'submit_revision';
          IF submitting_revision AND (entry.submitted_at IS NULL OR NOT entry.revision_pending) THEN
            RAISE EXCEPTION 'revision_missing' USING ERRCODE = 'P0001';
          END IF;
          IF NOT submitting_revision AND entry.submitted_at IS NOT NULL THEN
            RETURN jsonb_build_object('entry_id', entry.id, 'submitted', true);
          END IF;
          SELECT board_count INTO boards_required FROM public.team_tournament_rulesets
            WHERE tournament_id = p_id;
          -- Validate exactly the roster this action would make official.
          SELECT count(*), count(*) FILTER (WHERE consented_at IS NULL), jsonb_agg(player_id)
            INTO entry_count, slot_count, lineup FROM (
              SELECT player_id, consented_at FROM public.team_tournament_m3_lineups
                WHERE entry_id = entry.id AND NOT submitting_revision
              UNION ALL
              SELECT player_id, consented_at FROM public.team_tournament_m3_revision_lineups
                WHERE entry_id = entry.id AND submitting_revision
            ) AS candidate;
          IF entry_count <> boards_required OR slot_count > 0 THEN
            IF submitting_revision THEN
              RAISE EXCEPTION 'revision_incomplete' USING ERRCODE = 'P0001';
            END IF;
            RAISE EXCEPTION 'lineup_incomplete' USING ERRCODE = 'P0001';
          END IF;
          IF EXISTS (
            SELECT 1 FROM public.team_tournament_m3_lineups candidate
            JOIN public.team_tournament_m3_entries other ON other.id = candidate.entry_id
            WHERE other.tournament_id = p_id AND other.submitted_at IS NOT NULL AND other.id <> entry.id
              AND lineup ? candidate.player_id::text
          ) THEN
            RAISE EXCEPTION 'player_already_registered' USING ERRCODE = 'P0001';
          END IF;
          IF submitting_revision THEN
            DELETE FROM public.team_tournament_m3_lineups WHERE entry_id = entry.id;
            INSERT INTO public.team_tournament_m3_lineups(entry_id, board_no, player_id, consented_at)
              SELECT entry_id, board_no, player_id, consented_at
              FROM public.team_tournament_m3_revision_lineups WHERE entry_id = entry.id;
            DELETE FROM public.team_tournament_m3_revision_lineups WHERE entry_id = entry.id;
            UPDATE public.team_tournament_m3_entries SET revision_pending = false WHERE id = entry.id;
          ELSE
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
          END IF;
          RETURN jsonb_build_object('entry_id', entry.id, 'submitted', true);

        WHEN 'withdraw' THEN
          IF entry.submitted_at IS NOT NULL THEN
            DELETE FROM public.team_tournament_roles
              WHERE tournament_id = p_id AND team_id = entry.id AND role = 'captain';
            DELETE FROM public.team_tournament_teams WHERE tournament_id = p_id AND id = entry.id;
            DELETE FROM public.team_tournament_m3_revision_lineups WHERE entry_id = entry.id;
            UPDATE public.team_tournament_m3_entries
              SET submitted_at = NULL, revision_pending = false WHERE id = entry.id;
          END IF;
          RETURN jsonb_build_object('entry_id', entry.id, 'submitted', false);
      END CASE;
  END CASE;
  RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.team_tournament_m3_tick(p_id uuid, p_rounds jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.team_tournaments%ROWTYPE;
  config public.team_tournament_m3_config%ROWTYPE;
  organizer_id uuid;
  team_count integer;
  published jsonb;
BEGIN
  SELECT * INTO event FROM public.team_tournaments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO config FROM public.team_tournament_m3_config WHERE tournament_id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', event.status, 'm3', false); END IF;
  IF event.status <> 'registration' OR clock_timestamp() < config.registration_deadline THEN
    RETURN jsonb_build_object('status', event.status, 'm3', true);
  END IF;
  DELETE FROM public.team_tournament_m3_revision_lineups l
    USING public.team_tournament_m3_entries e
    WHERE l.entry_id = e.id AND e.tournament_id = p_id AND e.revision_pending;
  UPDATE public.team_tournament_m3_entries SET revision_pending = false
    WHERE tournament_id = p_id AND revision_pending;

  SELECT count(*) INTO team_count FROM public.team_tournament_teams
    WHERE tournament_id = p_id;
  IF team_count < config.min_teams THEN
    UPDATE public.team_tournaments SET status = 'cancelled' WHERE id = p_id;
    RETURN jsonb_build_object('status', 'cancelled', 'm3', true);
  END IF;
  IF team_count > config.max_teams OR p_rounds IS NULL OR jsonb_typeof(p_rounds) <> 'array' THEN
    RAISE EXCEPTION 'invalid_schedule' USING ERRCODE = '22023';
  END IF;
  SELECT user_id INTO organizer_id FROM public.team_tournament_roles
    WHERE tournament_id = p_id AND role = 'organizer' ORDER BY user_id LIMIT 1;
  IF organizer_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  PERFORM public.team_tournament_command(organizer_id, 'lock', p_id, '{}'::jsonb);
  published := public.team_tournament_command(organizer_id, 'publish', p_id,
    jsonb_build_object('rounds', p_rounds));
  IF config.round_interval_minutes IS NOT NULL THEN
    UPDATE public.team_tournament_rounds
      SET starts_at = config.starts_at + make_interval(mins => (round_no - 1) * config.round_interval_minutes)
      WHERE tournament_id = p_id;
  END IF;
  RETURN published;
END;
$$;

CREATE OR REPLACE FUNCTION public.team_tournament_m3_my_board()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'tournament_id', t.id, 'tournament_name', t.name,
    'match_id', m.id, 'round_no', m.round_no, 'board_no', l.board_no,
    'opponent', opponent.username,
    'side', CASE WHEN (l.entry_id = m.home_team_id) = b.home_white THEN 'white' ELSE 'black' END,
    'result', b.result, 'confirmed', b.confirmed,
    'status', coalesce(state.status, 'pending'),
    'opponent_report', peer.result, 'opponent_kind', peer.kind
  ) || CASE WHEN round.starts_at IS NULL THEN '{}'::jsonb
       ELSE jsonb_build_object('starts_at', round.starts_at) END
  FROM public.team_tournament_m3_lineups l
  JOIN public.team_tournament_m3_entries e ON e.id = l.entry_id
  JOIN public.team_tournaments t ON t.id = e.tournament_id
  JOIN public.team_tournament_matches m ON m.tournament_id = t.id
    AND l.entry_id IN (m.home_team_id,m.away_team_id)
  JOIN public.team_tournament_rounds round ON round.tournament_id = m.tournament_id
    AND round.round_no = m.round_no
  JOIN public.team_tournament_board_results b ON b.match_id = m.id
    AND b.board_no = l.board_no
  JOIN public.team_tournament_m3_lineups other_player
    ON other_player.entry_id = CASE
      WHEN l.entry_id = m.home_team_id THEN m.away_team_id ELSE m.home_team_id END
    AND other_player.board_no = l.board_no
  JOIN public.profiles opponent ON opponent.id = other_player.player_id
  LEFT JOIN public.team_tournament_m3_board_states state
    ON state.match_id = m.id AND state.board_no = l.board_no
  LEFT JOIN public.team_tournament_m3_board_reports peer
    ON peer.match_id = m.id AND peer.board_no = l.board_no
      AND peer.side <> CASE
        WHEN (l.entry_id = m.home_team_id) = b.home_white THEN 'white' ELSE 'black' END
  WHERE l.player_id = (SELECT auth.uid()) AND t.status = 'published'
    AND m.round_no = (
      SELECT min(r.round_no) FROM public.team_tournament_rounds r
      WHERE r.tournament_id = t.id AND EXISTS (
        SELECT 1 FROM public.team_tournament_matches pending_match
        JOIN public.team_tournament_board_results pending_board
          ON pending_board.match_id = pending_match.id
        WHERE pending_match.tournament_id = t.id AND pending_match.round_no = r.round_no
          AND NOT pending_board.confirmed
      )
    )
  ORDER BY t.published_at DESC, t.id, m.round_no, l.board_no LIMIT 1;
$$;

CREATE FUNCTION public.team_tournament_m3_set_round_time(
  p_actor uuid, p_id uuid, p_round_no smallint, p_starts_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  current_start timestamptz;
BEGIN
  IF p_actor IS NULL OR p_id IS NULL OR p_round_no IS NULL OR p_round_no NOT BETWEEN 1 AND 15
    OR p_starts_at IS NULL OR NOT isfinite(p_starts_at) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  -- Serialize all edits of this event, including edits of adjacent rounds.
  PERFORM 1 FROM public.team_tournaments WHERE id = p_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.team_tournament_roles
    WHERE tournament_id = p_id AND user_id = p_actor AND role = 'organizer') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT starts_at INTO current_start FROM public.team_tournament_rounds
    WHERE tournament_id = p_id AND round_no = p_round_no;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF current_start IS NULL OR clock_timestamp() >= current_start THEN
    RAISE EXCEPTION 'round_time_locked' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.team_tournament_rounds
    WHERE tournament_id = p_id AND (
      (round_no < p_round_no AND starts_at >= p_starts_at)
      OR (round_no > p_round_no AND starts_at <= p_starts_at)
    )
  ) THEN
    RAISE EXCEPTION 'round_time_order' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.team_tournament_rounds SET starts_at = p_starts_at
    WHERE tournament_id = p_id AND round_no = p_round_no;
  RETURN jsonb_build_object('round_no', p_round_no, 'starts_at', p_starts_at);
END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_m3_set_round_time(uuid,uuid,smallint,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_m3_set_round_time(uuid,uuid,smallint,timestamptz)
  TO service_role;
