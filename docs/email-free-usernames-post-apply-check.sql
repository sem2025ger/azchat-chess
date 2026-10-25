-- Read only, counts only: must return legacy_remaining=0, rollback_log_rows=<preflight legacy_profiles>.
BEGIN READ ONLY;
SELECT
 (SELECT count(*) FROM public.profiles p
  WHERE p.username ~ ('^[A-Za-z0-9_]{1,30}_' || replace(p.id::text,'-','') || '$'))::integer AS legacy_remaining,
 (SELECT count(*) FROM private.username_backfill_log)::integer AS rollback_log_rows,
 (SELECT count(*) FROM private.username_backfill_log l
  JOIN public.profiles p ON p.id=l.user_id AND p.username=l.new_username)::integer AS verified_changed_rows;
ROLLBACK;
