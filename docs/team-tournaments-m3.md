# Team tournaments M3 — self-service NRW club events

**Status:** Work in progress, Draft PR #194. **DO NOT APPLY THE M3 MIGRATION OR DEPLOY THIS BRANCH.**

Base: PR #193, `feat/team-tournaments-m2-qa`, `b8d2cbe5fd3978108b35e90594b3997729707685`.
M1 and M2 command, round-robin, audit and UI are the compatibility baseline.

## Contract (owner-approved)

- Organizer creates a named event with Europe/Berlin start and registration deadline, 4 boards and 4 maximum teams by default, minimum 2 teams. Both wall times must resolve to **exactly one** Berlin instant; nonexistent spring-forward and duplicated autumn-back minutes are rejected.
- Organizer creates an unguessable single-use, revocable invitation per club. Store only SHA-256 token hashes. Redemption requires a signed-in ChessAZ user and creates exactly one captain entry for this event.
- Captain prepares a board-ordered list of registered users, with no substitutes. Previous event lineup is an *editable draft*. Each player personally consents before submission.
- **Only a complete submitted roster holds a spot.** A server-side event row lock must serialize capacity changes. Two submissions for one remaining spot cannot both succeed. Edits that remove required consent must release the spot until resubmission; withdrawal also releases it.
- Prior to the deadline spectators can see submitted club names and remaining places, **not board order or player identities**. Organizer, arbiter, captain and own-team players can see only their authorized private rosters. RLS and direct REST access must enforce the same boundary as UI.
- After the stored deadline, every read and command must run an idempotent, event-row-locked state transition. With at least the minimum submitted teams it locks rosters and publishes the full round robin with the existing `bergerSchedule` engine; otherwise it cancels. No in-process timers.
- One player reports 1 / ½ / 0 from the home card, the opponent confirms or disagrees; a matching pair is automatically confirmed, conflicting reports disputed. Captain can act for own team; no-show needs the other captain or staff decision. Each report, rejection, confirmation and decision has actor, role, timestamp and old/new values in audit.
- Organizer and arbiter can inspect all rounds/matches/boards and adjudicate with a reason. Correcting a confirmed board also requires a reason and audit. Results are explicitly sourced as player_report / captain / organizer_decision / arbiter, never online games.
- All pairings exist after publication. Current round advances only after **every board** in the preceding round is confirmed; no re-pairing.
- Existing `VITE_TEAM_TOURNAMENTS_ENABLED` and server-side flag remain default **OFF**. Keep the six languages, existing themes and responsive behavior.

## Current implementation — verified by code review, not acceptance tested

- Forward-only migration `supabase/migrations/20261106034400_team_tournaments_m3_foundation.sql`: tables for event configuration, token digests, captain entries and draft lineups; RLS foundation; atomic event creation using the existing M1 command. This migration is **incomplete** and is **not applied**.
- `server/teamTournamentTime.js`: server-side Berlin local-time round-trip validation, mirroring existing Spieltag behavior.
- `server/teamTournaments.js`: authenticated `POST /api/team-tournaments/self-service` accepts `name`, `start_time`, `registration_deadline`, `boards_per_team`, `min_teams`, `max_teams`; delegates to atomic service-held RPC. This endpoint is available only while the existing server feature flag is true. The M3 database RPC **must exist** before using it.
- `server/teamTournamentTime.test.js`, `server/teamTournamentM3Api.test.js`: focused time, auth, input and flag tests. Full database acceptance testing has **not** been performed.

## Not yet implemented — block release

- Invite creation/revocation/redemption and token delivery; lineup editing, previous draft and player consent; atomic submit/withdraw/capacity enforcement.
- Automatic publication/cancellation and a fully published M1 schedule under concurrency.
- Per-player reporting, captain substitution of actor, forfeits, disputes, source attribution and audit; user-JWT visibility and safe public responses.
- Home card, owner tournament UI, localized copy and the narrowly revised `clubs-nrw.test.mjs` homepage regression.
- Transactional PostgreSQL regression, REST/RPC penetration checks, clean security advisors, owner pilot, matching QA server and Vercel Preview.
- Do not assert the requested 5-for-4 capacity, 1/2/3-team transitions or round-advancement acceptance until tests run.

## Database and deployment safety

M1 migration is recorded in QA as `20261105225735_team_tournaments_m1` (repository filename `20261105221809_team_tournaments_m1.sql`).
Do not rename or edit that applied migration. M3 uses a *new* forward-only migration; review the QA migration ledger before applying, check `pg_constraint`, RLS, grants and migrations, and run isolated PostgreSQL tests first. A draft SQL file is not approval to deploy.

No writes to production Supabase `kmwfvvliundhuovoakoa`, production Render `chessaz-api` or production Vercel `azchat-chess`; no merge, no force push. The entire new workflow requires security and regression acceptance before enabling any QA feature flag.

## Proposed finish gate

1. Complete the transactional M3 commands and row-level permission model, with negative direct REST/RPC tests and 5-concurrent-captain integration test.
2. Implement an idempotent deadline transition, cancellation, Berger schedule and odd-team byes; test concurrent first reads and commands.
3. Implement signed player reports, captain proxy rules, staff adjudication and structured audit. Verify board-scoped permissions and round progression.
4. Integrate the existing Turniere tab, six-locale copy and responsive home card; revise exactly the homepage equality test while preserving flag-OFF equivalence.
5. Run full frontend, server and isolated PostgreSQL CI with zero skips, migration apply and rolled-back QA regression, security advisors and hosted pilot.
6. Publish final PR SHA, diff stat, per-job test counts, logs and matching Preview URL; keep Draft for owner review.
