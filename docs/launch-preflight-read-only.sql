-- Review/preflight only. Run against the explicitly selected QA or production project.
-- No migration history repair, bootstrap replay, writes, secrets or personal rows.
BEGIN READ ONLY;
SELECT pg_catalog.json_build_object(
  'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
  'profiles_count', (SELECT count(*) FROM public.profiles),
  'completed_matches_count', (SELECT count(*) FROM public.matches WHERE status = 'completed'),
  'durable_table_exists', pg_catalog.to_regclass('public.durable_games') IS NOT NULL,
  'durable_rpc_exists', pg_catalog.to_regprocedure('public.durable_game_transition(text,uuid,uuid,uuid,bigint,bigint,uuid,jsonb)') IS NOT NULL,
  'username_rpc_exists', pg_catalog.to_regprocedure('public.username_available(text)') IS NOT NULL,
  'pin_rpc_exists', pg_catalog.to_regprocedure('public.set_club_pin(uuid,text)') IS NOT NULL,
  'pin_column_count', (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chess_clubs'
      AND column_name IN ('pinned_body', 'pinned_by', 'pinned_at')
  ),
  'durable_rls_enabled', (
    SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid = pg_catalog.to_regclass('public.durable_games')
  ),
  'durable_browser_table_access', CASE
    WHEN pg_catalog.to_regclass('public.durable_games') IS NULL THEN NULL
    ELSE pg_catalog.has_table_privilege('anon', 'public.durable_games', 'SELECT,INSERT,UPDATE,DELETE')
      OR pg_catalog.has_table_privilege('authenticated', 'public.durable_games', 'SELECT,INSERT,UPDATE,DELETE')
    END,
  'durable_browser_rpc_access', CASE
    WHEN pg_catalog.to_regprocedure('public.durable_game_transition(text,uuid,uuid,uuid,bigint,bigint,uuid,jsonb)') IS NULL THEN NULL
    ELSE pg_catalog.has_function_privilege('anon', 'public.durable_game_transition(text,uuid,uuid,uuid,bigint,bigint,uuid,jsonb)', 'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated', 'public.durable_game_transition(text,uuid,uuid,uuid,bigint,bigint,uuid,jsonb)', 'EXECUTE')
    END,
  'recorded_migrations', (
    SELECT pg_catalog.json_agg(pg_catalog.json_build_object('version', version, 'name', name) ORDER BY version)
    FROM supabase_migrations.schema_migrations
  )
) AS preflight;
COMMIT;
