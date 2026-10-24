-- Games Database v1. QA ONLY: iukmpcytsuofqhxsumbu. Never apply to production.
-- No source data is imported. TWIC reuse requires owner clearance first.
BEGIN;
CREATE TABLE public.chess_db_games (
  id bigserial PRIMARY KEY,
  source text NOT NULL CHECK (source = 'twic'), source_issue int NOT NULL,
  game_hash text NOT NULL UNIQUE CHECK (game_hash ~ '^[0-9a-f]{64}$'),
  event text, site text, round text, game_date text, game_year smallint,
  white text NOT NULL, black text NOT NULL, white_norm text NOT NULL, black_norm text NOT NULL,
  white_elo smallint, black_elo smallint,
  result text NOT NULL CHECK (result IN ('1-0','0-1','1/2-1/2','*')),
  eco text, ply_count smallint NOT NULL CHECK (ply_count BETWEEN 1 AND 2048),
  pgn text NOT NULL CHECK (octet_length(pgn) <= 250000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.chess_db_positions (
  pos_hash bigint NOT NULL, game_id bigint NOT NULL REFERENCES public.chess_db_games(id) ON DELETE CASCADE,
  ply smallint NOT NULL CHECK (ply BETWEEN 1 AND 24), PRIMARY KEY (pos_hash, game_id, ply)
);
CREATE TABLE public.chess_db_imports (
  issue int PRIMARY KEY, status text NOT NULL CHECK (status IN ('running','done','failed')),
  games_inserted int NOT NULL DEFAULT 0, games_skipped int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, error text
);
-- pg_trgm is not installed in QA. Prefix-only name search avoids a new extension.
CREATE INDEX chess_db_white_prefix ON public.chess_db_games(white_norm text_pattern_ops);
CREATE INDEX chess_db_black_prefix ON public.chess_db_games(black_norm text_pattern_ops);
CREATE INDEX chess_db_year_idx ON public.chess_db_games(game_year DESC);
CREATE INDEX chess_db_eco_idx ON public.chess_db_games(eco);
CREATE INDEX chess_db_positions_game_idx ON public.chess_db_positions(game_id);
ALTER TABLE public.chess_db_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_db_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_db_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chess_db_games, public.chess_db_positions, public.chess_db_imports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.chess_db_games_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chess_db_games, public.chess_db_positions, public.chess_db_imports TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.chess_db_games_id_seq TO service_role;

-- Server-only, parameterized operations via the existing Supabase service client.
-- SECURITY INVOKER: callers must possess table grants. No browser policies.
CREATE FUNCTION public.chess_db_control(
  p_operation text, p_issue int DEFAULT NULL, p_games jsonb DEFAULT '[]',
  p_skipped int DEFAULT 0, p_error text DEFAULT NULL, p_max_mb int DEFAULT 300
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE size_before bigint; inserted_count int; current_status text;
BEGIN
  IF p_operation = 'size' THEN
    RETURN jsonb_build_object('size_bytes',pg_catalog.pg_database_size(current_database()));
  END IF;
  IF p_issue IS NULL OR p_issue < 1 OR p_max_mb NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'INVALID_IMPORT_OPTIONS';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(4903021,81001);
  IF p_operation = 'start' THEN
    size_before := pg_catalog.pg_database_size(current_database());
    IF size_before >= p_max_mb::bigint*1024*1024 THEN RAISE EXCEPTION 'DB_SIZE_LIMIT'; END IF;
    SELECT status INTO current_status FROM public.chess_db_imports WHERE issue=p_issue FOR UPDATE;
    IF current_status = 'done' THEN RETURN jsonb_build_object('done',true,'size_bytes',size_before); END IF;
    IF current_status = 'running' AND EXISTS (SELECT 1 FROM public.chess_db_imports WHERE issue=p_issue AND started_at>now()-interval '30 minutes') THEN RAISE EXCEPTION 'IMPORT_ALREADY_RUNNING'; END IF;
    INSERT INTO public.chess_db_imports(issue,status) VALUES(p_issue,'running')
      ON CONFLICT(issue) DO UPDATE SET status='running',started_at=now(),finished_at=NULL,error=NULL;
    RETURN jsonb_build_object('done',false,'size_bytes',size_before);
  ELSIF p_operation = 'batch' THEN
    IF jsonb_typeof(p_games) <> 'array' OR jsonb_array_length(p_games)>25 THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.chess_db_imports WHERE issue=p_issue AND status='running') THEN RAISE EXCEPTION 'IMPORT_NOT_RUNNING'; END IF;
    size_before := pg_catalog.pg_database_size(current_database());
    IF size_before + octet_length(p_games::text)::bigint*4 + jsonb_array_length(p_games)::bigint*24*512 > p_max_mb::bigint*1024*1024 THEN RAISE EXCEPTION 'DB_SIZE_LIMIT'; END IF;
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset(p_games) AS x(game_hash text,event text,site text,round text,game_date text,game_year smallint,white text,black text,white_norm text,black_norm text,white_elo smallint,black_elo smallint,result text,eco text,ply_count smallint,pgn text,positions jsonb)
    ), added AS (
      INSERT INTO public.chess_db_games(source,source_issue,game_hash,event,site,round,game_date,game_year,white,black,white_norm,black_norm,white_elo,black_elo,result,eco,ply_count,pgn)
      SELECT 'twic',p_issue,game_hash,event,site,round,game_date,game_year,white,black,white_norm,black_norm,white_elo,black_elo,result,eco,ply_count,pgn FROM incoming
      ON CONFLICT(game_hash) DO NOTHING RETURNING id,game_hash
    ), positions AS (
      INSERT INTO public.chess_db_positions(pos_hash,game_id,ply)
      SELECT p.pos_hash,a.id,p.ply FROM added a JOIN incoming i ON i.game_hash=a.game_hash
      CROSS JOIN LATERAL jsonb_to_recordset(i.positions) AS p(pos_hash bigint,ply smallint)
      ON CONFLICT DO NOTHING RETURNING game_id
    ) SELECT count(*)::int INTO inserted_count FROM added;
    IF pg_catalog.pg_database_size(current_database()) > p_max_mb::bigint*1024*1024 THEN RAISE EXCEPTION 'DB_SIZE_LIMIT'; END IF;
    UPDATE public.chess_db_imports SET games_inserted=games_inserted+inserted_count WHERE issue=p_issue;
    RETURN jsonb_build_object('inserted',inserted_count);
  ELSIF p_operation IN ('done','failed') THEN
    UPDATE public.chess_db_imports SET status=p_operation, finished_at=now(), games_skipped=p_skipped,
      error=CASE WHEN p_operation='failed' THEN left(coalesce(p_error,'TWIC_IMPORT_FAILED'),100) ELSE NULL END WHERE issue=p_issue;
    RETURN jsonb_build_object('ok',true);
  END IF;
  RAISE EXCEPTION 'INVALID_OPERATION';
END;
$$;
CREATE FUNCTION public.chess_db_search(p_player text DEFAULT NULL, p_hash bigint DEFAULT NULL, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE total_count bigint; games jsonb;
BEGIN
  IF (p_player IS NULL AND p_hash IS NULL) OR (p_player IS NOT NULL AND char_length(p_player) NOT BETWEEN 3 AND 100)
    OR p_limit NOT BETWEEN 1 AND 50 OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'INVALID_QUERY'; END IF;
  SELECT count(*) INTO total_count FROM public.chess_db_games g
    WHERE (p_player IS NULL OR g.white_norm LIKE p_player||'%' OR g.black_norm LIKE p_player||'%')
      AND (p_hash IS NULL OR EXISTS(SELECT 1 FROM public.chess_db_positions p WHERE p.pos_hash=p_hash AND p.game_id=g.id));
  SELECT coalesce(jsonb_agg(row.summary ORDER BY row.game_year DESC NULLS LAST, row.rating DESC NULLS LAST, row.id DESC),'[]'::jsonb) INTO games FROM (
    SELECT g.id,g.game_year,greatest(g.white_elo,g.black_elo) AS rating,
      jsonb_build_object('id',g.id::text,'white',jsonb_build_object('name',g.white,'rating',g.white_elo),'black',jsonb_build_object('name',g.black,'rating',g.black_elo),'year',g.game_year,'event',g.event,'result',g.result,'eco',g.eco) AS summary
    FROM public.chess_db_games g WHERE (p_player IS NULL OR g.white_norm LIKE p_player||'%' OR g.black_norm LIKE p_player||'%')
      AND (p_hash IS NULL OR EXISTS(SELECT 1 FROM public.chess_db_positions p WHERE p.pos_hash=p_hash AND p.game_id=g.id))
    ORDER BY g.game_year DESC NULLS LAST,greatest(g.white_elo,g.black_elo) DESC NULLS LAST,g.id DESC LIMIT p_limit OFFSET p_offset
  ) row;
  RETURN jsonb_build_object('source','chessaz-db','total',total_count,'games',games);
END;
$$;
REVOKE ALL ON FUNCTION public.chess_db_control(text,int,jsonb,int,text,int), public.chess_db_search(text,bigint,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chess_db_control(text,int,jsonb,int,text,int), public.chess_db_search(text,bigint,int,int) TO service_role;
COMMIT;
