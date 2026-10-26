# Schach-Treff phase 4 — implementation, QA and review gates

## Applied QA state

The original challenge migration **is installed on QA** (`iukmpcytsuofqhxsumbu`), recorded as `20261026142732 / schach_treff_challenges`. Repository source: `20261026140945_schach_treff_challenges.sql`, SHA-256 `25ecab0e205537996926e3f3b3acb78a8e4698a42020e26e839f3a6e680c551d`. The applied file remains unchanged; review fixes use forward migrations.

Review-fix CI passed on `6a4fd55`: Server **151/151**, Frontend **135/135**, zero skipped tests. Server CI includes isolated real PostgreSQL concurrency, membership, expiry, limit and grant checks, plus the real Socket.IO single-limiter regression. Frontend build/typecheck passed; lint has zero errors and 57 existing warnings.

The authorized retry succeeded on 2026-10-26. Actual QA migration history:

| Repository source | Assigned QA version | Result |
| --- | --- | --- |
| `20261026145050_schach_treff_summary_and_challenge_recovery.sql` | `20261026150625` | Installed; self/shared-club summary and stale acceptance recovery |
| `20261026142707_schach_treff_private_rooms.sql` | `20261026152003` | Installed; private rooms and hashed invites |
| `20261026145100_schach_treff_invite_limits.sql` | `20261026152016` | Installed; ten active invites per room |

The challenge original remains unchanged (hash above). The private-room original also remains unchanged: SHA-256 `067a19885e5cb4bc8c7ff4c1ab50a65d618fe6dbf9f9406d2cf149bed0ff98b4`. It was absent from QA before the successful retry and is now applied there; all later corrections require forward migrations. No claim is made about an uninspected environment.

Hosted QA post-application assertions passed using `docs/qa-review-regression-2026-10-26.sql`: outsider summary raises `42501`; self/shared-club reads work; both create/watch expire stranded accepted rows; accepted rows with a room survive; private room/roster/messages are hidden from outsiders; invite hashes are inaccessible; the eleventh active invite is rejected; joining twice consumes one use. The transaction was rolled back. A fresh read found zero fixture users/rooms, with the original three profiles and zero matches preserved. These are database integration checks, not the step-4 hosted backend tests.

## Claude review corrections

1. **Player-summary access:** the applied forward migration restricts `club_player_summary(p_user)` to the caller's own identity or a target sharing at least one club. CI and hosted QA assertions verified outsider `42501`, self access and shared-club access.
2. **Durable hosted acceptance:** still outstanding. QA durable schema is installed as `20261026135741`; database-role ACL/start/retry/result-compaction checks passed and were rolled back. These are **not** hosted PostgREST recovery/retry or backend-region latency evidence. Step 4 of `docs/launch-readiness-2026-10-26.md` remains mandatory. The owner approved an Oregon baseline for hosted recovery/retry correctness; warm p50/p95 are reference values only. The launch gate remains at least 50 real move transitions with p95 <= 300 ms and must be rerun after the backend moves to Frankfurt. No production activation request may be made before the launch gate passes.
3. **One acceptor limiter check:** the challenge command checks the socket limiter before DB access. Only its internal bridge may call the existing private-join function with that check already completed. Public socket payloads cannot supply this internal argument. A real Socket.IO regression verifies one check with only one remaining permit and rejects a public payload attempting to bypass the limiter. Chess/clock/durable startup logic is preserved.
4. **Crash-stranded acceptance:** forward migration adds `accepted_at`, writes it atomically on acceptance and expires accepted rows older than two minutes when `room_id IS NULL`. `watch`/`create` perform lazy cleanup; the desktop poll invokes `watch` regularly. Tests preserve accepted rows that already have a game room.
5. **Invite cap:** a separate forward migration limits a room to ten unexpired, not-fully-used invitations under a per-room transaction lock. A concurrent DB test requires exactly ten successes and rejects excess issuance. Hashing, fourteen-day expiry, membership checks and idempotent joins remain intact.
6. This document now records the actual applied QA challenge migration and separates prepared fixes from verified/application status.
7. **Before launch:** production Supabase Auth leaked-password protection is reported disabled. Enabling it requires explicit owner approval; no Auth configuration change was made here.

## Scope and remaining gates

Challenges are unrated. The module reuses the existing private-game path and its durable acknowledgement before `match_found`; no second chess engine or time-control allowlist change is introduced. Existing mobile community and navigation tests remain unmodified, and challenge bodies remain plain text on mobile.

The branch is Draft and unmerged. Review-fix PostgreSQL CI and the three QA migrations are complete. Hosted server-to-Supabase acceptance and complete desktop/mobile visual evidence remain required. Do not infer those results from SSR, fakes, role checks or loopback CI. Later location/weekly-position work is separate. Live Glicko-2 remains inactive.

## Step-4 geography and deployment boundary

| Component | Verified region / plan |
| --- | --- |
| QA Supabase `iukmpcytsuofqhxsumbu` | `eu-central-1` (Frankfurt) |
| Production Supabase `kmwfvvliundhuovoakoa` | `eu-west-1` (Ireland) |
| QA Render `chessaz-deutsch-qa-api` | Oregon / Free |
| Production Render `chessaz-api` | Oregon / Free |

Render workspace: owner-confirmed **My Workspace**. The existing QA service is live on commit `3032afe574a7cf04e92b51536d1448a62a5d8eee`, from `feature/chessaz-deutsch-club-foundation`; it does not yet run the reviewed PR branch. Its configured Supabase project ref has **not yet been verified**. The available Render connector exposes service/deploy reads and env writes, but no environment read or branch update; no authenticated CLI/API credential is configured locally. Do not infer database binding from the QA service name. If its configured ref is production, stop immediately.

Owner subsequently approved `DURABLE_ACTIVE_GAMES=true` and deployment of the reviewed branch **only on this existing QA service**, Free plan, zero cost, after binding verification. No Render mutation has been performed. Oregon results must be labeled **Oregon baseline**, report warm-request p50/p95 separately and exclude the first cold start after Free sleep. They are reference-only, not the launch latency gate. Backend migration to Frankfurt must precede launch, followed by the 50-move/p95 <= 300 ms launch gate. Production Supabase stays in `eu-west-1`; no database relocation is proposed. Prepare the Render migration proposal (steps, exact monthly cost, downtime, frontend URL/CORS/DNS changes and rollback) without executing it.

Production database/configuration, production durable activation and maintenance mode remain untouched and require explicit owner approval. Leaked-password protection remains an owner-controlled launch gate. QA advisory warnings about intended authenticated SECURITY DEFINER RPCs and server-only RLS tables are not proof of missing authorization; the actual grants and role assertions above are the evidence.
