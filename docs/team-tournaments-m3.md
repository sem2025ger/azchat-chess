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

## Final verified QA evidence — 2026-11-06

- Reviewed source SHA `bc84397e0af4c7b19a13ef1028c096d2043fb6c0`, Draft PR #194. [Frontend CI](https://github.com/sem2025ger/azchat-chess/actions/runs/42162398053): **263/263**; [Server CI](https://github.com/sem2025ger/azchat-chess/actions/runs/42162398099): **446/446**; frontend workflow isolated PostgreSQL regression **446/446**. All zero failures, zero skips.
- CI includes 5 captains / 4 places under concurrency; 1-team cancellation, 2-team and 3-team Berger schedules with byes; simultaneous deadline publication; hashed, revocable, single-use invites; roster ownership, user-specific consent and prepublication RLS; conflicting reports, captain forfeits, adjudication and structured audit.
- QA-only migration `20261106040436_team_tournaments_m3_foundation` applied to Supabase `iukmpcytsuofqhxsumbu`; M1 baseline unchanged. Current QA schema, RLS policies and constraints were inspected directly.
- **Additional live QA SQL transaction (not merely isolated test runner):** existing QA organizer and six existing QA profile records acted as two captains and four players. Created a synthetic 2-team / 2-board event with two invitations, two completed/consented lineups; submitted both, changed its deadline inside the transaction, published one Berger round and a match, submitted and confirmed board 1 (1–0), submitted conflicting board 2 reports (1–0 versus 0–1), and organizer decided a draw (½–½) with a reason. Asserted **five M3 action audit rows** and both boards confirmed. **ROLLBACK** completed; QA subsequently reported **0 M3 events, entries, invites and audit rows**.
- Additional direct QA database checks under `SET LOCAL ROLE` denied `anon`/`authenticated` command RPC calls and reads of hashed invites. Earlier QA security-advisor WARN count was unchanged after the migration. One `rls_enabled_no_policy` INFO is expected for the server-only invite table.
- [QA-only Vercel Preview](https://chessaz-preview-workspace-4hjbrajb5-semov20207-3068s-projects.vercel.app) **READY**, deployment `dpl_8H1w4yLqDddY2utJLy7p3ANVKHcZ`, source SHA `bc84397e`, production target **not** used. Both frontend M3 flags remain OFF.

## Unverified — release blockers (do not assert the owner pilot passed)

- **Render QA backend is NOT on M3:** `chessaz-deutsch-qa-api` (`srv-dbcktr0473hc739d5qn0`) currently runs `b8d2cbe5` (M2); configured branch is `feat/global-position-search-v1`, autoDeploy OFF. An ordinary manual redeploy would use that configured branch, **not** reviewed M3. Production `chessaz-api` must not be changed.
- A dedicated, reviewed M3 QA backend needs a safe Supabase QA binding, server feature flags and matching **branch-scoped** Vercel Preview settings. No production credentials may be copied, exported or reused. Connector does not provide a safe way to transfer protected QA secrets or update a Render service's Git branch to this exact SHA. Creating an unbound service would not make it pilot-ready.
- No live hosted end-to-end JWT/REST/RPC checks or 21-account organizer/captain/player browser pilot have run. The transaction smoke uses existing QA user records under a trusted SQL transaction, **not live signed-in player sessions**. Desktop/mobile and real-device results remain unverified.
- The invitation link is a bearer token; verify sign-in redirects and expiration in the owner pilot. Team identity for previous lineup reuse is currently based on club name, not an independently verified club registry ID. Confirm that this identity convention is acceptable before expanding to third-party club events.
- Pilot instructions remain in `docs/team-tournaments-m3-pilot.md`. Do not merge or enable production feature flags. M3 implementation and QA SQL verification can be **marked code/DB complete**, but **hosted acceptance cannot be signed off** before the above checks.

## Database and deployment safety

M1 migration is recorded in QA as `20261105225735_team_tournaments_m1` (repository filename `20261105221809_team_tournaments_m1.sql`).
Do not rename or edit that applied migration. M3 is a *new* forward-only migration; the QA ledger records it as `20261106040436_team_tournaments_m3_foundation`. Recheck the ledger and RLS before any future follow-up migration. Do not reapply this migration or modify the applied file.

No writes to production Supabase `kmwfvvliundhuovoakoa`, production Render `chessaz-api` or production Vercel `azchat-chess`; no merge, no force push. The entire new workflow requires security and regression acceptance before enabling any QA feature flag.

## Engineering gate outcome

- **Alpha:** implemented the reviewed M3 workflows using existing tournament infrastructure, flag-gated UI and six existing locales.
- **Omega:** automated CI, isolated PostgreSQL, live QA rollback transaction and permission checks passed.
- **Not complete:** separate QA backend deployment, hosted multi-account/security/browser pilot and owner sign-off.
- **Stop condition:** protected environment configuration and existing applied migrations must remain unchanged without scoped authorization. This is not a production release or approval to merge.
