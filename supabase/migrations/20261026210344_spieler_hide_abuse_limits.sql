BEGIN;
-- Forward only: neither of the previously applied Spieler migrations is edited.
ALTER TABLE public.spieler_opt_out DROP CONSTRAINT spieler_opt_out_status_check;
ALTER TABLE public.spieler_opt_out ADD CONSTRAINT spieler_opt_out_status_check
 CHECK(status IN ('hidden_pending_review','pending_owner_review','approved','restored'));
ALTER TABLE public.spieler_opt_out ALTER COLUMN status SET DEFAULT 'pending_owner_review';
-- Verified self-hides never consume the unverified-account allowance.
UPDATE public.spieler_opt_out o SET status='approved'
 WHERE o.status='hidden_pending_review' AND EXISTS(
 SELECT 1 FROM public.spieler_claims c WHERE c.user_id=o.user_id AND c.fide_id=o.fide_id AND c.status='verified');
-- Enforce the cap for historical rows too; preserve every request/deadline.
WITH ranked AS (
 SELECT user_id,fide_id,row_number() OVER(PARTITION BY user_id ORDER BY created_at,fide_id) AS n
 FROM public.spieler_opt_out WHERE status='hidden_pending_review'
)
UPDATE public.spieler_opt_out o SET status='pending_owner_review'
 FROM ranked r WHERE o.user_id=r.user_id AND o.fide_id=r.fide_id AND r.n>3;
CREATE INDEX spieler_pending_hide_user_idx ON public.spieler_opt_out(user_id)
 WHERE status='hidden_pending_review';

CREATE OR REPLACE FUNCTION public.spieler_request(p_action text,p_actor uuid,p_fide bigint,p_club text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE answer text; previous text; own_profile boolean;
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
  SELECT status INTO previous FROM public.spieler_opt_out WHERE user_id=p_actor AND fide_id=p_fide;
  SELECT EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p_actor AND fide_id=p_fide AND status='verified') INTO own_profile;
  IF previous='approved' OR own_profile THEN
   answer:='approved';
  ELSIF previous='hidden_pending_review' THEN
   answer:='hidden_pending_review'; -- Idempotent retry uses its existing slot.
  ELSIF (SELECT count(*) FROM public.spieler_opt_out o WHERE o.user_id=p_actor AND o.status='hidden_pending_review'
   AND NOT EXISTS(SELECT 1 FROM public.spieler_claims c WHERE c.user_id=p_actor AND c.fide_id=o.fide_id AND c.status='verified'))<3 THEN
   answer:='hidden_pending_review';
  ELSE
   answer:='pending_owner_review'; -- Stored without adding suppression to search/card/games.
  END IF;
  INSERT INTO public.spieler_opt_out(user_id,fide_id,status) VALUES(p_actor,p_fide,answer)
   ON CONFLICT(user_id,fide_id) DO UPDATE SET
    status=excluded.status,
    reviewed_at=CASE WHEN spieler_opt_out.status=excluded.status THEN spieler_opt_out.reviewed_at ELSE NULL END,
    created_at=CASE WHEN spieler_opt_out.status='restored' THEN now() ELSE spieler_opt_out.created_at END;
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 -- A returned conflict code preserves the INSERT; raising would roll it back.
 RETURN jsonb_build_object('status',answer)||CASE WHEN answer='pending_owner_review' THEN jsonb_build_object('code','hide_limit') ELSE '{}'::jsonb END;
END $fn$;
REVOKE ALL ON FUNCTION public.spieler_request(text,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.spieler_request(text,uuid,bigint,text) TO service_role;
-- spieler_search already excludes only hidden_pending_review/approved.
-- The private owner review function can confirm or restore pending_owner_review
-- without any new browser grant, API endpoint or SECURITY DEFINER function.
COMMIT;
