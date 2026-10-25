# Schach-Treff v1 — partial implementation, STOP

Base: 4af51e5. Branch: feat/schach-treff-v1. Do not merge yet.

## Stop
The requested challenge label `Partie 3+2 · gewertet` promises rated games.
No rating update exists in the repository's server completion path, match persistence,
or SQL migrations. `rating_blitz` and `rating_rapid` are stored profile values with
initial defaults. The existing durable completion RPC inserts the completed match,
but does not update ratings. Production was not inspected; an out-of-repository
rating mechanism has not been verified. Implementing rating calculation and atomic
settlement would exceed extracting the existing game path unchanged. Owner decision:
use unrated challenges for v1, or define a separate rating milestone/identify an
existing trusted rating mechanism. This is the specification's no-fake-success /
contradictory-requirements STOP, not an authorization requirement from AGENTS.md.

## Findings
- AGENTS.md read first. Sections 6/7 initially contain placeholders.
- Sidebar: Layout.tsx, md=768px; expanded labels at xl=1280px.
  Desktop screen styling elsewhere uses lg=1024px. New UI uses 1024px;
  tablet navigation retains previous behavior.
- Inactive Home and Settings previously received theme classes via alwaysGlow.
  Desktop now passes false; NavLink determines the actual active item.
- ChatScreen.tsx re-exports ChessAZCommunityScreen. Legacy screen polls every
  12 seconds while visible, loads the founding club by slug, then messages,
  events, tournaments and members. Desktop separately polls messages and members.
- Foundation migration defines clubs, memberships (member/moderator/admin), messages,
  proposals and participants with RLS. Message reads require membership.
  Membership roster SELECT is currently unrestricted to authenticated users;
  private rooms will need a narrow policy change. No such change made.
- Calendar migration remains untouched. Desktop excludes calendar and proposals.
- Bootstrap trigger currently uses metadata or email prefix and appends UUID.
  Existing displayPlayerName already strips UUID in legacy views. It is untouched;
  the new desktop reads usernames verbatim, per the corrected instruction.
- Socket middleware verifies the Supabase access token via auth.getUser and assigns
  socket.data.userId. Backend auth uses anon key; match persistence uses server key.
- Private-room join initializes clocks, starts durableGames, then emits match_found.
  Lobby invitations target authenticated user IDs. Existing time-control allowlist
  lacks 5+3 and 10+5; new challenge integration is not implemented.
- Fonts: shared index.html loads Inter from Google. New Bodoni Moda is self-hosted.
  Zero Google requests is NOT established and remains outstanding.
- Profile-edit policy, Home insertion point, open PR diff overlap and complete i18n
  inventory remain to be inspected before their respective phases.

## Phase status
1. Partial: functional desktop chat shell, German menu dialogs, membership join,
   stored usernames, date formatting, sidebar fix, local display font. No fake
   challenge/room/pin/nearby/position data or controls. Remaining layout features
   depend on subsequent phases. No visual browser verification yet.
2–7. Stopped before implementation. No migrations created or applied.

## Verification
- npm ci --legacy-peer-deps: frontend and server passed.
- Frontend tests: 124 passed, including all original tests unchanged.
- Server: 112 passed, 2 skipped (114 total).
- npm run build passed (TypeScript + Vite).
- npm audit --omit=dev --audit-level=high: gate passes; 2 moderate advisories
  in the pre-existing react-router dependency chain. No high/critical findings.
- New dependency: @fontsource/bodoni-moda (exact version in lockfile).
- Original Stockfish binary test initially failed on fresh checkout; existing
  prepareStockfish19.mjs fetched and verified the official binaries. No engine edit.
- Source regression tests compare legacy rendering implementation and mobile
  navigation byte-for-byte to base. Breakpoint source asserted as 1024px.
  These are NOT browser DOM checks or pixel comparisons at 360/390/430/768px.
- UI not run. No screenshots, network-request verification or complete A10 proof.
- CI results are separate from these local results; do not assume green remotely.

## Data and deployment
Nothing applied to production. No database connection was made, including QA.
No new DB objects/grants/policies; no QA migration commands applicable yet.
No Vercel/Render settings, secrets or maintenance-mode changes.
The finished milestone must deploy migrations first with owner approval, then assign
club admin, then merge, then verify desktop and phone. This partial PR is not ready.

## Corrected username plan (not implemented)
A4 must be satisfied by migration, not UI suffix stripping. Backfill only profiles
matching the legacy pattern, deriving names ONLY from valid sanitized metadata,
never from the old captured base or email. Missing/reserved metadata becomes
spieler with deterministic collision suffixes. Trigger follows the same rule.
Private revert log has no grants to anon/authenticated/service_role. Owner cleanup:
`DELETE FROM private.username_backfill_log;` (only after the future migration and verification).
Counts and tested SQL will accompany Phase 2, not fabricated here.

## Owner decisions outstanding
- Rated versus unrated challenge semantics (STOP above).
- German-only desktop copy, room creation limit, position moderation and mobile rollout.
- Benachrichtigen is component-local state only; no notification is sent or stored
  server-side. Persistence and actual notification delivery need a product decision.
- Generated spieler users may want new names; no rename feature planned here.
- Privacy notice additions for optional location/club, invites and position submissions.

