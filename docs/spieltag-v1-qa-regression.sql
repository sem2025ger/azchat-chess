-- QA ONLY iukmpcytsuofqhxsumbu; run only AFTER exact-head green CI and migration.
-- Existing profile IDs stay private. No auth users, tokens or lasting assignments.
BEGIN;
DO $fixture$
DECLARE people uuid[]; club uuid; team uuid; other_team uuid;
BEGIN
 SELECT array_agg(id) INTO people FROM (SELECT id FROM public.profiles ORDER BY id LIMIT 2) p;
 SELECT id INTO club FROM public.clubs_nrw WHERE published ORDER BY slug LIMIT 1;
 IF cardinality(people)<>2 OR club IS NULL THEN RAISE EXCEPTION 'QA fixture prerequisites missing'; END IF;
 INSERT INTO public.spieltag_teams(club_id,name) VALUES(club,'QA Spieltag '||substr(gen_random_uuid()::text,1,8)) RETURNING id INTO team;
 INSERT INTO public.spieltag_teams(club_id,name) VALUES(club,'QA Other Team '||substr(gen_random_uuid()::text,1,8)) RETURNING id INTO other_team;
 INSERT INTO public.spieltag_team_members(team_id,user_id,role) VALUES(team,people[1],'captain'),(team,people[2],'member');
 PERFORM set_config('spieltag.qa_captain',people[1]::text,true);
 PERFORM set_config('spieltag.qa_member',people[2]::text,true);
 PERFORM set_config('spieltag.qa_team',team::text,true);
 PERFORM set_config('spieltag.qa_other_team',other_team::text,true);
END $fixture$;
SET LOCAL ROLE authenticated;
DO $captain$
DECLARE actor uuid:=current_setting('spieltag.qa_captain')::uuid; match uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO public.spieltag_matches(team_id,round_label,opponent_name,starts_at,created_by,updated_by)
 VALUES(current_setting('spieltag.qa_team')::uuid,'QA Runde','QA Gastmannschaft','2026-11-08T10:00:00Z',actor,actor) RETURNING id INTO match;
 PERFORM set_config('spieltag.qa_match',match::text,true);
 INSERT INTO public.spieltag_boards(match_id,board_number,home_name,opponent_name,opponent_fide_id)
 VALUES(match,1,'QA Aufstellung','QA Gegner',13404431);
 UPDATE public.spieltag_boards SET result='1/2-1/2' WHERE match_id=match;
 UPDATE public.spieltag_matches SET notes='QA kurze Notiz',updated_by=actor WHERE id=match;
 BEGIN
  INSERT INTO public.spieltag_matches(team_id,round_label,opponent_name,starts_at,created_by,updated_by)
  VALUES(current_setting('spieltag.qa_other_team')::uuid,'Foreign','Forbidden team',now(),actor,actor);
  RAISE EXCEPTION 'Foreign captain write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.spieltag_matches SET team_id=current_setting('spieltag.qa_other_team')::uuid WHERE id=match;
  RAISE EXCEPTION 'Team reassignment allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.spieltag_boards SET board_number=2 WHERE match_id=match;
  RAISE EXCEPTION 'Board identity mutation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $captain$;
DO $member$
DECLARE actor uuid:=current_setting('spieltag.qa_member')::uuid; match uuid:=current_setting('spieltag.qa_match')::uuid; affected integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.spieltag_matches WHERE id=match AND notes='QA kurze Notiz')
 OR NOT EXISTS(SELECT 1 FROM public.spieltag_boards WHERE match_id=match AND result='1/2-1/2') THEN RAISE EXCEPTION 'Member read failed'; END IF;
 UPDATE public.spieltag_matches SET notes='Forbidden member edit',updated_by=actor WHERE id=match;
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>0 THEN RAISE EXCEPTION 'Member write allowed'; END IF;
 BEGIN INSERT INTO public.spieltag_boards(match_id,board_number,home_name) VALUES(match,2,'Forbidden');
  RAISE EXCEPTION 'Member board write allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.spieltag_team_members SET role='captain' WHERE user_id=actor;
  RAISE EXCEPTION 'Self promotion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 IF EXISTS(SELECT 1 FROM public.spieltag_matches WHERE id=match)
 OR EXISTS(SELECT 1 FROM public.spieltag_boards WHERE match_id=match)
 OR EXISTS(SELECT 1 FROM public.spieltag_teams WHERE id=current_setting('spieltag.qa_team')::uuid) THEN RAISE EXCEPTION 'Outsider private data exposure'; END IF;
END $member$;
RESET ROLE;
DELETE FROM public.spieltag_team_members WHERE team_id=current_setting('spieltag.qa_team')::uuid AND user_id=current_setting('spieltag.qa_captain')::uuid;
SET LOCAL ROLE authenticated;
DO $revoked$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',current_setting('spieltag.qa_captain'),true);
 IF EXISTS(SELECT 1 FROM public.spieltag_matches WHERE id=current_setting('spieltag.qa_match')::uuid)
 OR EXISTS(SELECT 1 FROM public.spieltag_boards WHERE match_id=current_setting('spieltag.qa_match')::uuid) THEN RAISE EXCEPTION 'Revoked membership still reads'; END IF;
END $revoked$;
SET LOCAL ROLE anon;
DO $anon$
BEGIN
 BEGIN PERFORM id FROM public.spieltag_matches;RAISE EXCEPTION 'Anonymous table access allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $anon$;
RESET ROLE;
SELECT jsonb_build_object('captain_schedule_lineup_results_notes',true,'member_read_only',true,
 'foreign_team_denied',true,'outsider_direct_id_and_child_rows_hidden',true,'self_promotion_denied',true,
 'identity_immutable',true,'revocation_immediate',true,'anon_denied',true,'rollback',true) AS verified;
ROLLBACK;
