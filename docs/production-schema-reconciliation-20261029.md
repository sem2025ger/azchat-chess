# Production schema reconciliation — 2026-10-29 follow-up

Target code: main `5345c9586a98b4926f1f92399b8b6664bc76d77a`. Metadata-only inspection of production `kmwfvvliundhuovoakoa`, explicit READ ONLY, confirmed `transaction_read_only=on`. No schema/history/data/configuration changes.

## Observed differences

19 declared new tables, 27 explicitly declared indexes, 15 function signatures, and 9 added/renamed columns are absent. Of 35 final named policies, 34 are absent. `chess_clubs_public_read` exists with the **old** roles `{anon,authenticated}`; target private-room migration changes it to `{anon}` and adds member policy/helper. Existence alone is not acceptance. Implicit PK/UNIQUE indexes are additional requirements of their parent CREATE TABLE statements, not included in the 27 explicit indexes.

The exact expected object inventory and catalog SELECT checks are in [production-schema-preflight-20261029.sql](production-schema-preflight-20261029.sql). Run all sections before and after each separately authorized step inside an explicit READ ONLY transaction. They inspect RLS, ACLs, policies, constraints/validation and history. No application RPC is invoked. For function changes, separately compare `pg_get_functiondef` and execute privilege ACLs against the reviewed source; an existence check does not verify function semantics. Then run the existing role-based SQL regressions only in an isolated rehearsal database.

## Ordered matrix (proposed, not an executable migration manifest)

| Repository migration | Object scope | Risk and required rehearsal |
| --- | --- | --- |
| `20261026140945_schach_treff_challenges.sql` | 1 column; 4 index; 1 policy; 1 table | New challenge table/indexes; ALTER existing messages for kind (brief exclusive lock); review server RPC grants. |
| `20261026142707_schach_treff_private_rooms.sql` | 2 column; 3 function; 3 index; 2 policy; 1 table | New invites plus columns/FK/index on existing clubs; replaces/changes RLS policies; authorization semantics change. |
| `20261026145050_schach_treff_summary_and_challenge_recovery.sql` | 1 column; 2 function | Backfills accepted_at and validates CHECK; row writes and table scan/locks; rehearse before scheduling. |
| `20261026145100_schach_treff_invite_limits.sql` | 1 function | Replaces invite RPC and grants; no table creation; verify limits and concurrency. |
| `20261026184317_spieler_v1.sql` | 5 index; 2 policy; 4 table | New Spieler tables/indexes/owner-read policies and server-only RPCs. |
| `20261026201936_spieler_review_privacy.sql` | 2 column; 1 function; 1 index; 1 table | Creates private audit schema/table; changes opt-out constraint/default; UPDATE existing statuses and rebuilds partial index. |
| `20261026210344_spieler_hide_abuse_limits.sql` | 1 index | Updates opt-out statuses, replaces CHECK/default and RPC, adds partial index; scan/write/lock review. |
| `20261026224500_clubs_nrw_v1.sql` | 3 function; 2 index; 20 policy; 7 table | New NRW tables/indexes/RLS/triggers/RPCs; review authenticated grants and row ownership. |
| `20261027001000_spieler_clubs_nrw_fk.sql` | 2 column; 2 function | Renames claims.club to club_legacy and adds club_id FK; incompatible with old Spieler API clients unless gated. |
| `20261027003816_spieltag_v1.sql` | 7 index; 10 policy; 4 table | New team tables/indexes/RLS; explicit column UPDATE grants; validate isolation by team. |
| `20261027015306_vorbereitung_v1.sql` | 1 column | Adds opponent_lichess_username and CHECK/grant to boards; verify compatibility/validation scan. |
| `20261027024137_vorbereitung_names_v1.sql` | 3 function; 4 index; 1 table | New server-only broadcast archive/indexes and preparation RPCs; archive is initially empty; import separately approved. |

**Additive group:** newly introduced tables and their indexes can be prepared before exposing features, with final RLS/grants in the same reviewed transaction. They still require dependency/lock review. Existing files use plain CREATE/ALTER, not IF NOT EXISTS or CONCURRENTLY. Do not silently rewrite them or assume IF NOT EXISTS validates an existing object's shape. CREATE INDEX CONCURRENTLY cannot run inside these transaction-wrapped migrations; any online-index variant needs its own reviewed plan and invalid-index checks.

**History alignment group:** production versions `20261024032143`, `20261024032151`, `20261025163216` correspond by recorded name to repository versions `20261021000000`, `20261022004847`, `20261025164000`. Compare stored statements and complete objects before choosing reconciliation. Baseline files absent from history may already have objects; never replay or mark them applied based only on filenames. No repair SQL is authorized or included.

**Potential lock/compatibility group:** ALTER existing tables, CHECK validation, backfills, partial-index replacement, policy/RPC replacement and the claims column rename. Measure relation sizes and locks in rehearsal; select a maintenance window only if measured risk warrants it. Do not label the entire 12-file set safe additive.

Earlier unresolved dependencies remain `durable_games`, `username_available(text)`, `set_club_pin(uuid,text)` and `chess_clubs.pinned_body`. The preflight includes separate checks. Durable activation and old-contract compatibility require their existing release gates. No SQL position-hash index exists: Global Position Search builds an in-memory index from the public archive.

## Source checksums (SHA-256, byte-exact repository files)

- `20261026140945_schach_treff_challenges.sql`: `25ecab0e205537996926e3f3b3acb78a8e4698a42020e26e839f3a6e680c551d`
- `20261026142707_schach_treff_private_rooms.sql`: `067a19885e5cb4bc8c7ff4c1ab50a65d618fe6dbf9f9406d2cf149bed0ff98b4`
- `20261026145050_schach_treff_summary_and_challenge_recovery.sql`: `763db731696e5e499e836c417bbb48ec36c7af077b48e084c62fe6e3e1af0381`
- `20261026145100_schach_treff_invite_limits.sql`: `2efcf3425ceb9576f6ec1a2f316f596774921d018b0781727725033499721f4c`
- `20261026184317_spieler_v1.sql`: `07c1a60a242df87f04bcef1d0f942161b4b4a85deaebfcffbd7bae7007478ef7`
- `20261026201936_spieler_review_privacy.sql`: `da6a5bede6e3e7970988bb1cab34ca9b80b1d5dae944a2bfcb8262f22164fa23`
- `20261026210344_spieler_hide_abuse_limits.sql`: `bcc454c27f414ec2bcf043266c2d434afd5b2ec6db7af32c4005e82d97e2caa2`
- `20261026224500_clubs_nrw_v1.sql`: `3901f2f145721b9365dc89d8c96ea104b4f7bc433ce9a2252ff45837ef14348d`
- `20261027001000_spieler_clubs_nrw_fk.sql`: `aae9f2a9400a2e7149f05da3e90ea6d294ec861886e83a404de8ce0518eedf2c`
- `20261027003816_spieltag_v1.sql`: `24360944439cd0db99902f1f8c73d3ee9273db643000f5e959be20ac5972ccc9`
- `20261027015306_vorbereitung_v1.sql`: `38bcc79efcc80ff768b6265b7aad1912dd04a3494dc5ba915f2b112b8742d3dc`
- `20261027024137_vorbereitung_names_v1.sql`: `a791aaf9f3fcd30243bbaeb42118ff2f2ad5382915629cf5ef09c30974d1c861`

Checksums freeze source inputs, not proof of equality to production migration statements. Approval requires restorable backup/rehearsal, exact forward manifest, privacy/role tests, backend/frontend compatibility, active-game continuity and independent release authorization. See [production readiness](production-readiness-20261029.md).
