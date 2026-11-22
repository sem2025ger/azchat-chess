-- Online boards are additive. Previously created events retain the reported workflow.
ALTER TABLE public.team_tournament_m3_config
  ADD COLUMN play_mode text NOT NULL DEFAULT 'reported' CHECK (play_mode IN ('reported','online')),
  ADD COLUMN time_control text CHECK (time_control IN ('1+0','3+0','3+2','5+0','10+0','15+10')),
  ADD COLUMN no_show_minutes smallint NOT NULL DEFAULT 5 CHECK (no_show_minutes BETWEEN 1 AND 30),
  ADD CHECK (play_mode <> 'online' OR (round_interval_minutes IS NOT NULL AND time_control IS NOT NULL));

ALTER TABLE public.team_tournament_board_results
  DROP CONSTRAINT team_tournament_board_results_source_check,
  ADD CHECK (source IN ('player_report','captain','organizer_decision','arbiter','online_game','no_show'));

ALTER TABLE public.team_tournament_m3_action_audit
  ALTER COLUMN actor_id DROP NOT NULL,
  DROP CONSTRAINT team_tournament_m3_action_audit_actor_role_check,
  DROP CONSTRAINT team_tournament_m3_action_audit_action_check,
  ADD CHECK ((actor_id IS NULL AND actor_role = 'system' AND action IN ('online_game','no_show'))
    OR (actor_id IS NOT NULL AND actor_role IN ('player','captain','organizer','arbiter')
      AND action IN ('report','confirm','reject','forfeit','decide','correct')));

CREATE TABLE public.team_tournament_m3_online_boards (
  match_id uuid NOT NULL,
  board_no smallint NOT NULL,
  tournament_id uuid NOT NULL,
  round_no smallint NOT NULL,
  white_id uuid NOT NULL REFERENCES public.profiles(id),
  black_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','starting','live','finished','forfeit')),
  white_ready_at timestamptz,
  black_ready_at timestamptz,
  room_id uuid UNIQUE,
  -- Preserve the first issued room UUID across failed/ambiguous starts. The
  -- existing durable room primary key then fences even a late start request.
  reserved_room_id uuid UNIQUE,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  result text CHECK (result IN ('1-0','0-1','1/2-1/2','+/-','-/+','-/-')),
  PRIMARY KEY (match_id, board_no),
  FOREIGN KEY (match_id, board_no) REFERENCES public.team_tournament_board_results(match_id, board_no),
  FOREIGN KEY (tournament_id, match_id) REFERENCES public.team_tournament_matches(tournament_id,id),
  FOREIGN KEY (tournament_id, round_no) REFERENCES public.team_tournament_rounds(tournament_id,round_no),
  CHECK (white_id <> black_id),
  CHECK ((status IN ('starting','live','finished')) = (room_id IS NOT NULL)),
  CHECK (room_id IS NULL OR room_id IS NOT DISTINCT FROM reserved_room_id),
  CHECK ((status IN ('finished','forfeit')) = (finished_at IS NOT NULL AND result IS NOT NULL))
);

CREATE INDEX team_tournament_online_white_round
  ON public.team_tournament_m3_online_boards(tournament_id, white_id, round_no DESC);
CREATE INDEX team_tournament_online_black_round
  ON public.team_tournament_m3_online_boards(tournament_id, black_id, round_no DESC);
CREATE INDEX team_tournament_online_work
  ON public.team_tournament_m3_online_boards(status, tournament_id, round_no)
  WHERE status IN ('scheduled','starting','live');

ALTER TABLE public.team_tournament_m3_online_boards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_tournament_m3_online_boards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.team_tournament_m3_online_boards TO authenticated;
GRANT SELECT (id,username) ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.team_tournament_m3_online_boards TO service_role;
CREATE POLICY m3_online_board_participant ON public.team_tournament_m3_online_boards
  FOR SELECT TO authenticated USING ((SELECT private.team_tournament_m3_board_reader(match_id,board_no)));

