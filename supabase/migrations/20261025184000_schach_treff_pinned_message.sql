-- Schach-Treff Phase 3: pinned club message. QA first; no production writes.
BEGIN;
ALTER TABLE public.chess_clubs
  ADD COLUMN pinned_body text CHECK (pinned_body IS NULL OR char_length(pinned_body) BETWEEN 1 AND 500),
  ADD COLUMN pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN pinned_at timestamptz;
CREATE OR REPLACE FUNCTION public.set_club_pin(p_club_id uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  cleaned text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.chess_club_members m
    WHERE m.club_id=p_club_id AND m.user_id=auth.uid() AND m.role IN ('admin','moderator')
  ) THEN
    RAISE EXCEPTION 'Only club moderators may change the pin' USING ERRCODE = '42501';
  END IF;
  cleaned := btrim(coalesce(p_body,''));
  IF char_length(cleaned)>500 THEN RAISE EXCEPTION 'Pin exceeds 500 characters' USING ERRCODE='22001'; END IF;
  UPDATE public.chess_clubs
    SET pinned_body=nullif(cleaned,''),
        pinned_by=CASE WHEN cleaned='' THEN NULL ELSE auth.uid() END,
        pinned_at=CASE WHEN cleaned='' THEN NULL ELSE now() END
    WHERE id=p_club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Club not found' USING ERRCODE = 'P0002'; END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.set_club_pin(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_club_pin(uuid,text) TO authenticated;
-- Pin contents are included in existing club SELECT under the existing RLS.
COMMIT;
