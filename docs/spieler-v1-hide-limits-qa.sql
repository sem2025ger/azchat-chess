-- QA ONLY iukmpcytsuofqhxsumbu. Real imported IDs, temporary requests only.
-- Do not print actors/identity evidence. Every change is rolled back.
BEGIN;
DO $check$
DECLARE actor uuid; targets bigint[];
BEGIN
 SELECT id INTO actor FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM public.spieler_claims WHERE user_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.spieler_opt_out WHERE user_id=p.id) ORDER BY id LIMIT 1;
 SELECT array_agg(fide_id ORDER BY fide_id) INTO targets FROM (
  SELECT fide_id FROM public.spieler_players p WHERE NOT EXISTS(SELECT 1 FROM public.spieler_claims WHERE fide_id=p.fide_id)
  AND NOT EXISTS(SELECT 1 FROM public.spieler_opt_out WHERE fide_id=p.fide_id) ORDER BY fide_id LIMIT 5
 ) p;
 IF actor IS NULL OR cardinality(targets)<>5 THEN RAISE EXCEPTION 'Isolated QA fixtures unavailable'; END IF;
 PERFORM set_config('spieler.qa_actor',actor::text,true);
 PERFORM set_config('spieler.qa_targets',targets::text,true);
END $check$;
SET LOCAL ROLE service_role;
DO $check$
DECLARE actor uuid:=current_setting('spieler.qa_actor')::uuid; targets bigint[]:=current_setting('spieler.qa_targets')::bigint[];
 answer jsonb; received timestamptz; i integer;
BEGIN
 FOR i IN 1..3 LOOP
  answer:=public.spieler_request('hide',actor,targets[i]);
  IF answer->>'status'<>'hidden_pending_review' OR public.spieler_search(NULL,targets[i])<>'[]'::jsonb THEN RAISE EXCEPTION 'Immediate allowance failed'; END IF;
 END LOOP;
 answer:=public.spieler_request('hide',actor,targets[4]);
 IF answer->>'code' IS DISTINCT FROM 'hide_limit' OR answer->>'status' IS DISTINCT FROM 'pending_owner_review' THEN RAISE EXCEPTION 'Fourth request not queued'; END IF;
 IF jsonb_array_length(public.spieler_search(NULL,targets[4]))<>1 THEN RAISE EXCEPTION 'Fourth request hid the card'; END IF;
 SELECT created_at INTO received FROM public.spieler_opt_out WHERE user_id=actor AND fide_id=targets[4] AND status='pending_owner_review';
 IF received IS NULL THEN RAISE EXCEPTION 'Conflict request was not stored'; END IF;
 PERFORM public.spieler_request('hide',actor,targets[4]);
 IF (SELECT created_at FROM public.spieler_opt_out WHERE user_id=actor AND fide_id=targets[4]) IS DISTINCT FROM received THEN RAISE EXCEPTION 'Repeat changed receipt deadline'; END IF;
 PERFORM public.spieler_request('hide',actor,targets[1]);
 IF (SELECT count(*) FROM public.spieler_opt_out WHERE user_id=actor AND status='hidden_pending_review')<>3 THEN RAISE EXCEPTION 'Retry consumed another slot'; END IF;
 PERFORM public.spieler_request('claim',actor,targets[5]);
 PERFORM spieler_admin.review('claim',actor,targets[5],'approve');
 answer:=public.spieler_request('hide',actor,targets[5]);
 IF answer->>'status' IS DISTINCT FROM 'approved' OR public.spieler_search(NULL,targets[5])<>'[]'::jsonb THEN RAISE EXCEPTION 'Verified self-hide was limited'; END IF;
 IF (SELECT count(*) FROM public.spieler_opt_out WHERE user_id=actor AND status='hidden_pending_review')<>3 THEN RAISE EXCEPTION 'Verified self-hide consumed allowance'; END IF;
 PERFORM spieler_admin.review('hide',actor,targets[4],'confirm');
 IF public.spieler_search(NULL,targets[4])<>'[]'::jsonb THEN RAISE EXCEPTION 'Owner cannot confirm queued hide'; END IF;
 PERFORM spieler_admin.review('hide',actor,targets[4],'restore');
 IF jsonb_array_length(public.spieler_search(NULL,targets[4]))<>1 THEN RAISE EXCEPTION 'Owner restore failed'; END IF;
 answer:=public.spieler_request('hide',actor,targets[4]);
 IF answer->>'code' IS DISTINCT FROM 'hide_limit' THEN RAISE EXCEPTION 'Restored request bypassed full allowance'; END IF;
 PERFORM spieler_admin.review('hide',actor,targets[4],'restore');
 PERFORM spieler_admin.review('hide',actor,targets[1],'restore');
 answer:=public.spieler_request('hide',actor,targets[4]);
 IF answer->>'status' IS DISTINCT FROM 'hidden_pending_review' THEN RAISE EXCEPTION 'Released slot unavailable'; END IF;
END $check$;
RESET ROLE;
SELECT jsonb_build_object('fourth_hide_stored_without_suppression',true,'retry_idempotent',true,'receipt_preserved',true,
 'verified_self_hide_exempt',true,'queued_owner_confirm_restore',true,'restoration_releases_slot',true,'rollback',true) AS verified;
ROLLBACK;
