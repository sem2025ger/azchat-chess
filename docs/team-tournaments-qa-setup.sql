-- Owner only. Open the SQL Editor for QA project iukmpcytsuofqhxsumbu.
-- Replace the UUID placeholder with the ID of the approved QA organizer.
-- This grants tournament creation to one existing QA profile.
BEGIN;

DO $setup$
DECLARE
  organizer_id constant uuid := '<ORGANIZER_USER_UUID>';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = organizer_id) THEN
    RAISE EXCEPTION 'The organizer must already have a profile in this QA project';
  END IF;
  INSERT INTO public.team_tournament_organizers(user_id)
  VALUES (organizer_id)
  ON CONFLICT (user_id) DO NOTHING;
END
$setup$;

SELECT user_id FROM public.team_tournament_organizers WHERE user_id = '<ORGANIZER_USER_UUID>'::uuid;

COMMIT;
