# Spieltag v1 — private team preparation (Milestone 5)

Branch `feat/spieltag-v1`, PR base `feat/clubs-nrw-v1`. Merge order remains #127 → #128 → this PR, **Squash and merge only**. After each dependency is squash-merged, retarget and inspect the diff/CI again. No duplicated Spieler/Clubs NRW files; no changes to their migrations.

## Scope

- A captain manually creates/edits the round, opponent team, optional existing NRW opponent club, schedule and venue. Dates are entered/displayed in Europe/Berlin, independent of device timezone. Nonexistent or ambiguous daylight-saving transition times are rejected.
- Aufstellung: numbered boards, own names and optional existing imported FIDE IDs. Gegner: manually entered opponent names and optional Spieler card buttons. Cards reuse `SpielerCard` and `createSpielerApi`; no new player catalog, claims or search endpoint. Hidden/missing cards and disabled Spieler fail closed, without guessing identity or exposing catalog data.
- Nach der Runde: captain enters each board result from the own team's perspective and a short round note (maximum 1,000 characters). Members have read-only access. No game launch, moves, clocks, matchmaking, completed-match, rating or league write integration. Board results remain internal/manual, including not-played/open.
- V1 bounds: 100 visible teams, earliest 100 schedules per team, 32 boards per match, 250 published clubs for optional selection. No scraping, external data import, inferred membership or automatic results.

## Privacy and authorization

`spieltag_teams.club_id` references existing `clubs_nrw`; board FIDE references use existing `spieler_players`. `spieltag_team_members` is an authoritative owner-assigned roster, distinct from the self-selected voluntary/public NRW club list. Selecting a club, being its public member or being an NRW editor/owner does **not** grant access to any private team. A captain is always a member of the specific team. Other teams of the same club are private too.

The owner/service role creates teams and assigns/revokes captains/members. Browser roles cannot create teams, add members, promote themselves or see other roster rows. Members can read only their own membership and assigned teams/matches/boards. Only team captains may write that team's schedules, lineup, opponents, results and notes. Column-specific UPDATE grants keep team/match/board identity and original author immutable, even through direct REST. RLS remains authoritative on every data request; no SECURITY DEFINER functions were added. Revocation takes effect on the next request; already displayed information cannot be recalled.

The HTTP API verifies the existing bearer identity, then uses a **request-specific user-JWT Supabase client** with the public project key; it never falls back to a service-role client. Cross-team RLS checks apply to every query. Bounded process-local IP pre-limit (120/min) precedes verification, followed by per-account budget (60/min), each using one scoped Render proxy hop. Payload allowlists, 12KB body limit, 8-second query timeouts, no-store responses and private diagnostics apply. Auth/session changes unmount the private workspace, abort outstanding requests and discard its state; nothing is stored in localStorage.

## Flags and configuration

- Backend: `SPIELTAG_ENABLED=true`; frontend: `VITE_SPIELTAG_ENABLED=true`. Both default OFF; no flags were enabled by this milestone. The navigation link is desktop-only, following Spieler; the route itself is responsive.
- API needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` (a public key, never a service secret). `VITE_SERVER_URL` must point at the intended QA backend. Missing configuration fails closed. No new environment values or deployed services are changed by this PR.
- Optional card buttons additionally require `VITE_SPIELER_V1_ENABLED=true`, and the existing backend Spieler feature must be enabled for card requests to succeed. Spieltag remains usable with manual names if Spieler is disabled.
- Feature flags gate the application route/API, not the database's membership authorization. RLS continues to protect any direct Data API calls while features are disabled.

## Owner-only setup (QA SQL editor)

Verify the intended existing club and exact trusted user IDs first. Execute using the privileged QA administrator/service role only. Replace every placeholder; never expose a service-role key to the browser. These commands are documentation, not automatically executed setup or permission grants to real users.

```sql
SELECT id,name,slug FROM public.clubs_nrw WHERE published ORDER BY name;
SELECT id,username FROM public.profiles WHERE id IN ('<CAPTAIN_UUID>'::uuid,'<MEMBER_UUID>'::uuid);
INSERT INTO public.spieltag_teams(club_id,name)
VALUES('<CLUB_UUID>'::uuid,'1. Mannschaft') RETURNING id;
INSERT INTO public.spieltag_team_members(team_id,user_id,role)
VALUES('<TEAM_UUID>'::uuid,'<CAPTAIN_UUID>'::uuid,'captain'),
      ('<TEAM_UUID>'::uuid,'<MEMBER_UUID>'::uuid,'member');
-- Verify assignment before anyone accesses internal preparation.
SELECT team_id,user_id,role FROM public.spieltag_team_members WHERE team_id='<TEAM_UUID>'::uuid;
-- Change one role or revoke one specific membership when authorized.
UPDATE public.spieltag_team_members SET role='member'
WHERE team_id='<TEAM_UUID>'::uuid AND user_id='<CAPTAIN_UUID>'::uuid;
DELETE FROM public.spieltag_team_members
WHERE team_id='<TEAM_UUID>'::uuid AND user_id='<MEMBER_UUID>'::uuid;
```

## Validation and migration gate

Migration `20261027003816_spieltag_v1.sql` is new, additive and must be applied to **QA only, after BOTH CI checks for its exact committed SQL are green with zero skips**. Before applying, inspect QA project/history; if already present, compare recorded SQL instead of running twice. Record the actual Supabase-assigned version. No migration is applied on commit creation, and no applied migration is edited.

`server/spieltagDb.test.js` applies foundation, all #127 migrations, Clubs NRW, the Spieler FK, then Spieltag in order on isolated PostgreSQL 17. Tests cover captain/member/outsider/other-team roles, direct-ID and child-row privacy, voluntary-club spoofing, NRW-owner bypass attempts, self-promotion/roster changes, foreign writes, forged authorship, identity immutability, bounds/FKs/results, immediate membership revocation and no game/league writes. HTTP tests cover default-off/auth, JWT forwarding using the real SDK, input/actor allowlists, RLS errors, no-store and rate limits. Frontend tests cover tabs, read-only member rendering, escaped notes, card buttons, API payloads and Berlin/DST schedules.

After green CI, apply only this migration to QA, run `docs/spieltag-v1-qa-regression.sql` as a fully rolled-back transaction, verify no fixture rows remain, and inspect security advisors. Keep the PR Draft, flags off and production/maintenance unchanged. Report and STOP.
