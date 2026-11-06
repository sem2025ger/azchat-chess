# Team tournaments M3 — self-service NRW club events

**Status:** Draft PR #194, QA database migration applied and regression checked. **DO NOT MERGE OR DEPLOY TO PRODUCTION; M3 flags remain OFF.**

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

## Implemented in Draft branch (QA database only; backend pilot not deployed)

- New forward-only `supabase/migrations/20261106034400_team_tournaments_m3_foundation.sql`: event configuration, hashed/revocable captain invites, captain entries, user-consented board-ordered lineups, concurrent capacity enforcement, deadline transition, private result reports, audited decisions and RLS. It modifies no applied M1 migrations. **QA migration version: `20261106040436_team_tournaments_m3_foundation`**, applied only to project `iukmpcytsuofqhxsumbu`; no new M3 events remain.
- `server/teamTournamentTime.js`: Berlin wall-time conversion that rejects DST overlaps/gaps; matching M1 Spieltag convention.
- `server/teamTournaments.js`: M3 endpoints for event creation, invites, redemption, lineup drafts, previous lineup, consent, submit/withdraw, bounded username lookup, current user board, signed reports, captain forfeit and organizer/arbiter decisions.
- Existing M1 Berger round-robin engine and M1 command transaction are reused for publication, not forked. Every deadline read/command uses an event row lock and idempotent state check.
- Existing Turniere UI has organizer and captain forms, roster search and consent flows, board-result view and dispute decisions. Home card is double-gated by `VITE_TEAM_TOURNAMENTS_ENABLED` and `VITE_TEAM_TOURNAMENTS_M3_ENABLED`. Backend M3 requires `TEAM_TOURNAMENTS_M3_ENABLED=true` in addition to the original tournament flag. **Both M3 flags default OFF.**
- `tmp/src/components/teamTournaments/copy.ts` extends the existing DE/EN/AZ/TR/UA/RU copy; `tmp/tests/clubs-nrw.test.mjs` removes only the precisely bounded M3 block before comparing the prior Home baseline byte-for-byte.

## Test evidence — 2026-11-06

- Reviewed SHA `84b85bc84248dbbd62d5ffd76a6225bb6832949e`: **Frontend CI 263/263**, **Server CI 446/446**, **isolated PostgreSQL regression 446/446**. All three report zero failures and zero skips. Workflow runs: [Frontend CI](https://github.com/sem2025ger/azchat-chess/actions/runs/42159800308), [Server CI](https://github.com/sem2025ger/azchat-chess/actions/runs/42159800263).
- CI covers concurrent 5-for-4 submissions, locked publication, 1/2/3-team cancellation/publication/bye, hashed single-use/revocable invitations, signed consent for a specific captain entry, role-scoped rosters, player report/confirmation, conflicting results and adjudicator decisions, forfeit confirmation and auditable result corrections. Existing frontend/server tests were also executed.
- QA migration applied **after** CI was green, under Supabase migration version `20261106040436`. Transactional QA smoke-test created a fixture event and invitation and rolled back both. After rollback: **1 original M1 event, 0 M3 events, 0 invites, 0 M3 audit rows**.
- QA roles tested with `SET LOCAL ROLE`: `anon` and `authenticated` cannot query invite token hashes or invoke service-held M3 commands directly; `anon` cannot access audit rows. Service-held command RPC privileges retained. Current security-advisor WARN findings unchanged from pre-migration baseline. New `rls_enabled_no_policy` INFO is expected for service-only invite table.
- A Preview build on `chessaz-preview-workspace` was requested for the tested source SHA. Existing production projects `azchat-chess`, `chessaz-api` and Supabase production were not modified.

## Unverified — do not claim acceptance

- Hosted QA backend deployment with `TEAM_TOURNAMENTS_M3_ENABLED` and matching Vercel Preview build flags (both default OFF); Vercel branch-specific QA environment for the M3 branch not yet configured. No secrets or branch-scoped environments were changed.
- Direct hosted HTTP/JWT/PostgREST end-to-end tests (as distinct from isolated PostgreSQL grants and RLS tests); real browser desktop/mobile owner pilot with one organizer, one arbiter, four captains and sixteen players; actual email/token redemption workflow.
- Manual browser verification of public/private payloads, client-specific saved rosters, disputes, forfeits, schedule progression and corrected results; all owner steps in `docs/team-tournaments-m3-pilot.md`.
- QA pilot is blocked pending confirmed Render workspace/service and QA-only feature flag environment setup. **Do not enable this feature in production.**

## Database and deployment safety

M1 migration is recorded in QA as `20261105225735_team_tournaments_m1` (repository filename `20261105221809_team_tournaments_m1.sql`).
Do not rename or edit that applied migration. M3 is a *new* forward-only migration; the QA ledger records it as `20261106040436_team_tournaments_m3_foundation`. Recheck the ledger and RLS before any future follow-up migration. Do not reapply this migration or modify the applied file.

No writes to production Supabase `kmwfvvliundhuovoakoa`, production Render `chessaz-api` or production Vercel `azchat-chess`; no merge, no force push. The entire new workflow requires security and regression acceptance before enabling any QA feature flag.

## Proposed finish gate

1. Complete the transactional M3 commands and row-level permission model, with negative direct REST/RPC tests and 5-concurrent-captain integration test.
2. Implement an idempotent deadline transition, cancellation, Berger schedule and odd-team byes; test concurrent first reads and commands.
3. Implement signed player reports, captain proxy rules, staff adjudication and structured audit. Verify board-scoped permissions and round progression.
4. Integrate the existing Turniere tab, six-locale copy and responsive home card; revise exactly the homepage equality test while preserving flag-OFF equivalence.
5. Run full frontend, server and isolated PostgreSQL CI with zero skips, migration apply and rolled-back QA regression, security advisors and hosted pilot.
6. Publish final PR SHA, diff stat, per-job test counts, logs and matching Preview URL; keep Draft for owner review.
