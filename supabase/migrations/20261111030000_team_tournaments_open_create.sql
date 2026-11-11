-- Open M3 creation (QA pilot, server flag TEAM_TOURNAMENTS_OPEN_CREATE, default off).
-- Lets any signed-in profile create an M3 event, limited to p_active_limit
-- unfinished events it organizes. Allowlisted organizers keep using the
-- unchanged team_tournament_m3_create; team_tournament_command is not modified.
CREATE FUNCTION public.team_tournament_m3_create_open(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_active_limit smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.team_tournaments%ROWTYPE;
  active_count integer;
BEGIN
  IF p_actor IS NULL OR p_active_limit IS NULL OR p_active_limit NOT BETWEEN 1 AND 10
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120
     OR p_starts_at IS NULL OR p_registration_deadline IS NULL
     OR p_registration_deadline <= clock_timestamp()
     OR p_registration_deadline >= p_starts_at
     OR p_min_teams IS NULL OR p_max_teams IS NULL
     OR p_min_teams < 2 OR p_max_teams > 16 OR p_min_teams > p_max_teams
     OR (p_rules->>'board_count')::integer NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  -- Serialize concurrent creations by one actor so the limit cannot be raced.
  PERFORM pg_advisory_xact_lock(hashtextextended('team_tournament_m3_create_open:' || p_actor::text, 0));
  SELECT count(*) INTO active_count
    FROM public.team_tournament_roles r
    JOIN public.team_tournaments t ON t.id = r.tournament_id
    WHERE r.user_id = p_actor AND r.role = 'organizer'
      AND t.status IN ('draft', 'registration', 'locked', 'published');
  IF active_count >= p_active_limit THEN
    RAISE EXCEPTION 'create_limit' USING ERRCODE = 'P0001';
  END IF;
  -- Same rows as the M1 'create' action, without the organizer allowlist check.
  INSERT INTO public.team_tournaments(name) VALUES (btrim(p_name)) RETURNING * INTO event;
  INSERT INTO public.team_tournament_rulesets(tournament_id, board_count, home_white_board_one,
    win_points, draw_points, loss_points, forfeit_win_units, forfeit_loss_units)
  SELECT event.id, r.board_count, r.home_white_board_one, r.win_points, r.draw_points, r.loss_points,
    r.forfeit_win_units, r.forfeit_loss_units
  FROM jsonb_populate_record(NULL::public.team_tournament_rulesets, p_rules) r;
  INSERT INTO public.team_tournament_roles(tournament_id, user_id, role) VALUES (event.id, p_actor, 'organizer');
  INSERT INTO public.team_tournament_m3_config
    (tournament_id, starts_at, registration_deadline, min_teams, max_teams)
    VALUES (event.id, p_starts_at, p_registration_deadline, p_min_teams, p_max_teams);
  PERFORM public.team_tournament_command(p_actor, 'register', event.id, '{}'::jsonb);
  RETURN jsonb_build_object('id', event.id, 'status', 'registration');
END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_m3_create_open(
  uuid, text, jsonb, timestamptz, timestamptz, smallint, smallint, smallint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_m3_create_open(
  uuid, text, jsonb, timestamptz, timestamptz, smallint, smallint, smallint) TO service_role;
