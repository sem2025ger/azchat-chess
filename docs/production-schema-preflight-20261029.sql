-- Catalog-only checks. No application RPCs, writes, DDL, history repair or role switching.
-- Run inside BEGIN READ ONLY; confirm transaction_read_only = on; COMMIT afterwards.
-- Run before and after EACH separately authorized manifest step. Final target is main 5345c95.
-- Presence is necessary, not sufficient: inspect definitions and rehearse RLS with two users separately.
WITH expected(migration,kind,schema_name,parent_name,object_name) AS (VALUES
  ('20261026140945','column','public','chess_club_messages','kind'),
  ('20261026140945','index','public','chess_club_challenges','club_challenges_acceptor_idx'),
  ('20261026140945','index','public','chess_club_challenges','club_challenges_creator_idx'),
  ('20261026140945','index','public','chess_club_challenges','club_challenges_feed_idx'),
  ('20261026140945','index','public','chess_club_challenges','club_challenges_target_idx'),
  ('20261026140945','policy','public','chess_club_challenges','club_challenges_member_read'),
  ('20261026140945','table','public','','chess_club_challenges'),
  ('20261026142707','column','public','chess_clubs','created_by'),
  ('20261026142707','column','public','chess_clubs','kind'),
  ('20261026142707','function','private','','my_club_member(uuid)'),
  ('20261026142707','function','public','','create_club_room(text)'),
  ('20261026142707','function','public','','join_club_by_invite(text)'),
  ('20261026142707','index','public','chess_club_invites','club_invites_club_idx'),
  ('20261026142707','index','public','chess_club_invites','club_invites_creator_idx'),
  ('20261026142707','index','public','chess_clubs','club_rooms_creator_idx'),
  ('20261026142707','policy','public','chess_clubs','chess_clubs_member_read'),
  ('20261026142707','policy','public','chess_clubs','chess_clubs_public_read'),
  ('20261026142707','table','public','','chess_club_invites'),
  ('20261026145050','column','public','chess_club_challenges','accepted_at'),
  ('20261026145050','function','public','','club_challenge_action(text,uuid,uuid,uuid,text,uuid)'),
  ('20261026145050','function','public','','club_player_summary(uuid)'),
  ('20261026145100','function','public','','create_club_invite(uuid)'),
  ('20261026184317','index','public','spieler_claims','spieler_claim_fide_idx'),
  ('20261026184317','index','public','spieler_claims','spieler_verified_owner_idx'),
  ('20261026184317','index','public','spieler_players','spieler_surname_idx'),
  ('20261026184317','index','public','spieler_twic_games','spieler_twic_black_idx'),
  ('20261026184317','index','public','spieler_twic_games','spieler_twic_white_idx'),
  ('20261026184317','policy','public','spieler_claims','spieler_claim_owner_read'),
  ('20261026184317','policy','public','spieler_opt_out','spieler_opt_out_owner_read'),
  ('20261026184317','table','public','','spieler_claims'),
  ('20261026184317','table','public','','spieler_opt_out'),
  ('20261026184317','table','public','','spieler_players'),
  ('20261026184317','table','public','','spieler_twic_games'),
  ('20261026201936','column','public','spieler_claims','reviewed_at'),
  ('20261026201936','column','public','spieler_opt_out','reviewed_at'),
  ('20261026201936','function','spieler_admin','','review(text,uuid,bigint,text)'),
  ('20261026201936','index','public','spieler_opt_out','spieler_hidden_idx'),
  ('20261026201936','table','spieler_admin','','review_events'),
  ('20261026210344','index','public','spieler_opt_out','spieler_pending_hide_user_idx'),
  ('20261026224500','function','public','','clubs_nrw_editor(uuid,boolean)'),
  ('20261026224500','function','public','','clubs_nrw_immutable_identity_guard()'),
  ('20261026224500','function','public','','clubs_nrw_room_editor(uuid,uuid)'),
  ('20261026224500','index','public','clubs_nrw_calendar','clubs_nrw_calendar_by_date'),
  ('20261026224500','index','public','clubs_nrw_members','clubs_nrw_roster_idx'),
  ('20261026224500','policy','public','clubs_nrw','nrw_club_read'),
  ('20261026224500','policy','public','clubs_nrw_calendar','nrw_calendar_add'),
  ('20261026224500','policy','public','clubs_nrw_calendar','nrw_calendar_edit'),
  ('20261026224500','policy','public','clubs_nrw_calendar','nrw_calendar_read'),
  ('20261026224500','policy','public','clubs_nrw_calendar','nrw_calendar_remove'),
  ('20261026224500','policy','public','clubs_nrw_duels','nrw_duel_add'),
  ('20261026224500','policy','public','clubs_nrw_duels','nrw_duel_read'),
  ('20261026224500','policy','public','clubs_nrw_duels','nrw_duel_update'),
  ('20261026224500','policy','public','clubs_nrw_league_rows','nrw_league_add'),
  ('20261026224500','policy','public','clubs_nrw_league_rows','nrw_league_edit'),
  ('20261026224500','policy','public','clubs_nrw_league_rows','nrw_league_read'),
  ('20261026224500','policy','public','clubs_nrw_league_rows','nrw_league_remove'),
  ('20261026224500','policy','public','clubs_nrw_members','nrw_member_delete'),
  ('20261026224500','policy','public','clubs_nrw_members','nrw_member_insert'),
  ('20261026224500','policy','public','clubs_nrw_members','nrw_member_read'),
  ('20261026224500','policy','public','clubs_nrw_members','nrw_member_update'),
  ('20261026224500','policy','public','clubs_nrw_roles','nrw_role_self'),
  ('20261026224500','policy','public','clubs_nrw_room_links','nrw_room_add'),
  ('20261026224500','policy','public','clubs_nrw_room_links','nrw_room_read'),
  ('20261026224500','policy','public','clubs_nrw_room_links','nrw_room_remove'),
  ('20261026224500','table','public','','clubs_nrw'),
  ('20261026224500','table','public','','clubs_nrw_calendar'),
  ('20261026224500','table','public','','clubs_nrw_duels'),
  ('20261026224500','table','public','','clubs_nrw_league_rows'),
  ('20261026224500','table','public','','clubs_nrw_members'),
  ('20261026224500','table','public','','clubs_nrw_roles'),
  ('20261026224500','table','public','','clubs_nrw_room_links'),
  ('20261027001000','column','public','spieler_claims','club_id'),
  ('20261027001000','column','public','spieler_claims','club_legacy'),
  ('20261027001000','function','public','','spieler_request(text,uuid,bigint,text)'),
  ('20261027001000','function','public','','spieler_search(text,bigint)'),
  ('20261027003816','index','public','spieltag_boards','spieltag_boards_home_fide_idx'),
  ('20261027003816','index','public','spieltag_boards','spieltag_boards_opponent_fide_idx'),
  ('20261027003816','index','public','spieltag_matches','spieltag_matches_created_by_idx'),
  ('20261027003816','index','public','spieltag_matches','spieltag_matches_opponent_idx'),
  ('20261027003816','index','public','spieltag_matches','spieltag_matches_team_date_idx'),
  ('20261027003816','index','public','spieltag_matches','spieltag_matches_updated_by_idx'),
  ('20261027003816','index','public','spieltag_team_members','spieltag_members_user_idx'),
  ('20261027003816','policy','public','spieltag_boards','spieltag_board_delete'),
  ('20261027003816','policy','public','spieltag_boards','spieltag_board_insert'),
  ('20261027003816','policy','public','spieltag_boards','spieltag_board_read'),
  ('20261027003816','policy','public','spieltag_boards','spieltag_board_update'),
  ('20261027003816','policy','public','spieltag_matches','spieltag_match_delete'),
  ('20261027003816','policy','public','spieltag_matches','spieltag_match_insert'),
  ('20261027003816','policy','public','spieltag_matches','spieltag_match_read'),
  ('20261027003816','policy','public','spieltag_matches','spieltag_match_update'),
  ('20261027003816','policy','public','spieltag_team_members','spieltag_member_self'),
  ('20261027003816','policy','public','spieltag_teams','spieltag_team_read'),
  ('20261027003816','table','public','','spieltag_boards'),
  ('20261027003816','table','public','','spieltag_matches'),
  ('20261027003816','table','public','','spieltag_team_members'),
  ('20261027003816','table','public','','spieltag_teams'),
  ('20261027015306','column','public','spieltag_boards','opponent_lichess_username'),
  ('20261027024137','function','public','','preparation_candidates(text)'),
  ('20261027024137','function','public','','preparation_games(bigint,text,integer,integer)'),
  ('20261027024137','function','public','','preparation_name_key(text)'),
  ('20261027024137','index','public','spieler_broadcast_games','broadcast_black_fide_idx'),
  ('20261027024137','index','public','spieler_broadcast_games','broadcast_black_name_idx'),
  ('20261027024137','index','public','spieler_broadcast_games','broadcast_white_fide_idx'),
  ('20261027024137','index','public','spieler_broadcast_games','broadcast_white_name_idx'),
  ('20261027024137','table','public','','spieler_broadcast_games')
), checked AS (
 SELECT e.*, CASE kind
  WHEN 'table' THEN to_regclass(format('%I.%I',schema_name,object_name)) IS NOT NULL
  WHEN 'index' THEN EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class t ON t.oid=i.indrelid WHERE n.nspname=e.schema_name AND c.relname=e.object_name AND t.relname=e.parent_name AND i.indisvalid AND i.indisready)
  WHEN 'policy' THEN EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname=e.schema_name AND p.tablename=e.parent_name AND p.policyname=e.object_name)
  WHEN 'function' THEN to_regprocedure(schema_name||'.'||object_name) IS NOT NULL
  WHEN 'column' THEN EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema=e.schema_name AND c.table_name=e.parent_name AND c.column_name=e.object_name)
 END AS present FROM expected e
)
SELECT migration,kind,schema_name,parent_name,object_name,present FROM checked
ORDER BY migration,kind,schema_name,parent_name,object_name;

-- RLS, ACL and constraint definitions must match the reviewed final migrations.
SELECT n.nspname AS schema_name,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','spieler_admin') AND c.relkind IN ('r','p')
ORDER BY n.nspname,c.relname;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','spieler_admin')
ORDER BY schemaname,tablename,policyname;

SELECT n.nspname AS schema_name,t.relname AS table_name,c.conname,c.convalidated,
 pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
WHERE n.nspname IN ('public','spieler_admin') ORDER BY n.nspname,t.relname,c.conname;

-- Old dependencies must be resolved explicitly, not silently replayed.
SELECT to_regclass('public.durable_games') IS NOT NULL AS durable_games,
 to_regprocedure('public.username_available(text)') IS NOT NULL AS username_available,
 to_regprocedure('public.set_club_pin(uuid,text)') IS NOT NULL AS set_club_pin,
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
 AND table_name='chess_clubs' AND column_name='pinned_body') AS pinned_body;

-- History fingerprints aid comparison; they do not prove semantic SQL equivalence.
SELECT version,name,md5(array_to_string(statements,E'\n')) AS statements_md5
FROM supabase_migrations.schema_migrations ORDER BY version;
