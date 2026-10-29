-- QA iukmpcytsuofqhxsumbu only, after green exact-head CI and migration.
-- Synthetic source fixture; no persisted mutations.
BEGIN;
DO $$
DECLARE records jsonb;
BEGIN
 IF has_table_privilege('anon','public.spieler_broadcast_games','SELECT') OR has_table_privilege('authenticated','public.spieler_broadcast_games','SELECT') THEN RAISE EXCEPTION 'raw table is exposed'; END IF;
 IF has_function_privilege('authenticated','public.preparation_games(bigint,text,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'RPC is exposed'; END IF;
 INSERT INTO public.spieler_broadcast_games(id,source_month,source_url,license_url,pgn,white_name,black_name,white_key,black_key,white_fide_id)
 VALUES(repeat('a1',32),'2026-09','https://database.lichess.org/broadcast/lichess_db_broadcast_2026-09.pgn.zst','https://creativecommons.org/licenses/by-sa/4.0/','[Event "QA fixture"]
[White "QA Fixture, Preparation"]
[Black "Other, Fixture"]
[Result "1-0"]

1. e4 c5 1-0','QA Fixture, Preparation','Other, Fixture','qa fixture, preparation','other, fixture',9876543210);
 INSERT INTO public.spieler_broadcast_games SELECT repeat('b2',32),source_month,source_url,license_url,pgn,white_name,black_name,white_key,black_key,NULL,black_fide_id,event,game_date,eco,opening,time_control FROM public.spieler_broadcast_games WHERE id=repeat('a1',32);
 records:=public.preparation_games(9876543210,NULL,0,500);
 IF jsonb_array_length(records)<>2 OR (SELECT count(*) FROM jsonb_array_elements(records) r WHERE r->>'link_basis'='fide_id')<>1 OR (SELECT count(*) FROM jsonb_array_elements(records) r WHERE r->>'link_basis'='name')<>1 THEN RAISE EXCEPTION 'FIDE/fallback failure'; END IF;
 IF public.preparation_games(NULL,'QA Fixture, Different',0,500)<>'[]'::jsonb THEN RAISE EXCEPTION 'non-exact fallback'; END IF;
END $$;
ROLLBACK;
