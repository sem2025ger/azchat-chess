-- Read-only production migration preflight (counts only, no personally identifying values).
BEGIN READ ONLY;
WITH legacy AS (
  SELECT p.id, u.raw_user_meta_data->>'username' AS raw_name
  FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE p.username ~ ('^[A-Za-z0-9_]{1,30}_' || replace(p.id::text,'-','') || '$')
), normalized AS (
  SELECT id,
    CASE WHEN raw_name IS NULL OR position('@' IN raw_name)>0
      OR left(regexp_replace(btrim(raw_name), '[^A-Za-z0-9_]', '', 'g'),30) !~ '^[A-Za-z][A-Za-z0-9_]{2,29}$'
      OR lower(left(regexp_replace(btrim(raw_name), '[^A-Za-z0-9_]', '', 'g'),30)) IN (
        'admin','administrator','moderator','support','system','root',
        'null','undefined','anonymous','user','spieler','chessaz','schachtreff')
    THEN NULL
    ELSE left(regexp_replace(btrim(raw_name), '[^A-Za-z0-9_]', '', 'g'),30)
    END AS chosen
  FROM legacy
), grouped AS (
 SELECT *,row_number() OVER(PARTITION BY lower(chosen) ORDER BY id) AS occurrence
 FROM normalized
)
SELECT count(*)::integer AS legacy_profiles,
       count(*) FILTER (WHERE chosen IS NULL)::integer AS will_receive_spieler_number,
       count(*) FILTER (WHERE chosen IS NOT NULL AND
        (occurrence > 1 OR EXISTS(
          SELECT 1 FROM public.profiles p
          WHERE lower(p.username)=lower(grouped.chosen)
            AND p.id<>grouped.id
            AND NOT EXISTS (SELECT 1 FROM legacy l WHERE l.id=p.id)
        )))::integer AS will_need_collision_number
FROM grouped;
ROLLBACK;
