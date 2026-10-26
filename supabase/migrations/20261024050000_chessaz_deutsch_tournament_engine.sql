-- ChessAZ Deutsch tournament competition M2: additive, activation OFF.
-- Requires community/calendar and durable game migrations.
BEGIN;
ALTER TABLE public.chess_club_tournaments DROP CONSTRAINT chess_club_tournaments_status_check;
ALTER TABLE public.chess_club_tournaments
  ADD CONSTRAINT chess_club_tournaments_status_check
    CHECK (status IN ('scheduled','cancelled','running','completed'));
ALTER TABLE public.chess_club_tournaments
  ADD COLUMN rounds_total smallint NOT NULL DEFAULT 5 CHECK (rounds_total BETWEEN 1 AND 15),
  ADD COLUMN current_round smallint NOT NULL DEFAULT 0 CHECK (current_round BETWEEN 0 AND 15),
  ADD COLUMN time_control text NOT NULL DEFAULT '3+2'
    CHECK (time_control IN ('1+0','1+1','2+1','3+0','3+2','5+0','10+0','15+10','30+0')),
  ADD COLUMN competition_enabled boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT chess_club_round_boundary CHECK (current_round <= rounds_total);
-- Existing calendar signups may be withdrawn only before a tournament begins.
DROP POLICY chess_club_tournament_entries_leave ON public.chess_club_tournament_entries;
CREATE POLICY chess_club_tournament_entries_leave
  ON public.chess_club_tournament_entries FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.chess_club_tournaments t
    WHERE t.id = tournament_id AND t.status = 'scheduled'
      AND t.starts_at > now()
  ));

CREATE TABLE public.chess_club_tournament_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.chess_club_tournaments(id) ON DELETE RESTRICT,
  round_no smallint NOT NULL CHECK (round_no BETWEEN 1 AND 15),
  board_no smallint NOT NULL CHECK (board_no BETWEEN 1 AND 64),
  white_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  black_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  room_id uuid UNIQUE,
  match_id uuid UNIQUE REFERENCES public.matches(id) ON DELETE RESTRICT,
  result text CHECK (result IN ('1-0','0-1','1/2-1/2','bye')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(tournament_id,round_no,board_no),
  CONSTRAINT chess_club_tournament_game_pair_check CHECK (
    (black_id IS NULL AND room_id IS NULL AND status = 'completed' AND result = 'bye')
    OR
    (black_id IS NOT NULL AND white_id <> black_id AND room_id IS NOT NULL
      AND (result IS NULL OR result <> 'bye')
      AND (status <> 'completed' OR result IS NOT NULL))
  )
);
CREATE INDEX chess_club_tournament_games_feed_idx
  ON public.chess_club_tournament_games(tournament_id,round_no,board_no);

ALTER TABLE public.chess_club_tournament_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chess_club_tournament_games FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.chess_club_tournament_games TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.chess_club_tournament_games TO service_role;
CREATE POLICY chess_club_tournament_games_members_read
  ON public.chess_club_tournament_games FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chess_club_tournaments t
    JOIN public.chess_club_members m ON m.club_id=t.club_id
    WHERE t.id=chess_club_tournament_games.tournament_id
      AND m.user_id=(SELECT auth.uid())
  ));

