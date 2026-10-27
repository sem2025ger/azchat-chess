-- QA ONLY. Disposable fixtures and all assertions run in one rolled-back transaction.
-- Never run this against production; never print invitation tokens.
BEGIN;
DO $test$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); club uuid:=gen_random_uuid();
BEGIN
 PERFORM set_config('chessaz.qa_a',a::text,true);
 PERFORM set_config('chessaz.qa_b',b::text,true);
 PERFORM set_config('chessaz.qa_c',c::text,true);
 PERFORM set_config('chessaz.qa_club',club::text,true);
 INSERT INTO auth.users(id,raw_user_meta_data)
 SELECT id,jsonb_build_object('username','Qa'||replace(id::text,'-','')) FROM unnest(ARRAY[a,b,c]) id;
 INSERT INTO public.chess_clubs(id,slug,name,country_code,is_open)
 VALUES(club,'qa-'||replace(club::text,'-',''),'QA regression fixture','DE',true);
 INSERT INTO public.chess_club_members(club_id,user_id) VALUES(club,a),(club,b);
END $test$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE a uuid:=current_setting('chessaz.qa_a')::uuid; b uuid:=current_setting('chessaz.qa_b')::uuid;
 c uuid:=current_setting('chessaz.qa_c')::uuid; room uuid; token text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 BEGIN PERFORM public.club_player_summary(b); RAISE EXCEPTION 'outsider summary was exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF public.club_player_summary(c)->>'completed_games'<>'0' THEN RAISE EXCEPTION 'self summary failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 IF public.club_player_summary(b)->>'completed_games'<>'0' THEN RAISE EXCEPTION 'shared-club summary failed'; END IF;
 room:=public.create_club_room('QA private regression');
 PERFORM set_config('chessaz.qa_room',room::text,true);
 INSERT INTO public.chess_club_messages(club_id,author_id,body) VALUES(room,a,'QA members only');
 FOR n IN 1..10 LOOP
  token:=public.create_club_invite(room);
  IF token !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'invalid token shape'; END IF;
  IF n=1 THEN PERFORM set_config('chessaz.qa_token',token,true); END IF;
 END LOOP;
 BEGIN PERFORM public.create_club_invite(room); RAISE EXCEPTION 'eleventh invite was issued';
 EXCEPTION WHEN check_violation THEN IF SQLERRM<>'invite_limit' THEN RAISE; END IF; END;
 BEGIN PERFORM token_hash FROM public.chess_club_invites; RAISE EXCEPTION 'token hashes were exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 IF EXISTS(SELECT 1 FROM public.chess_clubs WHERE id=room)
 OR EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=room)
 OR EXISTS(SELECT 1 FROM public.chess_club_messages WHERE club_id=room) THEN RAISE EXCEPTION 'private room leaked'; END IF;
 BEGIN PERFORM public.create_club_invite(room); RAISE EXCEPTION 'outsider issued invite';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 FOR n IN 1..2 LOOP
  IF public.join_club_by_invite(current_setting('chessaz.qa_token'))<>room THEN RAISE EXCEPTION 'join failed'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.chess_club_messages WHERE club_id=room)<>1 THEN RAISE EXCEPTION 'joined member cannot read messages'; END IF;
END $test$;
RESET ROLE;
DO $test$
DECLARE a uuid:=current_setting('chessaz.qa_a')::uuid; b uuid:=current_setting('chessaz.qa_b')::uuid;
 club uuid:=current_setting('chessaz.qa_club')::uuid; stale uuid; live uuid; answer jsonb;
BEGIN
 IF (SELECT count(*) FROM public.chess_club_invites WHERE club_id=current_setting('chessaz.qa_room')::uuid)<>10 THEN RAISE EXCEPTION 'invite count incorrect'; END IF;
 IF (SELECT uses FROM public.chess_club_invites WHERE token_hash=encode(sha256(convert_to(current_setting('chessaz.qa_token'),'UTF8')),'hex'))<>1 THEN RAISE EXCEPTION 'join not idempotent'; END IF;
 IF EXISTS(SELECT 1 FROM public.chess_club_invites WHERE token_hash=current_setting('chessaz.qa_token')) THEN RAISE EXCEPTION 'plaintext token stored'; END IF;
 answer:=public.club_challenge_action('create',a,club,NULL,'3+2'); stale:=(answer->'challenge'->>'id')::uuid;
 PERFORM public.club_challenge_action('accept',b,club,stale);
 UPDATE public.chess_club_challenges SET accepted_at=now()-interval '3 minutes' WHERE id=stale;
 answer:=public.club_challenge_action('create',a,club,NULL,'5+0'); live:=(answer->'challenge'->>'id')::uuid;
 IF (SELECT status FROM public.chess_club_challenges WHERE id=stale)<>'expired' THEN RAISE EXCEPTION 'create did not clean stale acceptance'; END IF;
 PERFORM public.club_challenge_action('accept',b,club,live);
 UPDATE public.chess_club_challenges SET accepted_at=now()-interval '3 minutes',room_id=gen_random_uuid() WHERE id=live;
 answer:=public.club_challenge_action('create',a,club,NULL,'10+0'); stale:=(answer->'challenge'->>'id')::uuid;
 PERFORM public.club_challenge_action('accept',b,club,stale);
 UPDATE public.chess_club_challenges SET accepted_at=now()-interval '3 minutes' WHERE id=stale;
 PERFORM public.club_challenge_action('watch',a,club);
 IF (SELECT status FROM public.chess_club_challenges WHERE id=stale)<>'expired' THEN RAISE EXCEPTION 'watch did not clean stale acceptance'; END IF;
 IF (SELECT status FROM public.chess_club_challenges WHERE id=live)<>'accepted' THEN RAISE EXCEPTION 'live room acceptance expired'; END IF;
END $test$;
SET LOCAL ROLE anon;
DO $test$
BEGIN
 BEGIN PERFORM public.club_player_summary(current_setting('chessaz.qa_b')::uuid); RAISE EXCEPTION 'anon summary exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test$;
RESET ROLE;
SELECT jsonb_build_object('summary_outsider_42501',true,'summary_self_and_shared_club',true,
 'stale_create_and_watch_cleanup',true,'accepted_with_room_preserved',true,
 'private_room_isolation',true,'invite_cap_10',true,'invite_hash_acl',true,
 'invite_join_idempotent',true,'anon_denied',true,'fixture_transaction','rollback') AS verified;
ROLLBACK;
