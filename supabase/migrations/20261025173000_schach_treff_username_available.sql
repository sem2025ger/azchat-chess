-- Schach-Treff Phase 2: case-insensitive signup name availability.
-- The authoritative signup trigger from PR #113 still allocates the final name.
-- This check is advisory: two signups may race after checking.
BEGIN;

CREATE OR REPLACE FUNCTION public.username_available(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $body$
  SELECT
    p_name IS NOT NULL
    AND p_name ~ '^[A-Za-z][A-Za-z0-9_]{2,29}$'
    AND pg_catalog.lower(p_name) NOT IN (
      'admin', 'administrator', 'moderator', 'support', 'system', 'root',
      'null', 'undefined', 'anonymous', 'user', 'spieler',
      'chessaz', 'schachtreff'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE pg_catalog.lower(p.username) = pg_catalog.lower(p_name)
    );
$body$;

REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

COMMIT;
