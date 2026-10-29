# Main platform production readiness — read-only audit, 2026-10-29

Release target: `5345c9586a98b4926f1f92399b8b6664bc76d77a`. Independent of AI Coach PR #139. **Not ready for an immediate production rollout.** No settings, deployments, backups, migration history or schema were changed by this audit.

## Observed infrastructure

| Surface | Read-only observation |
| --- | --- |
| Vercel `azchat-chess` | Production build for `5345c95` is CANCELED (`dpl_8AQmtrsmYbVAHEB6iKmTn983wU4V`). Most recent READY production deployment is `4bffb946e13170558a92639bd5193afcd87f0eee` (`dpl_3zrwTbWGtwtEqVW7cfiQT4NfQphh`). Current custom-domain routing/actual served UI was not probed. |
| Render `chessaz-api` | `srv-d8hofg6q1p3s73dtl4o0`, main, Free, Oregon, autodeploy off. Latest live deploy is `58ae74b671312456314c17d59e1307a98e53fef2` (`dep-dbflucmq1p3s73fdmk7g`). Runtime health, env values and database binding were not probed. |
| Render QA | `chessaz-deutsch-qa-api`, Oregon, Free; tracked branch `feat/global-position-search-v1`, autodeploy on. This is not the PR #139 branch. |
| Production Supabase | `kmwfvvliundhuovoakoa`, eu-west-1, active. Catalog queries executed inside explicit READ ONLY transactions (`transaction_read_only = on`). Six migration-history rows. |
| QA Supabase | `iukmpcytsuofqhxsumbu`, eu-central-1, active. Archive count 14,979, read-only query. No QA writes. |

Existing owner-confirmed Render workspace is **My Workspace**, documented in `schach-treff-phase4-status.md`; discovery matched `tea-d7dfmdlckfvc73eq8ne0`. Resource reads used that explicit workspace; no session selection was changed.

## Migration reconciliation

Production history:

| Recorded version | Recorded name / corresponding repository file |
| --- | --- |
| 20261015232121 | production_bootstrap_private_trigger |
| 20261015232213 | add_fk_covering_indexes |
| 20261015232736 | restrict_browser_table_privileges |
| 20261024032143 | chessaz_deutsch_community_foundation; repository version 20261021000000 |
| 20261024032151 | chessaz_deutsch_tournament_calendar; repository version 20261022004847 |
| 20261025163216 | 20261025164000_schach_treff_private_usernames; repository version 20261025164000 |

Matching names are reconciliation candidates, not proof of identical SQL. Compare recorded statements and live objects before any history repair; repair changes tracking, not schema. Baseline/bootstrap files absent from this history must not be replayed blindly.

The code diff `4bffb94..5345c95` adds these 12 SQL files, in repository timestamp order:

1. `20261026140945_schach_treff_challenges.sql`
2. `20261026142707_schach_treff_private_rooms.sql`
3. `20261026145050_schach_treff_summary_and_challenge_recovery.sql`
4. `20261026145100_schach_treff_invite_limits.sql`
5. `20261026184317_spieler_v1.sql`
6. `20261026201936_spieler_review_privacy.sql`
7. `20261026210344_spieler_hide_abuse_limits.sql`
8. `20261026224500_clubs_nrw_v1.sql`
9. `20261027001000_spieler_clubs_nrw_fk.sql`
10. `20261027003816_spieltag_v1.sql`
11. `20261027015306_vorbereitung_v1.sql`
12. `20261027024137_vorbereitung_names_v1.sql`

Production catalog has none of the new Spieler, clubs_nrw, Spieltag or preparation tables, nor the new private-room tables. Existing eight `chess_club*` foundation/calendar tables have RLS enabled; the policy inventory was read, not a cross-user behavioral test. Also missing, although older than this diff: `durable_games`, `username_available(text)`, `set_club_pin(uuid,text)` and `chess_clubs.pinned_body`. Decide each older migration/feature dependency explicitly; durable activation is a separate gate.

Global Position Search uses typed in-memory position arrays built from `spieler_broadcast_games`; there is no SQL position-hash index migration in #137. Check source-table indexes, archive provenance/grants, import readiness, build duration/RSS and restart/warmup behavior instead. Newly created empty archive tables alone will not deliver model games. Production import needs an explicitly reviewed provenance/opt-out-aware plan; do not repoint the existing QA-only importer at production.

## Proposed rollout gates — not executed

1. Freeze the exact release SHA and preserve autodeploy off. Reconcile migration statements/live objects/history and all earlier missing dependencies. Build an explicit ordered manifest with checksums, expected locks, role grants and object postconditions. Do not run the repository migration directory wholesale.
2. Verify backup/PITR availability for the actual project plan. Obtain a restorable schema/data/role backup and test restoration in an isolated environment. Record restore point and release window; a backup without a demonstrated restore is insufficient. Do not assume a snapshot API exists or that an application rollback reverses database writes.
3. Rehearse the manifest against the restored production schema with the old deployed backend/frontend and the target release. Test RLS/grants with anon, two unrelated users, club members/moderators and the server role. Include private-room isolation, claim approval, hide requests, team isolation, and no source mixing in the position archive.
4. After separate owner release authorization, apply only the reviewed manifest while keeping feature flags disabled; verify migration history and SQL postconditions before backend rollout. Preserve old-contract compatibility. Do not modify production history in this preparation PR.
5. Drain/protect active games before replacing any backend process; normal HTTP readiness alone does not verify Socket.IO game continuity. Deploy the exact server SHA, validate CORS/auth/socket reconnect and API contracts, archive readiness and warm index. Verify configured non-secret env names and feature dependencies without logging secret values. Frankfurt service migration remains subject to the existing approved/proposed runbook and separate infrastructure authorization.
6. Deploy/promote the exact frontend SHA only after backend/database readiness. Smoke-test login, room creation/access, challenge acceptance, player search, public club filter, team permissions and matching-position analysis. Enable each approved feature separately. Do not reenable automatic production deployment merely to publish one release.
7. Rollback plan: preserve compatible prior frontend/backend artifacts and drain/fence active games as required. Prefer disabling new features/app rollback while retaining additive schema. Database restore requires its own impact assessment because it can discard post-backup writes; never use table drops or blind migration reversion as routine app rollback.

Remaining release gates include hosted end-to-end acceptance, legal/privacy pages, approved Frankfurt infrastructure and measured latency as already recorded in the project runbooks. No production launch or PR #139 merge is implied by this document.

Reference checked via Supabase docs: [database migrations and history reconciliation](https://supabase.com/docs/guides/deployment/database-migrations). Current hosted metadata must be rechecked immediately before a later authorized release.
