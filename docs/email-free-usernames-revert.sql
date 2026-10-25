-- PRIVILEGED, OWNER-AUTHORIZED ROLLBACK ONLY.
-- Do not use after users may have changed their nickname. Fail closed if any
-- current value is different or an original name has been taken.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.username_backfill_log l
    LEFT JOIN public.profiles p ON p.id=l.user_id
    WHERE p.id IS NULL OR p.username IS DISTINCT FROM l.new_username
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: usernames changed since migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.username_backfill_log l
    JOIN public.profiles p ON p.id<>l.user_id
    WHERE lower(p.username)=lower(l.old_username)
  ) THEN
    RAISE EXCEPTION 'Rollback aborted: original username collision';
  END IF;
END;
$guard$;
UPDATE public.profiles p SET username=l.old_username
FROM private.username_backfill_log l
WHERE p.id=l.user_id AND p.username=l.new_username;
-- Keep private log until rollback verification; do not re-execute the
-- backfill without reviewing ledger state and trigger version.
COMMIT;
