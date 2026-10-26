-- QA ONLY. Uses two existing QA profile IDs privately; creates no auth sessions.
-- Temporary request/approval changes are entirely rolled back.
BEGIN;
DO $check$
DECLARE ids uuid[];
BEGIN
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.profiles ORDER BY id LIMIT 2) p;
 IF cardinality(ids)<>2 THEN RAISE EXCEPTION 'Two QA profiles required'; END IF;
 PERFORM set_config('spieler.qa_actor',ids[1]::text,true);
 PERFORM set_config('spieler.qa_outsider',ids[2]::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.spieler_players WHERE fide_id=13404431) THEN RAISE EXCEPTION 'Imported acceptance player missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=ANY(ids)) THEN RAISE EXCEPTION 'QA fixture users already have requests; choose isolated actors'; END IF;
 PERFORM public.spieler_request('claim',ids[1],13404431,'QA voluntary club');
 IF (SELECT value->>'club' FROM jsonb_array_elements(public.spieler_search(NULL,13404431)) p(value)) IS NOT NULL THEN RAISE EXCEPTION 'Pending club exposed'; END IF;
 PERFORM public.spieler_request('hide',ids[1],13404431);
 IF jsonb_array_length(public.spieler_search(NULL,13404431))<>1 THEN RAISE EXCEPTION 'Unverified actor hid player'; END IF;
END $check$;
SET LOCAL ROLE authenticated;
DO $check$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('spieler.qa_actor'),true);
 IF (SELECT count(*) FROM public.spieler_claims)<>1 OR (SELECT count(*) FROM public.spieler_opt_out)<>1 THEN RAISE EXCEPTION 'Owner cannot read request'; END IF;
 BEGIN UPDATE public.spieler_claims SET status='verified'; RAISE EXCEPTION 'Self approval allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.spieler_search('Huseynov'); RAISE EXCEPTION 'Catalog RPC exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM fide_id FROM public.spieler_players; RAISE EXCEPTION 'Raw catalog exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',current_setting('spieler.qa_outsider'),true);
 IF EXISTS(SELECT 1 FROM public.spieler_claims) OR EXISTS(SELECT 1 FROM public.spieler_opt_out) THEN RAISE EXCEPTION 'Other actor can read private requests'; END IF;
END $check$;
RESET ROLE;
DO $check$
BEGIN
 UPDATE public.spieler_claims SET status='verified' WHERE user_id=current_setting('spieler.qa_actor')::uuid;
 IF (SELECT value->>'club' FROM jsonb_array_elements(public.spieler_search(NULL,13404431)) p(value))<>'QA voluntary club' THEN RAISE EXCEPTION 'Verified voluntary club missing'; END IF;
 PERFORM public.spieler_request('hide',current_setting('spieler.qa_actor')::uuid,13404431);
 IF public.spieler_search(NULL,13404431)<>'[]'::jsonb THEN RAISE EXCEPTION 'Direct ID bypasses opt-out'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.spieler_search('Huseynov')) p(value) WHERE value->>'fide_id'='13404431') THEN RAISE EXCEPTION 'Search bypasses opt-out'; END IF;
END $check$;
SET LOCAL ROLE anon;
DO $check$
BEGIN
 BEGIN PERFORM public.spieler_search('Huseynov'); RAISE EXCEPTION 'Anon catalog RPC exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM status FROM public.spieler_opt_out; RAISE EXCEPTION 'Anon requests exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $check$;
RESET ROLE;
SELECT jsonb_build_object('owner_rls',true,'outsider_rls',true,'anon_denied',true,'no_self_approval',true,'pending_club_private',true,'verified_self_club',true,'unverified_cannot_hide',true,'approved_opt_out_search_and_id',true,'rollback',true) AS verified;
ROLLBACK;
