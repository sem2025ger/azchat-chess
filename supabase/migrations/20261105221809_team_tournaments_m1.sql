-- Team tournament M1. Independent of the private Spieltag workspace.
CREATE TABLE public.team_tournament_organizers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.team_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','registration','locked','published','finished')),
  published_at timestamptz
);
CREATE TABLE public.team_tournament_rulesets (
  tournament_id uuid PRIMARY KEY REFERENCES public.team_tournaments(id),
  version smallint NOT NULL DEFAULT 1 CHECK (version = 1),
  board_count smallint NOT NULL CHECK (board_count BETWEEN 1 AND 16),
  home_white_board_one boolean NOT NULL,
  win_points smallint NOT NULL,
  draw_points smallint NOT NULL,
  loss_points smallint NOT NULL,
  forfeit_win_units smallint NOT NULL,
  forfeit_loss_units smallint NOT NULL,
  CHECK (0 <= loss_points AND loss_points < draw_points AND draw_points < win_points AND win_points <= 10),
  CHECK (0 <= forfeit_loss_units AND forfeit_loss_units < forfeit_win_units AND forfeit_win_units + forfeit_loss_units <= 2)
);
CREATE TABLE public.team_tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.team_tournaments(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  seed smallint NOT NULL CHECK (seed BETWEEN 1 AND 16),
  UNIQUE (tournament_id, id),
  UNIQUE (tournament_id, seed)
);
CREATE UNIQUE INDEX team_tournament_team_names ON public.team_tournament_teams (tournament_id, lower(name));

CREATE TABLE public.team_tournament_roles (
  tournament_id uuid NOT NULL REFERENCES public.team_tournaments(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('organizer','arbiter','captain')),
  team_id uuid,
  PRIMARY KEY (tournament_id, user_id, role),
  FOREIGN KEY (tournament_id, team_id) REFERENCES public.team_tournament_teams(tournament_id, id),
  CHECK ((role = 'captain') = (team_id IS NOT NULL))
);
CREATE TABLE public.team_tournament_rounds (
  tournament_id uuid NOT NULL REFERENCES public.team_tournaments(id),
  round_no smallint NOT NULL CHECK (round_no BETWEEN 1 AND 15),
  bye_team_id uuid,
  PRIMARY KEY (tournament_id, round_no),
  FOREIGN KEY (tournament_id, bye_team_id) REFERENCES public.team_tournament_teams(tournament_id, id)
);
CREATE TABLE public.team_tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  round_no smallint NOT NULL,
  home_team_id uuid NOT NULL,
  away_team_id uuid NOT NULL,
  FOREIGN KEY (tournament_id, round_no) REFERENCES public.team_tournament_rounds(tournament_id, round_no),
  FOREIGN KEY (tournament_id, home_team_id) REFERENCES public.team_tournament_teams(tournament_id, id),
  FOREIGN KEY (tournament_id, away_team_id) REFERENCES public.team_tournament_teams(tournament_id, id),
  CHECK (home_team_id <> away_team_id),
  UNIQUE (tournament_id, id),
  UNIQUE (tournament_id, round_no, home_team_id),
  UNIQUE (tournament_id, round_no, away_team_id)
);
CREATE UNIQUE INDEX team_tournament_pair_once ON public.team_tournament_matches
  (tournament_id, least(home_team_id, away_team_id), greatest(home_team_id, away_team_id));

CREATE TABLE public.team_tournament_board_results (
  tournament_id uuid NOT NULL,
  match_id uuid NOT NULL,
  board_no smallint NOT NULL CHECK (board_no BETWEEN 1 AND 16),
  home_white boolean NOT NULL,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('1-0','0-1','1/2-1/2','+/-','-/+','-/-','pending')),
  confirmed boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  PRIMARY KEY (match_id, board_no),
  FOREIGN KEY (tournament_id, match_id) REFERENCES public.team_tournament_matches(tournament_id, id),
  CHECK (result <> 'pending' OR NOT confirmed)
);
CREATE INDEX team_tournament_boards_by_event ON public.team_tournament_board_results(tournament_id, match_id);
CREATE TABLE public.team_tournament_result_audit (
  tournament_id uuid NOT NULL,
  match_id uuid NOT NULL,
  board_no smallint NOT NULL,
  revision integer NOT NULL,
  actor_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  action text NOT NULL CHECK (action IN ('record','confirm','correct')),
  old_result text NOT NULL,
  new_result text NOT NULL,
  old_confirmed boolean NOT NULL,
  new_confirmed boolean NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  PRIMARY KEY (match_id, board_no, revision),
  FOREIGN KEY (match_id, board_no) REFERENCES public.team_tournament_board_results(match_id, board_no),
  FOREIGN KEY (tournament_id, match_id) REFERENCES public.team_tournament_matches(tournament_id, id)
);
CREATE INDEX team_tournament_audit_by_event ON public.team_tournament_result_audit(tournament_id);

