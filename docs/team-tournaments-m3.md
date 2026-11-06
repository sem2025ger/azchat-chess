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

## Implemented on the Draft branch (not deployed)

- New forward-only `supabase/migrations/20261106034400_team_tournaments_m3_foundation.sql`: event configuration, hashed/revocable captain invites, captain entries, user-consented board-ordered lineups, concurrent capacity enforcement, deadline transition, private result reports, audited decisions and RLS. It modifies no applied M1 migrations and **has not been applied to QA**.
- `server/teamTournamentTime.js`: Berlin wall-time conversion that rejects DST overlaps/gaps; matching M1 Spieltag convention.
- `server/teamTournaments.js`: M3 endpoints for event creation, invites, redemption, lineup drafts, previous lineup, consent, submit/withdraw, bounded username lookup, current user board, signed reports, captain forfeit and organizer/arbiter decisions.
- Existing M1 Berger round-robin engine and M1 command transaction are reused for publication, not forked. Every deadline read/command uses an event row lock and idempotent state check.
- Existing Turniere UI has organizer and captain forms, roster search and consent flows, board-result view and dispute decisions. Home card is double-gated by `VITE_TEAM_TOURNAMENTS_ENABLED` and `VITE_TEAM_TOURNAMENTS_M3_ENABLED`. Backend M3 requires `TEAM_TOURNAMENTS_M3_ENABLED=true` in addition to the original tournament flag. **Both M3 flags default OFF.**
- `tmp/src/components/teamTournaments/copy.ts` extends the existing DE/EN/AZ/TR/UA/RU copy; `tmp/tests/clubs-nrw.test.mjs` removes only the precisely bounded M3 block before comparing the prior Home baseline byte-for-byte.

## Test evidence and remaining release blockers

- Intermediate Server CI `42157857391` (`421f8fe3`) completed **445/445 tests, 0 failures, 0 skips**. It covered 5 concurrent captains competing for 4 places, single-use tokens, player consent/role visibility, 1-team cancellation, 2-team publication, 3-team byes, concurrent deadline publication and audited reports/decisions/forfeits. A later commit added revoked-invite, anonymous-visibility and published-roster checks; its **new full CI must pass independently**.
- Intermediate frontend CI was green before later UI and API test changes. Do **not** infer current frontend or browser QA success from those earlier runs.
- Still required: latest frontend and server CI green with zero skips; direct hosted PostgREST/RPC checks of RLS; QA migration application and rolled-back regression; security advisor review; responsive browser inspection and full owner pilot with four captains and sixteen players.
- Particularly verify actual public-vs-private API payloads, the event's exact board count in editor, captain-driven forfeit confirmations, unresolved dispute highlighting and promotion to next round only after all boards are confirmed. Do not call these complete solely from static code review.
- Do not apply the M3 migration or enable any M3 flag before a full green CI run at a single commit. No production deployment or merge is authorized.

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
