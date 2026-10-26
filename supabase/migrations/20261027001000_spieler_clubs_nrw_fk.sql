-- Forward-only integration after PR #127 Spieler migrations and Clubs NRW directory.
BEGIN;
ALTER TABLE public.spieler_claims RENAME COLUMN club TO club_legacy;
ALTER TABLE public.spieler_claims ADD COLUMN club_id uuid REFERENCES public.clubs_nrw(id) ON DELETE SET NULL;
-- The previous text is retained privately and never emitted by Spieler search.
CREATE OR REPLACE FUNCTION public.spieler_search(p_surname text DEFAULT NULL,p_id bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM (
 SELECT fide_id,name,surname,federation,title,fide_rating,
 (SELECT n.name FROM public.spieler_claims c JOIN public.clubs_nrw n ON n.id=c.club_id WHERE c.fide_id=s.fide_id AND c.status='verified' AND n.published) AS club,
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
DECLARE answer text; previous text; own_profile boolean; selected_club uuid;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.spieler_players WHERE fide_id=p_fide) THEN RAISE EXCEPTION 'not_found' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,23));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fide::text,24));
 IF p_action='claim' THEN
  IF p_club IS NOT NULL AND p_club !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
  IF EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p_actor AND fide_id<>p_fide) THEN RAISE EXCEPTION 'claim_exists' USING ERRCODE='23514'; END IF;
  INSERT INTO public.spieler_claims(user_id,fide_id,club_id) VALUES(p_actor,p_fide,selected_club)
   ON CONFLICT(user_id) DO UPDATE SET
    club_id=excluded.club_id,
    status=CASE WHEN spieler_claims.status='verified' AND spieler_claims.club_id IS NOT DISTINCT FROM excluded.club_id THEN 'verified' ELSE 'pending' END,
    reviewed_at=CASE WHEN spieler_claims.status='verified' AND spieler_claims.club_id IS NOT DISTINCT FROM excluded.club_id THEN spieler_claims.reviewed_at ELSE NULL END,
    created_at=CASE WHEN spieler_claims.status='pending' OR (spieler_claims.status='verified' AND spieler_claims.club_id IS NOT DISTINCT FROM excluded.club_id) THEN spieler_claims.created_at ELSE now() END;
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
END $fn$; THEN RAISE EXCEPTION 'invalid_club' USING ERRCODE='22023'; END IF;
  selected_club:=p_club::uuid;
  IF selected_club IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clubs_nrw WHERE id=selected_club AND published) THEN RAISE EXCEPTION 'invalid_club' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p_actor AND fide_id<>p_fide) THEN RAISE EXCEPTION 'claim_exists' USING ERRCODE='23514'; END IF;
  INSERT INTO public.spieler_claims(user_id,fide_id,club) VALUES(p_actor,p_fide,nullif(btrim(p_club),''))
   ON CONFLICT(user_id) DO UPDATE SET
    club=excluded.club,
    status=CASE WHEN spieler_claims.status='verified' AND spieler_claims.club_id IS NOT DISTINCT FROM excluded.club_id THEN 'verified' ELSE 'pending' END,
    reviewed_at=CASE WHEN spieler_claims.status='verified' AND spieler_claims.club_id IS NOT DISTINCT FROM excluded.club_id THEN spieler_claims.reviewed_at ELSE NULL END,
    created_at=CASE WHEN spieler_claims.status='pending' OR (spieler_claims.status='verified' AND spieler_claims.club_id IS NOT DISTINCT FROM excluded.club_id) THEN spieler_claims.created_at ELSE now() END;
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
COMMIT;