ALTER TABLE public.team_tournament_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_board_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tournament_result_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.team_tournament_organizers, public.team_tournaments, public.team_tournament_rulesets,
  public.team_tournament_teams, public.team_tournament_roles, public.team_tournament_rounds,
  public.team_tournament_matches, public.team_tournament_board_results, public.team_tournament_result_audit
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.team_tournaments, public.team_tournament_rulesets, public.team_tournament_teams,
  public.team_tournament_rounds, public.team_tournament_matches, public.team_tournament_board_results TO anon, authenticated;
-- Anonymous SELECT on roles is required by policy subqueries, but RLS admits no rows.
GRANT SELECT ON public.team_tournament_roles TO anon, authenticated;
GRANT SELECT ON public.team_tournament_result_audit TO authenticated;
GRANT SELECT ON public.team_tournament_organizers TO service_role;
GRANT SELECT, INSERT ON public.team_tournaments, public.team_tournament_rulesets, public.team_tournament_teams,
  public.team_tournament_roles, public.team_tournament_rounds, public.team_tournament_matches,
  public.team_tournament_board_results, public.team_tournament_result_audit TO service_role;
GRANT UPDATE (status, published_at) ON public.team_tournaments TO service_role;
GRANT UPDATE (result, confirmed, revision) ON public.team_tournament_board_results TO service_role;

CREATE POLICY own_tournament_roles ON public.team_tournament_roles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY published_or_assigned ON public.team_tournaments FOR SELECT TO anon, authenticated
  USING (status IN ('published','finished') OR EXISTS (
    SELECT 1 FROM public.team_tournament_roles r WHERE r.tournament_id = team_tournaments.id
      AND r.user_id = (SELECT auth.uid())));
CREATE POLICY visible_ruleset ON public.team_tournament_rulesets FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournaments t WHERE t.id = tournament_id));
CREATE POLICY visible_team ON public.team_tournament_teams FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournaments t
    WHERE t.id = tournament_id AND t.status IN ('published','finished')) OR EXISTS (
    SELECT 1 FROM public.team_tournament_roles r WHERE r.tournament_id = team_tournament_teams.tournament_id
      AND r.user_id = (SELECT auth.uid())
      AND (r.role IN ('organizer','arbiter') OR r.team_id = team_tournament_teams.id)));
CREATE POLICY published_rounds ON public.team_tournament_rounds FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournaments t
    WHERE t.id = tournament_id AND t.status IN ('published','finished')));
CREATE POLICY published_matches ON public.team_tournament_matches FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournaments t
    WHERE t.id = tournament_id AND t.status IN ('published','finished')));
CREATE POLICY published_board_results ON public.team_tournament_board_results FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournaments t
    WHERE t.id = tournament_id AND t.status IN ('published','finished')));
CREATE POLICY staff_result_audit ON public.team_tournament_result_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_tournament_roles r
    WHERE r.tournament_id = team_tournament_result_audit.tournament_id
      AND r.user_id = (SELECT auth.uid())
      AND r.role IN ('organizer','arbiter')));

