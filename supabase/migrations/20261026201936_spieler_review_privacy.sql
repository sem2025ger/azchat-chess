BEGIN;
-- Forward-only: the original Spieler migration is already applied to QA.
ALTER TABLE public.spieler_opt_out DROP CONSTRAINT spieler_opt_out_status_check;
UPDATE public.spieler_opt_out SET status='hidden_pending_review' WHERE status='pending';
ALTER TABLE public.spieler_opt_out ALTER COLUMN status SET DEFAULT 'hidden_pending_review';
ALTER TABLE public.spieler_opt_out ADD CONSTRAINT spieler_opt_out_status_check
 CHECK(status IN ('hidden_pending_review','approved','restored'));
ALTER TABLE public.spieler_claims ADD COLUMN reviewed_at timestamptz;
ALTER TABLE public.spieler_opt_out ADD COLUMN reviewed_at timestamptz;
DROP INDEX public.spieler_hidden_idx;
CREATE INDEX spieler_hidden_idx ON public.spieler_opt_out(fide_id)
 WHERE status IN ('hidden_pending_review','approved');

CREATE OR REPLACE FUNCTION public.spieler_search(p_surname text DEFAULT NULL,p_id bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM (
 SELECT fide_id,name,surname,federation,title,fide_rating,
 (SELECT c.club FROM public.spieler_claims c WHERE c.fide_id=s.fide_id AND c.status='verified') AS club,
 source_date,source_url
 FROM public.spieler_players s WHERE
 ((p_id IS NOT NULL AND fide_id=p_id) OR (p_id IS NULL AND char_length(btrim(p_surname)) BETWEEN 2 AND 100
 AND lower(surname) LIKE replace(replace(replace(lower(btrim(p_surname)),'\','\\'),'%','\%'),'_','\_')||'%' ESCAPE '\'))
 AND NOT EXISTS(SELECT 1 FROM public.spieler_opt_out o WHERE o.fide_id=s.fide_id AND o.status IN ('hidden_pending_review','approved'))
 ORDER BY lower(surname),name,fide_id LIMIT 25
 ) p;
$fn$;
CREATE OR REPLACE FUNCTION public.spieler_request(p_action text,p_actor uuid,p_fide bigint,p_club text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE answer text;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.spieler_players WHERE fide_id=p_fide) THEN RAISE EXCEPTION 'not_found' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,23));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fide::text,24));
 IF p_action='claim' THEN
  IF p_club IS NOT NULL AND (char_length(btrim(p_club))>120 OR p_club ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_club' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p_actor AND fide_id<>p_fide) THEN RAISE EXCEPTION 'claim_exists' USING ERRCODE='23514'; END IF;
  INSERT INTO public.spieler_claims(user_id,fide_id,club) VALUES(p_actor,p_fide,nullif(btrim(p_club),''))
   ON CONFLICT(user_id) DO UPDATE SET
    club=excluded.club,
    status=CASE WHEN spieler_claims.status='verified' AND spieler_claims.club IS NOT DISTINCT FROM excluded.club THEN 'verified' ELSE 'pending' END,
    reviewed_at=CASE WHEN spieler_claims.status='verified' AND spieler_claims.club IS NOT DISTINCT FROM excluded.club THEN spieler_claims.reviewed_at ELSE NULL END,
    created_at=CASE WHEN spieler_claims.status='pending' OR (spieler_claims.status='verified' AND spieler_claims.club IS NOT DISTINCT FROM excluded.club) THEN spieler_claims.created_at ELSE now() END;
  SELECT status INTO answer FROM public.spieler_claims WHERE user_id=p_actor;
 ELSIF p_action='hide' THEN
  -- Any authenticated request suppresses immediately, even without a claim.
  INSERT INTO public.spieler_opt_out(user_id,fide_id,status) VALUES(p_actor,p_fide,'hidden_pending_review')
   ON CONFLICT(user_id,fide_id) DO UPDATE SET
    status=CASE WHEN spieler_opt_out.status='approved' THEN 'approved' ELSE 'hidden_pending_review' END,
    reviewed_at=CASE WHEN spieler_opt_out.status='approved' THEN spieler_opt_out.reviewed_at ELSE NULL END,
    created_at=CASE WHEN spieler_opt_out.status='restored' THEN now() ELSE spieler_opt_out.created_at END;
  SELECT status INTO answer FROM public.spieler_opt_out WHERE user_id=p_actor AND fide_id=p_fide;
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('status',answer);
END $fn$;
REVOKE ALL ON FUNCTION public.spieler_search(text,bigint),public.spieler_request(text,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.spieler_search(text,bigint),public.spieler_request(text,uuid,bigint,text) TO service_role;

-- Owner's SQL-only review surface: non-exposed schema, no HTTP endpoint or
-- application-user grants. The owner uses trusted SQL with service_role or
-- the dashboard's postgres role, never a browser/user JWT.
CREATE SCHEMA spieler_admin;
REVOKE ALL ON SCHEMA spieler_admin FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA spieler_admin TO service_role;
CREATE TABLE spieler_admin.review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 fide_id bigint NOT NULL,
 kind text NOT NULL CHECK(kind IN ('claim','hide')),
 decision text NOT NULL CHECK(decision IN ('approve','reject','restore','confirm')),
 previous_status text NOT NULL,
 new_status text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE spieler_admin.review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON spieler_admin.review_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON spieler_admin.review_events TO service_role;
CREATE FUNCTION spieler_admin.review(p_kind text,p_user uuid,p_fide bigint,p_decision text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE previous text; answer text;
BEGIN
 IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_decision IS NULL OR NOT (
  (p_kind='claim' AND p_decision IN ('approve','reject')) OR
  (p_kind='hide' AND p_decision IN ('restore','confirm'))
 ) THEN RAISE EXCEPTION 'invalid_review' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,23));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fide::text,24));
 IF p_kind='claim' THEN
  SELECT status INTO previous FROM public.spieler_claims WHERE user_id=p_user AND fide_id=p_fide FOR UPDATE;
  IF previous IS NULL THEN RAISE EXCEPTION 'request_not_found' USING ERRCODE='22023'; END IF;
  IF previous<>'pending' THEN RAISE EXCEPTION 'already_reviewed' USING ERRCODE='23514'; END IF;
  answer:=CASE WHEN p_decision='approve' THEN 'verified' ELSE 'rejected' END;
  UPDATE public.spieler_claims SET status=answer,reviewed_at=now() WHERE user_id=p_user AND fide_id=p_fide;
 ELSE
  SELECT status INTO previous FROM public.spieler_opt_out WHERE user_id=p_user AND fide_id=p_fide FOR UPDATE;
  IF previous IS NULL THEN RAISE EXCEPTION 'request_not_found' USING ERRCODE='22023'; END IF;
  IF previous='restored' OR (previous='approved' AND p_decision='confirm') THEN RAISE EXCEPTION 'already_reviewed' USING ERRCODE='23514'; END IF;
  answer:=CASE WHEN p_decision='confirm' THEN 'approved' ELSE 'restored' END;
  UPDATE public.spieler_opt_out SET status=answer,reviewed_at=now() WHERE user_id=p_user AND fide_id=p_fide;
 END IF;
 INSERT INTO spieler_admin.review_events(user_id,fide_id,kind,decision,previous_status,new_status)
  VALUES(p_user,p_fide,p_kind,p_decision,previous,answer);
 RETURN jsonb_build_object('status',answer);
END $fn$;
REVOKE ALL ON FUNCTION spieler_admin.review(text,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION spieler_admin.review(text,uuid,bigint,text) TO service_role;
COMMIT;
