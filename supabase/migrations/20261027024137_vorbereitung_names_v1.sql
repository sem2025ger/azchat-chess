BEGIN;
CREATE TABLE public.spieler_broadcast_games (
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
 source_month text NOT NULL CHECK(source_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 source_url text NOT NULL CHECK(source_url='https://database.lichess.org/broadcast/lichess_db_broadcast_'||source_month||'.pgn.zst'),
 license_url text NOT NULL CHECK(license_url='https://creativecommons.org/licenses/by-sa/4.0/'),
 pgn text NOT NULL CHECK(octet_length(pgn)<=65536),white_name text NOT NULL CHECK(length(white_name) BETWEEN 1 AND 150),black_name text NOT NULL CHECK(length(black_name) BETWEEN 1 AND 150),
 white_key text,black_key text,white_fide_id bigint,black_fide_id bigint,event text NOT NULL DEFAULT '',game_date date,eco text,opening text,time_control text NOT NULL DEFAULT '?'
);
CREATE INDEX broadcast_white_fide_idx ON public.spieler_broadcast_games(white_fide_id);
CREATE INDEX broadcast_black_fide_idx ON public.spieler_broadcast_games(black_fide_id);
CREATE INDEX broadcast_white_name_idx ON public.spieler_broadcast_games(white_key);
CREATE INDEX broadcast_black_name_idx ON public.spieler_broadcast_games(black_key);
ALTER TABLE public.spieler_broadcast_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spieler_broadcast_games FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.spieler_broadcast_games TO service_role;
CREATE FUNCTION public.preparation_name_key(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN p_name ~ '^[^,]+,[^,]+$' THEN lower(regexp_replace(btrim(split_part(p_name,',',1)),'\s+',' ','g')||', '||regexp_replace(btrim(split_part(p_name,',',2)),'\s+',' ','g')) ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.preparation_name_key(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparation_name_key(text) TO service_role;
CREATE FUNCTION public.preparation_candidates(p_name text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM (
  SELECT DISTINCT fide_id FROM (
   SELECT fide_id FROM public.spieler_players WHERE public.preparation_name_key(name)=public.preparation_name_key(p_name)
   UNION SELECT white_fide_id FROM public.spieler_broadcast_games WHERE white_key=public.preparation_name_key(p_name)
   UNION SELECT black_fide_id FROM public.spieler_broadcast_games WHERE black_key=public.preparation_name_key(p_name)
  ) s WHERE fide_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.spieler_opt_out o WHERE o.fide_id=s.fide_id AND o.status IN ('hidden_pending_review','approved')) ORDER BY fide_id LIMIT 25
 ) t;
$$;
REVOKE ALL ON FUNCTION public.preparation_candidates(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparation_candidates(text) TO service_role;
CREATE FUNCTION public.preparation_games(p_fide bigint DEFAULT NULL,p_name text DEFAULT NULL,p_offset integer DEFAULT 0,p_limit integer DEFAULT 500)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE full_name text; key text;
BEGIN
 IF p_offset IS NULL OR p_limit IS NULL OR p_offset<0 OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_query' USING ERRCODE='22023'; END IF;
 IF p_fide IS NOT NULL AND EXISTS(SELECT 1 FROM public.spieler_opt_out WHERE fide_id=p_fide AND status IN ('hidden_pending_review','approved')) THEN RETURN '[]'::jsonb; END IF;
 IF p_fide IS NULL THEN full_name:=p_name;
 ELSE
  SELECT name INTO full_name FROM public.spieler_players WHERE fide_id=p_fide;
  IF full_name IS NULL THEN SELECT white_name INTO full_name FROM public.spieler_broadcast_games WHERE white_fide_id=p_fide LIMIT 1; END IF;
  IF full_name IS NULL THEN SELECT black_name INTO full_name FROM public.spieler_broadcast_games WHERE black_fide_id=p_fide LIMIT 1; END IF;
 END IF;
 key:=public.preparation_name_key(full_name);
 IF p_fide IS NULL AND key IS NULL THEN RAISE EXCEPTION 'full_name_required' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM (
 SELECT * FROM (
  SELECT b.id,b.pgn,'lichess-broadcast'::text AS source,b.source_url,b.license_url,b.white_name,b.black_name,b.white_fide_id,b.black_fide_id,b.event,b.game_date,b.eco,b.opening,b.time_control,
   CASE WHEN p_fide IS NOT NULL AND b.white_fide_id=p_fide THEN 'white' WHEN p_fide IS NOT NULL AND b.black_fide_id=p_fide THEN 'black' WHEN b.white_key=key THEN 'white' ELSE 'black' END AS color,
   CASE WHEN p_fide IS NOT NULL AND (b.white_fide_id=p_fide OR b.black_fide_id=p_fide) THEN 'fide_id' ELSE 'name' END AS link_basis
  FROM public.spieler_broadcast_games b WHERE
   ((p_fide IS NOT NULL AND (b.white_fide_id=p_fide OR b.black_fide_id=p_fide)) OR (b.white_fide_id IS NULL AND b.white_key=key) OR (b.black_fide_id IS NULL AND b.black_key=key) OR (p_fide IS NULL AND (b.white_key=key OR b.black_key=key)))
   AND NOT(coalesce(b.white_key=key,false) AND coalesce(b.black_key=key,false) AND (p_fide IS NULL OR (b.white_fide_id IS NULL AND b.black_fide_id IS NULL)))
   AND NOT EXISTS(SELECT 1 FROM public.spieler_opt_out o JOIN public.spieler_players s ON s.fide_id=o.fide_id WHERE o.status IN ('hidden_pending_review','approved') AND (o.fide_id IN (b.white_fide_id,b.black_fide_id) OR public.preparation_name_key(s.name)=key))
  UNION ALL
  SELECT g.id,g.pgn,g.source,NULL,NULL,NULL,NULL,g.white_fide_id,g.black_fide_id,NULL,NULL,NULL,NULL,NULL,
   CASE WHEN g.white_fide_id=p_fide THEN 'white' ELSE 'black' END,'fide_id'
  FROM public.spieler_twic_games g WHERE p_fide IS NOT NULL AND (g.white_fide_id=p_fide OR g.black_fide_id=p_fide)
 ) combined ORDER BY game_date DESC NULLS LAST,id LIMIT p_limit OFFSET p_offset
 ) t);
END $$;
REVOKE ALL ON FUNCTION public.preparation_games(bigint,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparation_games(bigint,text,integer,integer) TO service_role;
COMMIT;