-- The invoking anon/user JWT keeps RLS authoritative for every table read.
CREATE FUNCTION public.team_tournament_snapshot(p_id uuid, p_workspace boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'published_at', t.published_at,
    'rules', to_jsonb(rules) - 'tournament_id',
    'roles', CASE WHEN p_workspace THEN roles.items ELSE '[]'::jsonb END,
    'teams', coalesce((SELECT jsonb_agg(to_jsonb(e) - 'tournament_id' ORDER BY e.seed)
      FROM public.team_tournament_teams e WHERE e.tournament_id = t.id), '[]'::jsonb),
    'rounds', coalesce((SELECT jsonb_agg(to_jsonb(r) - 'tournament_id' ORDER BY r.round_no)
      FROM public.team_tournament_rounds r WHERE r.tournament_id = t.id), '[]'::jsonb),
    'matches', coalesce((SELECT jsonb_agg(
        (to_jsonb(m) - 'tournament_id') || jsonb_build_object('boards', (
          SELECT jsonb_agg(to_jsonb(b) - 'tournament_id' - 'match_id' ORDER BY b.board_no)
          FROM public.team_tournament_board_results b WHERE b.match_id = m.id))
        ORDER BY m.round_no, m.id)
      FROM public.team_tournament_matches m WHERE m.tournament_id = t.id), '[]'::jsonb))
  FROM public.team_tournaments t JOIN public.team_tournament_rulesets rules ON rules.tournament_id = t.id
  CROSS JOIN LATERAL (
    SELECT coalesce(jsonb_agg(a.role ORDER BY a.role), '[]'::jsonb) AS items
    FROM public.team_tournament_roles a WHERE a.tournament_id = t.id
  ) roles
  WHERE t.id = p_id AND CASE WHEN p_workspace THEN roles.items <> '[]'::jsonb
    ELSE t.status IN ('published','finished') END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_snapshot(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_snapshot(uuid, boolean) TO anon, authenticated;

-- Every command is a transaction. Only the trusted API can supply the verified actor.
CREATE FUNCTION public.team_tournament_command(p_actor uuid, p_action text, p_id uuid, p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.team_tournaments%ROWTYPE;
  rules public.team_tournament_rulesets%ROWTYPE;
  board public.team_tournament_board_results%ROWTYPE;
  team_id uuid;
  captain_id uuid;
  match_id uuid;
  team_count integer;
  round_no integer := 0;
  round_data jsonb;
  pairing jsonb;
  bye_id uuid;
  outcome text;
  reason text;
BEGIN
  IF p_action = 'create' THEN
    IF NOT EXISTS (SELECT 1 FROM public.team_tournament_organizers o WHERE o.user_id = p_actor) THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.team_tournaments(name) VALUES (p_input->>'name') RETURNING * INTO event;
    INSERT INTO public.team_tournament_rulesets(tournament_id, board_count, home_white_board_one,
      win_points, draw_points, loss_points, forfeit_win_units, forfeit_loss_units)
    SELECT event.id, r.board_count, r.home_white_board_one, r.win_points, r.draw_points, r.loss_points,
      r.forfeit_win_units, r.forfeit_loss_units
    FROM jsonb_populate_record(NULL::public.team_tournament_rulesets, p_input->'rules') r;
    INSERT INTO public.team_tournament_roles(tournament_id, user_id, role) VALUES (event.id, p_actor, 'organizer');
    RETURN jsonb_build_object('id', event.id, 'status', event.status);
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('register','approve_team','assign_arbiter','lock','publish','finish','record','confirm','correct') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_tournament_roles r WHERE r.tournament_id = p_id AND r.user_id = p_actor
      AND r.role = CASE WHEN p_action IN ('record','confirm','correct') THEN 'arbiter' ELSE 'organizer' END) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT event FROM public.team_tournaments t WHERE t.id = p_id FOR UPDATE;

  CASE p_action
    WHEN 'register' THEN
      IF event.status <> 'draft' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      UPDATE public.team_tournaments SET status = 'registration' WHERE id = p_id RETURNING * INTO event;
    WHEN 'approve_team' THEN
      IF event.status <> 'registration' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      SELECT count(*) INTO team_count FROM public.team_tournament_teams t WHERE t.tournament_id = p_id;
      IF team_count >= 16 THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      INSERT INTO public.team_tournament_teams(tournament_id, name, seed)
        VALUES (p_id, p_input->>'name', team_count + 1) RETURNING id INTO team_id;
      captain_id := (p_input->>'captain_id')::uuid;
      IF captain_id IS NOT NULL THEN
        INSERT INTO public.team_tournament_roles(tournament_id, user_id, role, team_id)
          VALUES (p_id, captain_id, 'captain', team_id);
      END IF;
      RETURN jsonb_build_object('team_id', team_id, 'seed', team_count + 1);
    WHEN 'assign_arbiter' THEN
      IF event.status = 'finished' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      INSERT INTO public.team_tournament_roles(tournament_id, user_id, role)
        VALUES (p_id, (p_input->>'user_id')::uuid, 'arbiter') ON CONFLICT DO NOTHING;
    WHEN 'lock' THEN
      SELECT count(*) INTO team_count FROM public.team_tournament_teams t WHERE t.tournament_id = p_id;
      IF event.status <> 'registration' OR team_count < 2 THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      UPDATE public.team_tournaments SET status = 'locked' WHERE id = p_id RETURNING * INTO event;
    WHEN 'publish' THEN
      IF event.status IN ('published','finished') THEN
        RETURN jsonb_build_object('id', p_id, 'status', 'published', 'published_at', event.published_at);
      END IF;
      IF event.status <> 'locked' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      SELECT * INTO STRICT rules FROM public.team_tournament_rulesets t WHERE t.tournament_id = p_id;
      SELECT count(*) INTO team_count FROM public.team_tournament_teams t WHERE t.tournament_id = p_id;
      IF jsonb_array_length(p_input->'rounds') IS DISTINCT FROM team_count - 1 + team_count % 2 THEN
        RAISE EXCEPTION 'invalid_schedule' USING ERRCODE = '22023';
      END IF;
      FOR round_data IN SELECT value FROM jsonb_array_elements(p_input->'rounds') LOOP
        round_no := round_no + 1;
        bye_id := (round_data->>'bye_team_id')::uuid;
        IF (round_data->>'round_no')::integer IS DISTINCT FROM round_no
            OR ((bye_id IS NOT NULL) IS DISTINCT FROM (team_count % 2 = 1))
            OR jsonb_array_length(round_data->'matches') IS DISTINCT FROM team_count / 2
            OR (SELECT count(DISTINCT participant)
                FROM (
                  SELECT (m->>'home_team_id')::uuid AS participant FROM jsonb_array_elements(round_data->'matches') m
                  UNION ALL
                  SELECT (m->>'away_team_id')::uuid FROM jsonb_array_elements(round_data->'matches') m
                  UNION ALL SELECT bye_id
                ) players) <> team_count THEN
          RAISE EXCEPTION 'invalid_schedule' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.team_tournament_rounds VALUES (p_id, round_no, bye_id);
        FOR pairing IN SELECT value FROM jsonb_array_elements(round_data->'matches') LOOP
          INSERT INTO public.team_tournament_matches(tournament_id, round_no, home_team_id, away_team_id)
            VALUES (p_id, round_no, (pairing->>'home_team_id')::uuid, (pairing->>'away_team_id')::uuid)
            RETURNING id INTO match_id;
          INSERT INTO public.team_tournament_board_results(tournament_id, match_id, board_no, home_white)
            SELECT p_id, match_id, n, (n % 2 = 1) = rules.home_white_board_one
            FROM generate_series(1, rules.board_count::integer) n;
        END LOOP;
      END LOOP;
      UPDATE public.team_tournaments SET status = 'published', published_at = clock_timestamp() WHERE id = p_id RETURNING * INTO event;
      RETURN jsonb_build_object('id', p_id, 'status', event.status, 'published_at', event.published_at);
    WHEN 'finish' THEN
      IF event.status <> 'published' OR EXISTS (SELECT 1 FROM public.team_tournament_board_results b
          WHERE b.tournament_id = p_id AND NOT b.confirmed) THEN
        RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000';
      END IF;
      UPDATE public.team_tournaments SET status = 'finished' WHERE id = p_id RETURNING * INTO event;
    ELSE
      IF event.status <> 'published' THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000'; END IF;
      SELECT * INTO STRICT board FROM public.team_tournament_board_results b
        WHERE b.tournament_id = p_id AND b.match_id = (p_input->>'match_id')::uuid
          AND b.board_no = (p_input->>'board_no')::integer;
      outcome := p_input->>'result';
      reason := p_input->>'reason';
      IF outcome IS NULL OR outcome NOT IN ('1-0','0-1','1/2-1/2','+/-','-/+','-/-') OR
          reason IS NULL OR length(btrim(reason)) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
      END IF;
      IF board.revision IS DISTINCT FROM (p_input->>'revision')::integer THEN
        RAISE EXCEPTION 'result_conflict' USING ERRCODE = '40001';
      END IF;
      IF board.confirmed IS DISTINCT FROM (p_action = 'correct') THEN
        RAISE EXCEPTION 'invalid_state' USING ERRCODE = '55000';
      END IF;
      UPDATE public.team_tournament_board_results b
        SET result = outcome, confirmed = p_action <> 'record', revision = board.revision + 1
        WHERE b.match_id = board.match_id AND b.board_no = board.board_no;
      INSERT INTO public.team_tournament_result_audit
        (tournament_id, match_id, board_no, revision, actor_id, action, old_result, new_result, old_confirmed, new_confirmed, reason)
        VALUES (p_id, board.match_id, board.board_no, board.revision + 1, p_actor, p_action, board.result, outcome,
          board.confirmed, p_action <> 'record', btrim(reason));
      RETURN jsonb_build_object('match_id', board.match_id, 'board_no', board.board_no, 'result', outcome,
        'confirmed', p_action <> 'record', 'revision', board.revision + 1);
  END CASE;
  RETURN jsonb_build_object('id', p_id, 'status', event.status);
END;
$$;
REVOKE ALL ON FUNCTION public.team_tournament_command(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_command(uuid, text, uuid, jsonb) TO service_role;
