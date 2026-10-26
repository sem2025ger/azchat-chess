# Schach-Treff phase 4 — implementation, QA and review gates

## Applied QA state

The original challenge migration **is installed on QA** (`iukmpcytsuofqhxsumbu`), recorded as `20261026142732 / schach_treff_challenges`. Repository source: `20261026140945_schach_treff_challenges.sql`, SHA-256 `25ecab0e205537996926e3f3b3acb78a8e4698a42020e26e839f3a6e680c551d`. The applied file remains unchanged; review fixes use forward migrations.

Phase 4 Frontend and Server CI passed on `3f3b448`, including isolated real PostgreSQL concurrency, membership, expiry, limit and grant tests. The private-room phase passed CI on `5f05cc7`, but its QA migration attempt returned an expired request-state error; a subsequent read confirmed its tables/columns were absent. Do not report that attempt as successful installation.

## Claude review corrections

1. **Player-summary access:** forward migration restricts `club_player_summary(p_user)` to the caller's own identity or a target sharing at least one club. An outsider must receive `42501`. The DB regression covers outsider denial, self access and shared-club access. This correction must pass CI and be applied to QA before phase-4 merge.
2. **Durable hosted acceptance:** still outstanding. QA durable schema is installed as `20261026135741`; database-role ACL/start/retry/result-compaction checks passed and were rolled back. These are **not** hosted PostgREST recovery/retry or backend-region latency evidence. Step 4 of `docs/launch-readiness-2026-10-26.md` remains mandatory: real hosted recovery/retry scenarios and at least 50 move transitions originating in the backend region, p95 <= 300 ms. No activation request may be made before that passes.
3. **One acceptor limiter check:** the challenge command checks the socket limiter before DB access. Only its internal bridge may call the existing private-join function with that check already completed. Public socket payloads cannot supply this internal argument. A real Socket.IO regression verifies one check with only one remaining permit and rejects a public payload attempting to bypass the limiter. Chess/clock/durable startup logic is preserved.
4. **Crash-stranded acceptance:** forward migration adds `accepted_at`, writes it atomically on acceptance and expires accepted rows older than two minutes when `room_id IS NULL`. `watch`/`create` perform lazy cleanup; the desktop poll invokes `watch` regularly. Tests preserve accepted rows that already have a game room.
5. **Invite cap:** a separate forward migration limits a room to ten unexpired, not-fully-used invitations under a per-room transaction lock. A concurrent DB test requires exactly ten successes and rejects excess issuance. Hashing, fourteen-day expiry, membership checks and idempotent joins remain intact.
6. This document now records the actual applied QA challenge migration and separates prepared fixes from verified/application status.
7. **Before launch:** production Supabase Auth leaked-password protection is reported disabled. Enabling it requires explicit owner approval; no Auth configuration change was made here.

## Scope and remaining gates

Challenges are unrated. The module reuses the existing private-game path and its durable acknowledgement before `match_found`; no second chess engine or time-control allowlist change is introduced. Existing mobile community and navigation tests remain unmodified, and challenge bodies remain plain text on mobile.

The branch is Draft and unmerged. Review-fix PostgreSQL CI, forward-migration QA application, hosted server-to-Supabase acceptance and complete desktop/mobile visual evidence are required. Do not infer those results from SSR, fakes, role checks or loopback CI. Private rooms are prepared; later location/weekly-position work is separate. Live Glicko-2 remains inactive.

No production database changes, DURABLE_ACTIVE_GAMES activation or maintenance-mode changes are authorized by this QA work.
