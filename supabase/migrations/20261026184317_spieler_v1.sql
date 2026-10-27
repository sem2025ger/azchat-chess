BEGIN;
CREATE TABLE public.spieler_players (
 fide_id bigint PRIMARY KEY CHECK(fide_id BETWEEN 1 AND 9999999999),
 name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 150),
 surname text NOT NULL CHECK(char_length(surname) BETWEEN 1 AND 100),
 federation text NOT NULL CHECK(federation ~ '^[A-Z]{3}$'),
 title text CHECK(title IN ('GM','IM','FM','CM','WGM','WIM','WFM','WCM')),
 fide_rating integer CHECK(fide_rating BETWEEN 100 AND 4000),
 source_date date NOT NULL,
 source_url text NOT NULL CHECK(source_url ~ '^https://ratings[.]fide[.]com/'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spieler_surname_idx ON public.spieler_players(lower(surname) text_pattern_ops);
CREATE TABLE public.spieler_claims (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 fide_id bigint NOT NULL REFERENCES public.spieler_players(fide_id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
 club text CHECK(char_length(club)<=120),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX spieler_verified_owner_idx ON public.spieler_claims(fide_id) WHERE status='verified';
CREATE INDEX spieler_claim_fide_idx ON public.spieler_claims(fide_id);
CREATE TABLE public.spieler_opt_out (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 fide_id bigint NOT NULL REFERENCES public.spieler_players(fide_id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,fide_id)
);
CREATE INDEX spieler_hidden_idx ON public.spieler_opt_out(fide_id) WHERE status='approved';
CREATE TABLE public.spieler_twic_games (
 id text PRIMARY KEY CHECK(id ~ '^[0-9a-f]{64}$'),
 white_fide_id bigint,black_fide_id bigint,
 pgn text NOT NULL CHECK(octet_length(pgn)<=65536),
 source text NOT NULL CHECK(source ~ '^twic[0-9]{1,5}$')
);
CREATE INDEX spieler_twic_white_idx ON public.spieler_twic_games(white_fide_id);
CREATE INDEX spieler_twic_black_idx ON public.spieler_twic_games(black_fide_id);
ALTER TABLE public.spieler_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spieler_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spieler_opt_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spieler_twic_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spieler_players,public.spieler_claims,public.spieler_opt_out,public.spieler_twic_games FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.spieler_players,public.spieler_claims,public.spieler_opt_out,public.spieler_twic_games TO service_role;
GRANT SELECT ON public.spieler_claims,public.spieler_opt_out TO authenticated;
CREATE POLICY spieler_claim_owner_read ON public.spieler_claims FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY spieler_opt_out_owner_read ON public.spieler_opt_out FOR SELECT TO authenticated USING(user_id=(select auth.uid()));

-- Browser roles cannot enumerate imported players, bypass opt-out, forge claims,
-- approve themselves or call these server-only RPCs. HTTP is flag-gated.
CREATE FUNCTION public.spieler_search(p_surname text DEFAULT NULL,p_id bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM (
 SELECT fide_id,name,surname,federation,title,fide_rating,
 (SELECT c.club FROM public.spieler_claims c WHERE c.fide_id=s.fide_id AND c.status='verified') AS club,
 source_date,source_url
 FROM public.spieler_players s WHERE
 ((p_id IS NOT NULL AND fide_id=p_id) OR (p_id IS NULL AND char_length(btrim(p_surname)) BETWEEN 2 AND 100
 AND lower(surname) LIKE replace(replace(replace(lower(btrim(p_surname)),'\','\\'),'%','\%'),'_','\_')||'%' ESCAPE '\'))
 AND NOT EXISTS(SELECT 1 FROM public.spieler_opt_out o WHERE o.fide_id=s.fide_id AND o.status='approved')
 ORDER BY lower(surname),name,fide_id LIMIT 25
 ) p;
$fn$;
CREATE FUNCTION public.spieler_request(p_action text,p_actor uuid,p_fide bigint,p_club text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE answer text;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.spieler_players WHERE fide_id=p_fide) THEN RAISE EXCEPTION 'not_found' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,23));
 IF p_action='claim' THEN
  IF p_club IS NOT NULL AND (char_length(btrim(p_club))>120 OR p_club ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_club' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p_actor AND fide_id<>p_fide) THEN RAISE EXCEPTION 'claim_exists' USING ERRCODE='23514'; END IF;
  INSERT INTO public.spieler_claims(user_id,fide_id,club) VALUES(p_actor,p_fide,nullif(btrim(p_club),''))
   ON CONFLICT(user_id) DO UPDATE SET club=excluded.club;
  SELECT status INTO answer FROM public.spieler_claims WHERE user_id=p_actor;
 ELSIF p_action='hide' THEN
  answer:=CASE WHEN EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p_actor AND fide_id=p_fide AND status='verified') THEN 'approved' ELSE 'pending' END;
  INSERT INTO public.spieler_opt_out(user_id,fide_id,status) VALUES(p_actor,p_fide,answer)
   ON CONFLICT(user_id,fide_id) DO UPDATE SET status=CASE WHEN spieler_opt_out.status='approved' THEN 'approved' ELSE excluded.status END;
  SELECT status INTO answer FROM public.spieler_opt_out WHERE user_id=p_actor AND fide_id=p_fide;
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('status',answer);
END $fn$;
REVOKE ALL ON FUNCTION public.spieler_search(text,bigint),public.spieler_request(text,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.spieler_search(text,bigint),public.spieler_request(text,uuid,bigint,text) TO service_role;
COMMIT;