CREATE FUNCTION private.team_tournament_m3_create_with_request(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_round_interval_minutes integer, p_client_request_id uuid, p_active_limit smallint,
  p_play_mode text, p_time_control text, p_no_show_minutes smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  payload jsonb;
  request_hash bytea;
  existing private.team_tournament_m3_create_requests%ROWTYPE;
  created jsonb;
  event_id uuid;
BEGIN
  IF p_actor IS NULL OR p_round_interval_minutes NOT BETWEEN 10 AND 10080
     OR (p_play_mode IS NOT NULL AND (p_play_mode <> 'online' OR p_round_interval_minutes IS NULL
       OR p_time_control IS NULL OR p_time_control NOT IN ('1+0','3+0','3+2','5+0','10+0','15+10')
       OR p_no_show_minutes IS NULL OR p_no_show_minutes NOT BETWEEN 1 AND 30)) THEN
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
    payload := jsonb_build_array(
      btrim(p_name), p_rules, extract(epoch FROM p_starts_at),
      extract(epoch FROM p_registration_deadline), p_min_teams, p_max_teams, p_round_interval_minutes
    );
    IF p_play_mode IS NOT NULL THEN
      payload := payload || jsonb_build_array(p_play_mode, p_time_control, p_no_show_minutes);
    END IF;
    request_hash := sha256(convert_to(payload::text, 'UTF8'));
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
    UPDATE public.team_tournament_m3_config SET round_interval_minutes = p_round_interval_minutes,
      play_mode = coalesce(p_play_mode, 'reported'), time_control = p_time_control,
      no_show_minutes = coalesce(p_no_show_minutes, 5)
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


-- Keep legacy arities and byte-identical hashes for reported create requests.
CREATE OR REPLACE FUNCTION private.team_tournament_m3_create_with_request(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_round_interval_minutes integer, p_client_request_id uuid, p_active_limit smallint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.team_tournament_m3_create_with_request(p_actor,p_name,p_rules,p_starts_at,
    p_registration_deadline,p_min_teams,p_max_teams,p_round_interval_minutes,p_client_request_id,
    p_active_limit,NULL::text,NULL::text,NULL::smallint);
$$;

CREATE FUNCTION public.team_tournament_m3_create(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_round_interval_minutes integer, p_client_request_id uuid,
  p_play_mode text, p_time_control text, p_no_show_minutes smallint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.team_tournament_m3_create_with_request(p_actor,p_name,p_rules,p_starts_at,
    p_registration_deadline,p_min_teams,p_max_teams,p_round_interval_minutes,p_client_request_id,
    NULL::smallint,p_play_mode,p_time_control,p_no_show_minutes);
$$;

CREATE FUNCTION public.team_tournament_m3_create_open(
  p_actor uuid, p_name text, p_rules jsonb, p_starts_at timestamptz,
  p_registration_deadline timestamptz, p_min_teams smallint, p_max_teams smallint,
  p_active_limit smallint, p_round_interval_minutes integer, p_client_request_id uuid,
  p_play_mode text, p_time_control text, p_no_show_minutes smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_active_limit IS NULL OR p_active_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN private.team_tournament_m3_create_with_request(p_actor,p_name,p_rules,p_starts_at,
    p_registration_deadline,p_min_teams,p_max_teams,p_round_interval_minutes,p_client_request_id,
    p_active_limit,p_play_mode,p_time_control,p_no_show_minutes);
END;
$$;

REVOKE ALL ON FUNCTION
  private.team_tournament_m3_create_with_request(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid,smallint,text,text,smallint),
  public.team_tournament_m3_create(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid,text,text,smallint),
  public.team_tournament_m3_create_open(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,smallint,integer,uuid,text,text,smallint)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  private.team_tournament_m3_create_with_request(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid,smallint,text,text,smallint),
  public.team_tournament_m3_create(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,integer,uuid,text,text,smallint),
  public.team_tournament_m3_create_open(uuid,text,jsonb,timestamptz,timestamptz,smallint,smallint,smallint,integer,uuid,text,text,smallint)
  TO service_role;

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
  IF config.play_mode = 'online' THEN
    INSERT INTO public.team_tournament_m3_online_boards
      (match_id,board_no,tournament_id,round_no,white_id,black_id)
      SELECT m.id,b.board_no,m.tournament_id,m.round_no,
        CASE WHEN b.home_white THEN home.player_id ELSE away.player_id END,
        CASE WHEN b.home_white THEN away.player_id ELSE home.player_id END
      FROM public.team_tournament_matches m
      JOIN public.team_tournament_board_results b ON b.match_id = m.id
      LEFT JOIN public.team_tournament_m3_lineups home ON home.entry_id = m.home_team_id AND home.board_no = b.board_no
      LEFT JOIN public.team_tournament_m3_lineups away ON away.entry_id = m.away_team_id AND away.board_no = b.board_no
      WHERE m.tournament_id = p_id;
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
    AND NOT EXISTS (SELECT 1 FROM public.team_tournament_m3_config c
      WHERE c.tournament_id = t.id AND c.play_mode = 'online')
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


ALTER FUNCTION public.team_tournament_m3_result(uuid,text,uuid,jsonb)
  RENAME TO team_tournament_m3_reported_result;
ALTER FUNCTION public.team_tournament_m3_reported_result(uuid,text,uuid,jsonb) SET SCHEMA private;

CREATE FUNCTION public.team_tournament_m3_result(p_actor uuid,p_action text,p_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_action IN ('report','confirm','reject','forfeit') AND EXISTS (
    SELECT 1 FROM public.team_tournament_m3_config WHERE tournament_id = p_id AND play_mode = 'online'
  ) THEN
    RAISE EXCEPTION 'online_mode' USING ERRCODE = 'P0001';
  END IF;
  RETURN private.team_tournament_m3_reported_result(p_actor,p_action,p_id,p_input);
END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_m3_result(uuid,text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_m3_result(uuid,text,uuid,jsonb) TO service_role;

-- Match publication, edits to starts_at and official-result changes serialize
-- on the event row. Take that lock before touching an online board or a result.
CREATE FUNCTION private.team_tournament_online_lock(p_match uuid, p_board smallint)
RETURNS public.team_tournament_m3_online_boards
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  board public.team_tournament_m3_online_boards%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.team_tournaments t
    JOIN public.team_tournament_matches m ON m.tournament_id = t.id
    WHERE m.id = p_match FOR UPDATE OF t;
  SELECT * INTO board FROM public.team_tournament_m3_online_boards
    WHERE match_id = p_match AND board_no = p_board FOR UPDATE;
  RETURN board;
END;
$$;

-- Resolve the previous playing round separately for each player, including
-- byes and rounds that overlap while an earlier game is still being played.
CREATE FUNCTION private.team_tournament_online_deadline(p_match uuid, p_board smallint)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN previous_white.playing OR previous_black.playing THEN NULL
    ELSE greatest(r.starts_at, previous_white.finished_at, previous_black.finished_at)
      + make_interval(mins => c.no_show_minutes) END
  FROM public.team_tournament_m3_online_boards b
  JOIN public.team_tournament_rounds r USING (tournament_id,round_no)
  JOIN public.team_tournament_m3_config c USING (tournament_id)
  LEFT JOIN LATERAL (
    SELECT bool_or(prev.status IN ('starting','live')) AS playing,max(prev.finished_at) AS finished_at
    FROM public.team_tournament_m3_online_boards prev
    WHERE prev.tournament_id = b.tournament_id AND prev.round_no < b.round_no
      AND b.white_id IN (prev.white_id,prev.black_id)
  ) previous_white ON true
  LEFT JOIN LATERAL (
    SELECT bool_or(prev.status IN ('starting','live')) AS playing,max(prev.finished_at) AS finished_at
    FROM public.team_tournament_m3_online_boards prev
    WHERE prev.tournament_id = b.tournament_id AND prev.round_no < b.round_no
      AND b.black_id IN (prev.white_id,prev.black_id)
  ) previous_black ON true
  WHERE b.match_id = p_match AND b.board_no = p_board;
$$;

CREATE FUNCTION public.team_tournament_online_ready(p_actor uuid,p_match uuid,p_board smallint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  board public.team_tournament_m3_online_boards%ROWTYPE;
  ready_at timestamptz;
  starts timestamptz;
  deadline timestamptz;
BEGIN
  board := private.team_tournament_online_lock(p_match,p_board);
  IF p_actor IS NULL OR board.match_id IS NULL OR p_actor NOT IN (board.white_id,board.black_id) THEN
    RETURN jsonb_build_object('code','not_allowed');
  END IF;
  IF board.status <> 'scheduled' THEN RETURN to_jsonb(board); END IF;
  SELECT starts_at INTO starts FROM public.team_tournament_rounds
    WHERE tournament_id = board.tournament_id AND round_no = board.round_no;
  ready_at := clock_timestamp();
  IF ready_at < starts THEN RETURN jsonb_build_object('code','round_not_started'); END IF;
  deadline := private.team_tournament_online_deadline(p_match,p_board);
  IF ready_at >= deadline AND
    ((p_actor = board.white_id AND board.white_ready_at IS NULL)
     OR (p_actor = board.black_id AND board.black_ready_at IS NULL)) THEN
    RETURN jsonb_build_object('code','ready_closed');
  END IF;
  UPDATE public.team_tournament_m3_online_boards SET
    white_ready_at = CASE WHEN p_actor = white_id THEN coalesce(white_ready_at, ready_at) ELSE white_ready_at END,
    black_ready_at = CASE WHEN p_actor = black_id THEN coalesce(black_ready_at, ready_at) ELSE black_ready_at END
    WHERE match_id = p_match AND board_no = p_board RETURNING * INTO board;
  RETURN to_jsonb(board);
END;
$$;

CREATE FUNCTION public.team_tournament_online_claim_start(p_match uuid,p_board smallint,p_room_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  board public.team_tournament_m3_online_boards%ROWTYPE;
  control text;
BEGIN
  -- Serialize the participant check across different tournaments as well.
  PERFORM pg_advisory_xact_lock(hashtextextended('team_tournament_online_claim',0));
  board := private.team_tournament_online_lock(p_match,p_board);
  IF p_room_id IS NULL OR board.status IS DISTINCT FROM 'scheduled'
    OR board.white_ready_at IS NULL OR board.black_ready_at IS NULL
    OR private.team_tournament_online_deadline(p_match,p_board) IS NULL
    OR EXISTS (SELECT 1 FROM public.team_tournament_m3_online_boards other
      WHERE other.status IN ('starting','live')
        AND ARRAY[other.white_id,other.black_id] && ARRAY[board.white_id,board.black_id])
    OR EXISTS (SELECT 1 FROM public.durable_games game
      WHERE NOT game.result_saved AND game.state->>'status' = 'active'
        AND game.room_id IS DISTINCT FROM board.reserved_room_id
        AND ARRAY[(game.state->'userIds'->>'w')::uuid,(game.state->'userIds'->>'b')::uuid]
          && ARRAY[board.white_id,board.black_id]) THEN
    RETURN jsonb_build_object('code','not_ready');
  END IF;
  SELECT time_control INTO control FROM public.team_tournament_m3_config WHERE tournament_id = board.tournament_id;
  UPDATE public.team_tournament_m3_online_boards SET status = 'starting',
    room_id = coalesce(reserved_room_id,p_room_id), reserved_room_id = coalesce(reserved_room_id,p_room_id),
    claimed_at = clock_timestamp()
    WHERE match_id = p_match AND board_no = p_board RETURNING * INTO board;
  RETURN to_jsonb(board) || jsonb_build_object('time_control',control);
END;
$$;

-- Reconciliation uses existing durable storage as proof. If the durable start
-- committed but its acknowledgement was lost, promote it instead of releasing it.
CREATE FUNCTION private.team_tournament_online_transition_room(p_room_id uuid,p_release boolean,p_claimed_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  board public.team_tournament_m3_online_boards%ROWTYPE;
  game_started timestamptz;
BEGIN
  SELECT * INTO board FROM public.team_tournament_m3_online_boards WHERE room_id = p_room_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  board := private.team_tournament_online_lock(board.match_id,board.board_no);
  IF board.room_id IS DISTINCT FROM p_room_id OR board.status <> 'starting' THEN
    RETURN to_jsonb(board);
  END IF;
  SELECT (d.state->>'startedAt')::timestamptz INTO game_started
    FROM public.durable_games d WHERE d.room_id = p_room_id
      AND (d.state->'userIds'->>'w')::uuid = board.white_id
      AND (d.state->'userIds'->>'b')::uuid = board.black_id;
  IF game_started IS NULL THEN
    SELECT g.created_at INTO game_started FROM public.matches g
    WHERE g.source_room_id = p_room_id::text AND g.status = 'completed'
      AND g.white_id = board.white_id AND g.black_id = board.black_id;
  END IF;
  IF game_started IS NOT NULL THEN
    UPDATE public.team_tournament_m3_online_boards SET status = 'live', started_at = game_started
      WHERE room_id = p_room_id RETURNING * INTO board;
  ELSIF p_release AND (p_claimed_at IS NULL OR p_claimed_at = board.claimed_at) THEN
    UPDATE public.team_tournament_m3_online_boards SET status = 'scheduled', room_id = NULL, claimed_at = NULL
      WHERE room_id = p_room_id RETURNING * INTO board;
  END IF;
  RETURN to_jsonb(board);
END;
$$;

CREATE FUNCTION public.team_tournament_online_mark_live(p_room_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.team_tournament_online_transition_room(p_room_id,false,NULL);
$$;

CREATE FUNCTION public.team_tournament_online_release_start(p_room_id uuid,p_claimed_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.team_tournament_online_transition_room(p_room_id,true,p_claimed_at);
$$;

CREATE FUNCTION private.team_tournament_online_confirm(
  p_match uuid,p_board smallint,p_result text,p_source text,p_match_row_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  official public.team_tournament_board_results%ROWTYPE;
BEGIN
  SELECT * INTO STRICT official FROM public.team_tournament_board_results
    WHERE match_id = p_match AND board_no = p_board FOR UPDATE;
  -- Official board rows store white/black results. Their home_white flag
  -- maps them to home/away in the unchanged standings engine.
  -- A deliberate staff ruling remains authoritative if it was recorded first.
  IF NOT official.confirmed THEN
    UPDATE public.team_tournament_board_results SET result = p_result, confirmed = true,
      source = p_source, revision = official.revision + 1 WHERE match_id = p_match AND board_no = p_board;
    INSERT INTO public.team_tournament_m3_board_states(match_id,board_no,status)
      VALUES (p_match,p_board,'confirmed')
      ON CONFLICT (match_id,board_no) DO UPDATE SET status = excluded.status;
  END IF;
  INSERT INTO public.team_tournament_m3_action_audit
    (tournament_id,match_id,board_no,actor_id,actor_role,action,old_value,new_value)
    VALUES (official.tournament_id,p_match,p_board,NULL,'system',p_source,
      jsonb_build_object('board_result',official.result,'confirmed',official.confirmed,'source',official.source),
      jsonb_build_object('board_result',CASE WHEN official.confirmed THEN official.result ELSE p_result END,
        'confirmed',true,'source',CASE WHEN official.confirmed THEN official.source ELSE p_source END,
        'observed_result',p_result,'match_row_id',p_match_row_id));
END;
$$;

CREATE FUNCTION public.team_tournament_online_record_result(p_room_id uuid,p_result text,p_match_row_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  board public.team_tournament_m3_online_boards%ROWTYPE;
  ended timestamptz;
BEGIN
  SELECT * INTO board FROM public.team_tournament_m3_online_boards WHERE room_id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  board := private.team_tournament_online_lock(board.match_id,board.board_no);
  IF board.room_id IS DISTINCT FROM p_room_id THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
  IF board.status = 'finished' THEN
    IF board.result IS DISTINCT FROM p_result THEN
      RAISE EXCEPTION 'online_result_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN to_jsonb(board);
  END IF;
  IF board.status <> 'live' OR p_result IS NULL OR p_result NOT IN ('1-0','0-1','1/2-1/2') THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000';
  END IF;
  SELECT g.completed_at INTO ended FROM public.matches g WHERE g.id = p_match_row_id
    AND g.source_room_id = p_room_id::text AND g.status = 'completed'
    AND g.white_id = board.white_id AND g.black_id = board.black_id AND g.result = p_result;
  IF ended IS NULL THEN RAISE EXCEPTION 'online_result_conflict' USING ERRCODE = 'P0001'; END IF;
  PERFORM private.team_tournament_online_confirm(board.match_id,board.board_no,p_result,'online_game',p_match_row_id);
  UPDATE public.team_tournament_m3_online_boards SET status = 'finished', result = p_result, finished_at = ended
    WHERE room_id = p_room_id RETURNING * INTO board;
  RETURN to_jsonb(board);
END;
$$;

CREATE FUNCTION public.team_tournament_online_forfeit_due(p_now timestamptz)
RETURNS SETOF public.team_tournament_m3_online_boards
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event_id uuid;
  board public.team_tournament_m3_online_boards%ROWTYPE;
  deadline timestamptz;
  outcome text;
BEGIN
  -- Clamp the supplied clock to PostgreSQL's time. Scope each batch to due rounds.
  p_now := least(p_now,clock_timestamp());
  FOR event_id IN SELECT t.id FROM public.team_tournaments t
    WHERE t.status = 'published' AND EXISTS (
      SELECT 1 FROM public.team_tournament_m3_online_boards b
      JOIN public.team_tournament_rounds r USING(tournament_id,round_no)
      WHERE b.tournament_id = t.id AND r.starts_at <= p_now AND b.status = 'scheduled'
        AND (b.white_ready_at IS NULL OR b.black_ready_at IS NULL)
        AND private.team_tournament_online_deadline(b.match_id,b.board_no) <= p_now)
    ORDER BY t.id LIMIT 32 FOR UPDATE SKIP LOCKED
  LOOP
    FOR board IN SELECT b.* FROM public.team_tournament_m3_online_boards b
      JOIN public.team_tournament_rounds r USING(tournament_id,round_no)
      WHERE b.tournament_id = event_id AND r.starts_at <= p_now AND b.status = 'scheduled'
        AND (b.white_ready_at IS NULL OR b.black_ready_at IS NULL)
      ORDER BY b.round_no,b.match_id,b.board_no FOR UPDATE OF b
    LOOP
      deadline := private.team_tournament_online_deadline(board.match_id,board.board_no);
      IF deadline IS NULL OR p_now < deadline THEN CONTINUE; END IF;
      outcome := CASE WHEN board.white_ready_at IS NOT NULL THEN '+/-'
        WHEN board.black_ready_at IS NOT NULL THEN '-/+' ELSE '-/-' END;
      PERFORM private.team_tournament_online_confirm(board.match_id,board.board_no,outcome,'no_show');
      UPDATE public.team_tournament_m3_online_boards b SET status = 'forfeit', result = outcome, finished_at = deadline
        WHERE b.match_id = board.match_id AND b.board_no = board.board_no RETURNING * INTO board;
      RETURN NEXT board;
    END LOOP;
  END LOOP;
END;
$$;

-- Player read model includes the official match rows for the existing standings
-- engine. It returns one current board and the latest final board, never opponent history.
CREATE FUNCTION public.team_tournament_online_my_board(p_actor uuid,p_tournament uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH candidates AS MATERIALIZED (
    SELECT b.*,r.starts_at,t.name,c.time_control,m.home_team_id,m.away_team_id,
      CASE WHEN b.white_id = p_actor THEN 'white' ELSE 'black' END AS side,
      opponent.username AS opponent
    FROM public.team_tournament_m3_online_boards b
    JOIN public.team_tournaments t ON t.id = b.tournament_id
    JOIN public.team_tournament_m3_config c USING (tournament_id)
    JOIN public.team_tournament_rounds r USING (tournament_id,round_no)
    JOIN public.team_tournament_matches m ON m.id = b.match_id
    JOIN public.profiles opponent ON opponent.id = CASE WHEN b.white_id = p_actor THEN b.black_id ELSE b.white_id END
    WHERE p_actor IN (b.white_id,b.black_id) AND (p_tournament IS NULL OR b.tournament_id = p_tournament)
  ), picked AS (
    (SELECT * FROM candidates WHERE status NOT IN ('finished','forfeit')
      ORDER BY (status = 'live') DESC,starts_at,tournament_id,round_no LIMIT 1)
    UNION ALL
    (SELECT * FROM candidates WHERE status IN ('finished','forfeit')
      ORDER BY finished_at DESC,tournament_id,round_no DESC LIMIT 1)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'tournament_id',b.tournament_id,'tournament_name',b.name,'match_id',b.match_id,
    'round_no',b.round_no,'board_no',b.board_no,'starts_at',b.starts_at,'side',b.side,'opponent',b.opponent,
    'status',b.status,'room_id',CASE WHEN b.status = 'live' THEN b.room_id END,
    'ready',CASE WHEN b.side = 'white' THEN b.white_ready_at IS NOT NULL ELSE b.black_ready_at IS NOT NULL END,
    'deadline',deadline.value,'time_control',b.time_control,'result',official.result,
    'home_team_id',b.home_team_id,'away_team_id',b.away_team_id,'rules',to_jsonb(rules),
    'boards',(SELECT jsonb_agg(to_jsonb(score) ORDER BY score.board_no)
      FROM public.team_tournament_board_results score WHERE score.match_id = b.match_id)
  ) ORDER BY (b.status IN ('finished','forfeit')),b.starts_at),'[]'::jsonb)
  FROM picked b
  JOIN public.team_tournament_board_results official USING (match_id,board_no)
  JOIN public.team_tournament_rulesets rules ON rules.tournament_id = b.tournament_id
  CROSS JOIN LATERAL (SELECT private.team_tournament_online_deadline(b.match_id,b.board_no) AS value) deadline;
$$;

REVOKE ALL ON FUNCTION
  private.team_tournament_online_lock(uuid,smallint),
  private.team_tournament_online_deadline(uuid,smallint),
  private.team_tournament_online_transition_room(uuid,boolean,timestamptz),
  private.team_tournament_online_confirm(uuid,smallint,text,text,uuid),
  public.team_tournament_online_ready(uuid,uuid,smallint),
  public.team_tournament_online_claim_start(uuid,smallint,uuid),
  public.team_tournament_online_mark_live(uuid),
  public.team_tournament_online_release_start(uuid,timestamptz),
  public.team_tournament_online_record_result(uuid,text,uuid),
  public.team_tournament_online_forfeit_due(timestamptz),
  public.team_tournament_online_my_board(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  private.team_tournament_online_lock(uuid,smallint),
  private.team_tournament_online_deadline(uuid,smallint),
  private.team_tournament_online_transition_room(uuid,boolean,timestamptz),
  private.team_tournament_online_confirm(uuid,smallint,text,text,uuid),
  public.team_tournament_online_ready(uuid,uuid,smallint),
  public.team_tournament_online_claim_start(uuid,smallint,uuid),
  public.team_tournament_online_mark_live(uuid),
  public.team_tournament_online_release_start(uuid,timestamptz),
  public.team_tournament_online_record_result(uuid,text,uuid),
  public.team_tournament_online_forfeit_due(timestamptz),
  public.team_tournament_online_my_board(uuid,uuid)
  TO service_role;
