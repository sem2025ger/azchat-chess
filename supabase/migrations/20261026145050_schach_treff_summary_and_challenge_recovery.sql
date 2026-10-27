-- Forward-only review fix; the original applied Phase 4 SQL remains unchanged.
BEGIN;
ALTER TABLE public.chess_club_challenges ADD COLUMN accepted_at timestamptz;
UPDATE public.chess_club_challenges SET accepted_at=now() WHERE status='accepted';
ALTER TABLE public.chess_club_challenges ADD CONSTRAINT accepted_challenge_has_timestamp CHECK(status<>'accepted' OR accepted_at IS NOT NULL);
CREATE OR REPLACE FUNCTION public.club_challenge_action(p_action text,p_actor uuid,p_club uuid DEFAULT NULL,
 p_challenge uuid DEFAULT NULL,p_time text DEFAULT NULL,p_target uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE r public.chess_club_challenges%ROWTYPE; message uuid;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 IF p_action IN ('create','watch') THEN
  IF NOT EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=p_club AND user_id=p_actor) THEN
   RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
  UPDATE public.chess_club_challenges SET status='expired' WHERE club_id=p_club AND status='open' AND expires_at<=now();
  UPDATE public.chess_club_challenges SET status='expired' WHERE club_id=p_club AND status='accepted' AND room_id IS NULL AND accepted_at<=now()-interval '2 minutes';
  IF p_action='watch' THEN RETURN jsonb_build_object('ok',true); END IF;
  IF p_time IS NULL OR p_time NOT IN ('3+2','5+0','10+0') THEN RAISE EXCEPTION 'invalid_time_control' USING ERRCODE='22023'; END IF;
  IF p_target IS NOT NULL AND (p_target=p_actor OR NOT EXISTS(
   SELECT 1 FROM public.chess_club_members WHERE club_id=p_club AND user_id=p_target)) THEN
   RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));
  IF (SELECT count(*) FROM public.chess_club_challenges WHERE created_by=p_actor AND status='open' AND expires_at>now())>=3 THEN
   RAISE EXCEPTION 'challenge_limit' USING ERRCODE='23514'; END IF;
  INSERT INTO public.chess_club_messages(club_id,author_id,kind,body) VALUES(p_club,p_actor,'challenge','Herausforderung '||p_time) RETURNING id INTO message;
  INSERT INTO public.chess_club_challenges(club_id,message_id,created_by,target_user_id,time_control)
   VALUES(p_club,message,p_actor,p_target,p_time) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.chess_club_challenges WHERE id=p_challenge FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=r.club_id AND user_id=p_actor) THEN
   RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
  IF r.status='open' AND r.expires_at<=now() THEN
   UPDATE public.chess_club_challenges SET status='expired' WHERE id=r.id RETURNING * INTO r;
  END IF;
  IF p_action='accept' THEN
   IF r.status<>'open' THEN RETURN jsonb_build_object('ok',false,'code',CASE WHEN r.status='expired' THEN 'expired' ELSE 'already_taken' END); END IF;
   IF r.created_by=p_actor OR (r.target_user_id IS NOT NULL AND r.target_user_id<>p_actor) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.chess_club_members WHERE club_id=r.club_id AND user_id=r.created_by) THEN
    RAISE EXCEPTION 'not_member' USING ERRCODE='42501'; END IF;
   UPDATE public.chess_club_challenges SET status='accepted',accepted_by=p_actor,accepted_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSIF p_action='cancel' THEN
   IF r.created_by<>p_actor THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
   IF r.status='open' THEN UPDATE public.chess_club_challenges SET status='cancelled' WHERE id=r.id RETURNING * INTO r; END IF;
  ELSE RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'challenge',to_jsonb(r));
END $fn$;
REVOKE ALL ON FUNCTION public.club_challenge_action(text,uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.club_challenge_action(text,uuid,uuid,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.club_player_summary(p_user uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE answer jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_user IS NULL OR (auth.uid()<>p_user AND NOT EXISTS(
  SELECT 1 FROM public.chess_club_members caller JOIN public.chess_club_members target ON target.club_id=caller.club_id
  WHERE caller.user_id=auth.uid() AND target.user_id=p_user
 )) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('completed_games',(SELECT count(*) FROM public.matches WHERE status='completed' AND (white_id=p_user OR black_id=p_user)),
 'last_games',coalesce((SELECT jsonb_agg(g.value ORDER BY g.completed_at DESC,g.id) FROM(
  SELECT m.id,m.completed_at,jsonb_build_object('opponent',p.username,'time_control',m.time_control,'result',m.result,'color',CASE WHEN m.white_id=p_user THEN 'w' ELSE 'b' END) AS value
  FROM public.matches m LEFT JOIN public.profiles p ON p.id=CASE WHEN m.white_id=p_user THEN m.black_id ELSE m.white_id END
  WHERE m.status='completed' AND (m.white_id=p_user OR m.black_id=p_user)
  ORDER BY m.completed_at DESC,m.id LIMIT 3) g),'[]'::jsonb)) INTO answer;
 RETURN answer;
END $fn$;
REVOKE ALL ON FUNCTION public.club_player_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.club_player_summary(uuid) TO authenticated;
COMMIT;
