BEGIN;
CREATE OR REPLACE FUNCTION public.create_club_invite(p_club_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE plain text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.chess_club_members m JOIN public.chess_clubs c ON c.id=m.club_id
  WHERE m.club_id=p_club_id AND m.user_id=auth.uid() AND m.role IN ('admin','moderator') AND c.kind='room') THEN
  RAISE EXCEPTION 'not_allowed' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_club_id::text,2));
 IF (SELECT count(*) FROM public.chess_club_invites WHERE club_id=p_club_id AND expires_at>now() AND uses<max_uses)>=10 THEN
  RAISE EXCEPTION 'invite_limit' USING ERRCODE='23514'; END IF;
 plain:=encode(extensions.gen_random_bytes(16),'hex');
 INSERT INTO public.chess_club_invites(club_id,created_by,token_hash) VALUES(p_club_id,auth.uid(),encode(sha256(convert_to(plain,'UTF8')),'hex'));
 RETURN plain;
END $fn$;
REVOKE ALL ON FUNCTION public.create_club_invite(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_club_invite(uuid) TO authenticated;
COMMIT;