-- Transactional barrier: only the service role can publish a validated, complete
-- pairing set. No client can start, finalize, or substitute match results.
CREATE FUNCTION public.chess_club_tournament_transition(
  p_action text, p_tournament_id uuid,
  p_round_no integer DEFAULT NULL, p_pairs jsonb DEFAULT NULL,
  p_room_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $engine$
DECLARE
  t public.chess_club_tournaments%ROWTYPE;
  g public.chess_club_tournament_games%ROWTYPE;
  m public.matches%ROWTYPE;
  d public.durable_games%ROWTYPE;
  total_players integer;
  listed_players integer;
  round_games integer;
  body jsonb;
  row record;
BEGIN
  SELECT * INTO t FROM public.chess_club_tournaments
    WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','not_found'); END IF;

  IF p_action='publish' THEN
    IF NOT t.competition_enabled OR t.status NOT IN ('scheduled','running')
       OR (t.status='scheduled' AND t.starts_at > now()) THEN
      RETURN jsonb_build_object('ok',false,'code','not_ready');
    END IF;
    IF p_round_no IS NULL OR p_round_no < 1 OR p_round_no > t.rounds_total THEN
      RETURN jsonb_build_object('ok',false,'code','invalid_round');
    END IF;
    -- Replay-safe; never overwrite immutable pairings on concurrent ticks.
    IF p_round_no <= t.current_round THEN
      RETURN jsonb_build_object('ok',true,'already_published',true);
    END IF;
    IF p_round_no <> t.current_round+1 THEN
      RETURN jsonb_build_object('ok',false,'code','out_of_order');
    END IF;
    IF t.current_round > 0 AND EXISTS (
      SELECT 1 FROM public.chess_club_tournament_games
      WHERE tournament_id=t.id AND round_no=t.current_round AND status<>'completed'
    ) THEN
      RETURN jsonb_build_object('ok',false,'code','round_incomplete');
    END IF;
    SELECT count(*) INTO total_players FROM public.chess_club_tournament_entries
      WHERE tournament_id=t.id;
    IF total_players<t.min_players OR total_players>64 THEN
      RETURN jsonb_build_object('ok',false,'code','player_count');
    END IF;
    IF p_pairs IS NULL OR jsonb_typeof(p_pairs)<>'array' THEN
      RETURN jsonb_build_object('ok',false,'code','invalid_pairs');
    END IF;
    -- Expansion of the proposed round must contain each registered player
    -- exactly once, forbidding outsiders, duplicate players and extra byes.
    WITH proposed AS (
      SELECT (x->>'whiteId')::uuid w,
             CASE WHEN x->>'blackId' IS NOT NULL THEN (x->>'blackId')::uuid END b,
             CASE WHEN x->>'roomId' IS NOT NULL THEN (x->>'roomId')::uuid END room,
             x->>'result' outcome, ordinality::integer board
      FROM jsonb_array_elements(p_pairs) WITH ORDINALITY j(x, ordinality)
    ), expanded AS (
      SELECT w AS id FROM proposed UNION ALL SELECT b FROM proposed WHERE b IS NOT NULL
    )
    SELECT count(*) INTO listed_players FROM expanded;
    IF listed_players<>total_players OR EXISTS (
      WITH proposed AS (
        SELECT (x->>'whiteId')::uuid w,
               CASE WHEN x->>'blackId' IS NOT NULL THEN (x->>'blackId')::uuid END b,
               CASE WHEN x->>'roomId' IS NOT NULL THEN (x->>'roomId')::uuid END room,
               x->>'result' outcome
        FROM jsonb_array_elements(p_pairs) x
      ), expanded AS (
        SELECT w AS id FROM proposed UNION ALL SELECT b FROM proposed WHERE b IS NOT NULL
      )
      SELECT 1 FROM expanded p LEFT JOIN public.chess_club_tournament_entries e
        ON e.user_id=p.id AND e.tournament_id=t.id
      GROUP BY p.id HAVING count(*)<>1 OR count(e.user_id)<>1
    ) THEN RETURN jsonb_build_object('ok',false,'code','invalid_players'); END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_pairs) x
      WHERE (x->>'blackId' IS NULL AND (x->>'roomId' IS NOT NULL OR x->>'result'<>'bye'))
         OR (x->>'blackId' IS NOT NULL AND (x->>'roomId' IS NULL OR x->>'result' IS NOT NULL))
         OR (x->>'whiteId'=x->>'blackId')
    ) THEN RETURN jsonb_build_object('ok',false,'code','invalid_pair'); END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(p_pairs) x WHERE x->>'blackId' IS NULL)
       <> (total_players%2) THEN
      RETURN jsonb_build_object('ok',false,'code','bye_count');
    END IF;
    -- Past bye cannot be re-awarded to the same player.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_pairs) x
      WHERE x->>'blackId' IS NULL AND EXISTS (
        SELECT 1 FROM public.chess_club_tournament_games old
        WHERE old.tournament_id=t.id AND old.result='bye'
          AND old.white_id=(x->>'whiteId')::uuid
      )
    ) THEN RETURN jsonb_build_object('ok',false,'code','duplicate_bye'); END IF;
    -- Explicit unique room IDs and no replay of a room from a prior round.
    IF EXISTS (SELECT 1 FROM (
        SELECT x->>'roomId' id FROM jsonb_array_elements(p_pairs) x
        WHERE x->>'roomId' IS NOT NULL
        GROUP BY x->>'roomId' HAVING count(*)>1
    ) dup) THEN RETURN jsonb_build_object('ok',false,'code','duplicate_room'); END IF;
    INSERT INTO public.chess_club_tournament_games
       (tournament_id,round_no,board_no,white_id,black_id,room_id,status,result,completed_at)
    SELECT t.id,p_round_no,ordinality::integer,
       (x->>'whiteId')::uuid,(x->>'blackId')::uuid,
       (x->>'roomId')::uuid,
       CASE WHEN x->>'blackId' IS NULL THEN 'completed' ELSE 'pending' END,
       CASE WHEN x->>'blackId' IS NULL THEN 'bye' ELSE NULL END,
       CASE WHEN x->>'blackId' IS NULL THEN now() ELSE NULL END
    FROM jsonb_array_elements(p_pairs) WITH ORDINALITY j(x, ordinality);
    UPDATE public.chess_club_tournaments
      SET current_round=p_round_no,status='running' WHERE id=t.id;
    RETURN jsonb_build_object('ok',true,'round',p_round_no);
  ELSIF p_action='live' THEN
    SELECT * INTO g FROM public.chess_club_tournament_games
    WHERE tournament_id=t.id AND room_id=p_room_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','not_found'); END IF;
    IF g.status='live' OR g.status='completed' THEN
      RETURN jsonb_build_object('ok',true,'already_live',true);
    END IF;
    SELECT * INTO d FROM public.durable_games
      WHERE room_id=p_room_id AND NOT result_saved;
    IF NOT FOUND OR d.state->'userIds'->>'w' IS DISTINCT FROM g.white_id::text
         OR d.state->'userIds'->>'b' IS DISTINCT FROM g.black_id::text
      THEN RETURN jsonb_build_object('ok',false,'code','game_unconfirmed'); END IF;
    UPDATE public.chess_club_tournament_games SET status='live' WHERE id=g.id;
    RETURN jsonb_build_object('ok',true);
  ELSIF p_action='result' THEN
    SELECT * INTO g FROM public.chess_club_tournament_games
      WHERE tournament_id=t.id AND room_id=p_room_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','not_found'); END IF;
    SELECT * INTO m FROM public.matches
      WHERE source_room_id=p_room_id::text AND status='completed'
        AND white_id=g.white_id AND black_id=g.black_id
      ORDER BY completed_at DESC LIMIT 1;
    IF NOT FOUND OR m.result NOT IN ('1-0','0-1','1/2-1/2')
      THEN RETURN jsonb_build_object('ok',false,'code','match_unconfirmed'); END IF;
    IF g.status='completed' THEN
      RETURN jsonb_build_object('ok',g.match_id=m.id AND g.result=m.result,
        'already_recorded',true);
    END IF;
    UPDATE public.chess_club_tournament_games SET
      status='completed',result=m.result,match_id=m.id,completed_at=m.completed_at
      WHERE id=g.id;
    IF t.current_round=t.rounds_total AND NOT EXISTS (
      SELECT 1 FROM public.chess_club_tournament_games
      WHERE tournament_id=t.id AND round_no=t.current_round AND status<>'completed'
    ) THEN
      UPDATE public.chess_club_tournaments SET status='completed' WHERE id=t.id;
    END IF;
    RETURN jsonb_build_object('ok',true,'result',m.result);
  END IF;
  RETURN jsonb_build_object('ok',false,'code','invalid_action');
END;
$engine$;
REVOKE ALL ON FUNCTION public.chess_club_tournament_transition(text,uuid,integer,jsonb,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chess_club_tournament_transition(text,uuid,integer,jsonb,uuid)
  TO service_role;
COMMIT;