## Update — 2026-10-25 (privacy remediation)
- CI checkout history fixed via `.github/workflows/frontend-ci.yml`; both CI jobs passed on 02de9c6.
- New migration: `supabase/migrations/20261025164000_schach_treff_private_usernames.sql`.
- New isolated PostgreSQL regression: `server/usernamePrivacyDb.test.js`; frontend and server CI passed.
- Applied migration ONLY to ChessAZ Deutsch QA (`iukmpcytsuofqhxsumbu`).
- QA verified: 3/3 legacy names migrated, 0 old-format names remaining; 3 private rollback-log records; anon/authenticated/service_role cannot SELECT rollback log. QA user records unchanged except usernames.
- Production migration NOT applied. Production, Render, Vercel and main remain unchanged.
- Remaining work: full visual browser QA, desktop Phase 1 completion, Phases 2–7, rating display backed by completed-match checks, room/challenge security, and pre-production privacy/restore review. No merge authorization.

## Independent review follow-up — 2026-10-25
- Owner approved preservation of explicit signup metadata even when matching the email local part, numeric collision suffixes (including spieler_1), new reserved names chessaz/schachtreff, and BEGIN/COMMIT plus external psql --single-transaction -v ON_ERROR_STOP=1.
- Migration revised in-place in GitHub because it was not applied to production; QA had already run the previous revision. Do not represent the existing QA migration ledger as proof of the reviewed version.
- Isolated Postgres regression updated and both CI workflows PASS on commit 387dbd1 (after correcting COALESCE syntax).
- A privacy-safe, counts-only read-only production preflight is available at docs/schach-treff-production-username-preflight.sql. Production counts: legacy_profiles=7, will_receive_spieler_number=0, will_need_collision_number=0. No production write was performed.
- QA before reset: 3 journal rows, 3 exact matches with current usernames, 0 subsequent changes. The attempted QA restore was blocked by access safeguards. Thus the revised migration has NOT been reapplied to QA and the post-migration QA checks are NOT complete. Do not proceed with production.
- Outstanding: restore three QA names from the private log using an authorized QA operation, clear log in the same atomic unit, execute reviewed migration on QA under a new applied version, re-run count/grant/new-signup checks. Owner re-review and explicit production authorization required.

## Privacy PR extraction — 2026-10-25
- Privacy migration `20261025164000_schach_treff_private_usernames.sql`, its `server/usernamePrivacyDb.test.js` integration test, and the old preflight document are **no longer in this PR**.
- They now live in independent **Draft PR #113** (`fix/email-free-usernames`), branched from current main. PR #113 also contains standalone owner runbook, counts-only pre/post SQL and guarded rollback. Do not merge #112 before #113.
- The owner waived a further QA reset and explicitly prohibited production writes without separate authorization.
- Production read-only preflight yielded 7 legacy usernames, 0 fallback usernames and 0 collisions. No migration has been applied to production.
- The implementation status of Schach-Treff Phase 1 and Phases 2–7 is otherwise unchanged; this PR remains draft.

## Open item — migration history
migration history version mismatch for 20261025164000 → fix in the planned migration-repair PR. Production recorded version `20261025163216` with name `20261025164000_schach_treff_private_usernames`. Never reapply or rename in this milestone.

## 2026-10-25 — rebase and Phase 2 evidence
- Feature branch reconstructed on main `0a86f521` through a temporary branch, with feature ref updated using a lease against its previous SHA. No changes to main.
- PR #113 merged, production username backfill verified 0 / 7 / 7. No production operations performed in this PR.
- New Phase 2 migration `20261025173000_schach_treff_username_available.sql` creates advisory SECURITY DEFINER RPC with 3–30 character validation, matching reserved list, case-insensitive lookup and anon/authenticated EXECUTE grant.
- Registration checks availability before signUp; signup trigger remains authoritative and race-safe.
- Isolated PostgreSQL integration test `server/usernameAvailabilityDb.test.js`; both GitHub CI workflows green on `b88e5f8`.
- QA project `iukmpcytsuofqhxsumbu`: RPC migration applied successfully, read-only smoke verified reserved=false, too_short=false, valid=true; anon/authenticated can invoke.
- Phases 3–7 remain unfinished, and browser visual/multi-device proof is outstanding. Do not merge/deploy.

## 2026-10-25 — STOP under authoritative section 8 (Phase 4)
- Authoritative full specification saved verbatim at `docs/schach-treff-v1-spec.md` (commit `cc90293`).
- Phase 3 pinned-message migration, desktop UI and PostgreSQL authorization test added in feature branch. Migration applied **only to ChessAZ Deutsch QA**; QA accepted it. Isolated pin authorization test passed in CI; Frontend CI passed, but full Server CI is **red** on two attempts: durableRecovery.test.js timed out waiting for match_found, with cascading failures. No claim of a green full suite.
- Section 8 STOP: Phase 4 requires playable 5+3 and 10+5 chat challenges, but server/index.js ALLOWED_TIME_CONTROLS permits 3+2 and does NOT permit 5+3 or 10+5. Existing private-room start path rejects those controls. Implementing them changes the authorized game-flow/time-control handling rather than merely extracting an unchanged function. Cannot meet Phase 4 acceptance without crossing that protected boundary. Do not implement a second game engine or weaken tests.
- Consequently Phases 4–7 were NOT implemented. Production/main/maintenance untouched. Resume only with explicit owner authorization to extend existing private-game time-control allowlist and preserve durable-game/clock behavior after reviewed regression tests.
