-- Schach-Treff username privacy remediation (reviewed revision).
-- Run against a verified target using: psql -X -v ON_ERROR_STOP=1 -f <file>
-- Apply to production ONLY after separate owner authorization and read-only preflight.
-- No username is ever derived from an email address or legacy username prefix.
-- Audit log may contain sensitive OLD usernames; never expose it in outputs or API.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.username_backfill_log (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  old_username text NOT NULL,
  new_username text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.username_backfill_log
  FROM PUBLIC, anon, authenticated, service_role;

-- Metadata entered by the user is allowed even if it coincides with the
-- email local part. Email is neither accepted nor consulted as a name source.
CREATE OR REPLACE FUNCTION private.safe_player_name(raw_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $body$
DECLARE
  candidate text;
BEGIN
  IF raw_name IS NULL OR position('@' IN raw_name) > 0 THEN
    RETURN NULL;
  END IF;
  candidate := left(
    pg_catalog.regexp_replace(pg_catalog.btrim(raw_name), '[^A-Za-z0-9_]', '', 'g'),
    30
  );
  IF candidate !~ '^[A-Za-z][A-Za-z0-9_]{2,29}$'
     OR pg_catalog.lower(candidate) IN (
       'admin', 'administrator', 'moderator', 'support', 'system', 'root',
       'null', 'undefined', 'anonymous', 'user', 'spieler',
       'chessaz', 'schachtreff'
     ) THEN
    RETURN NULL;
  END IF;
  RETURN candidate;
END;
$body$;

-- All allocator calls hold the same transaction advisory lock.
-- First free case-insensitive human-readable numeric suffix wins.
-- Max public username length is 30 characters, including the suffix.
CREATE OR REPLACE FUNCTION private.select_player_name(user_uuid uuid, raw_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  base_name text;
  candidate text;
  suffix_no bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(261025, 112);
  base_name := private.safe_player_name(raw_name);
  IF base_name IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE pg_catalog.lower(p.username) = pg_catalog.lower(base_name)
      AND p.id <> user_uuid
  ) THEN
    RETURN base_name;
  END IF;

  suffix_no := CASE WHEN base_name IS NULL THEN 1 ELSE 2 END;
  base_name := coalesce(base_name, 'spieler');
  LOOP
    IF pg_catalog.length(suffix_no::text) >= 28 THEN
      RAISE EXCEPTION 'Username suffix space exhausted'
        USING ERRCODE = 'unique_violation';
    END IF;
    candidate := pg_catalog.left(
      base_name, 30 - pg_catalog.length(suffix_no::text) - 1
    ) || '_' || suffix_no::text;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE pg_catalog.lower(p.username) = pg_catalog.lower(candidate)
        AND p.id <> user_uuid
    ) THEN
      RETURN candidate;
    END IF;
    suffix_no := suffix_no + 1;
  END LOOP;
END;
$body$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    private.select_player_name(
      NEW.id, NEW.raw_user_meta_data->>'username'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$body$;

REVOKE ALL ON FUNCTION private.safe_player_name(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.select_player_name(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;

-- QA previously installed the superseded overloads. Remove them only after
-- rebinding the trigger to the reviewed two-argument allocator.
DROP FUNCTION IF EXISTS private.select_player_name(uuid, text, text);
DROP FUNCTION IF EXISTS private.safe_player_name(text, text);

-- Hold the allocator lock for the entire backfill. Iterate only profiles whose
-- exact trailing UUID confirms the old generated-name format.
DO $body$
DECLARE
  legacy record;
  replacement text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(261025, 112);
  FOR legacy IN
    SELECT p.id, p.username, u.raw_user_meta_data
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.username ~ (
      '^[A-Za-z0-9_]{1,30}_' || pg_catalog.replace(p.id::text, '-', '') || '$'
    )
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    replacement := private.select_player_name(
      legacy.id, legacy.raw_user_meta_data->>'username'
    );
    INSERT INTO private.username_backfill_log (user_id, old_username, new_username)
    VALUES (legacy.id, legacy.username, replacement);
    UPDATE public.profiles
    SET username = replacement
    WHERE id = legacy.id AND username = legacy.username;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile changed during username backfill';
    END IF;
  END LOOP;
END;
$body$;

COMMIT;
