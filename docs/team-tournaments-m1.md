# Team Tournaments M1

M1 provides a server API for an unrated, over-the-board team round robin.
The first QA event has four teams, four boards, three rounds, six matches,
and 24 board slots. Existing Spieltag tables and APIs remain independent.
M2 covers the tournament screens and hosted QA pilot.

## Rules and lifecycle

`draft → registration → locked → published → finished`

1. A provisioned organizer creates a named event and a version 1 ruleset.
   The ruleset is fixed from creation. Opening registration allows the
   organizer to approve teams. Approval order is the recorded seed order.
2. Lock requires at least two approved teams and fixes the roster. The
   organizer can preview the deterministic Berger schedule and board colors.
3. Publication stores all rounds, matches, and board slots in one transaction.
   An event row lock serializes publication and later writes. Repeat publication
   returns the same publication timestamp. A failed write rolls back the schedule.
4. The assigned arbiter records provisional results, confirms results, or
   corrects confirmed results. Every change requires a reason and the current
   board revision. Conflicting revisions return HTTP 409 and require a fresh read.
5. The organizer can finish once all boards are confirmed. A finished event is
   read-only in M1.

- Supported fields: 2–16 teams and 1–16 boards. An odd field has one bye in each
  round. A bye creates no match and carries no points.
- By default, the first-named team has White on board 1. The ruleset can reverse
  this assignment. Subsequent boards alternate colors. This is the pilot rule.
- Results are written from White's perspective. Standard results award
  1, ½ or 0 board points. The default for a single forfeit is 1–0.
  The ruleset stores single-forfeit points in half-point units, with at most
  one point in total. A double forfeit on one board awards zero to both teams.
  When all boards are double forfeits, both teams receive loss match points.
- Match points default to 2/1/0. Standings use match points, then board points,
  then Berliner Wertung. For that last measure, weight the top board by the board
  count, decrement the weight by one per board, and sum over completed matches.
  Exact ties share a rank. Seed order only stabilizes display of tied teams.
- Provisional standings include complete matches with recorded results.
  Official standings count only fully confirmed matches. Match summaries
  show partial board totals separately and give additional points needed
  to guarantee at least a draw or a win. The calculation assumes that
  remaining boards can each award up to one combined point.
- The schedule follows the [FIDE Berger tables](https://handbook.fide.com/chapter/C05GeneralRegulations).
  Color assignment, match points, and tie-breaks are the event's pilot rules.

## Data and access

`team_tournaments` owns its ruleset, approved teams, role assignments, and rounds.
Rounds own matches. A match owns numbered board slots and its result revisions.
The append-only audit records the actor, reason, timestamp, and old and new result
and confirmation state. Composite keys prevent cross-event references.

An operator provisions the organizer allowlist. Each creator receives the
organizer role for that event. The organizer assigns an arbiter and can assign
a captain during team approval. Captain workspace reads before publication are
limited to the assigned team. Unassigned authenticated users have spectator access.
Spectators can read published event data. Tournament roles, drafts, and the
audit are excluded from the public API. M1 stores no player lineups or team notes.

RLS governs reads with the anonymous or verified user JWT. Browser roles have
no write privileges and cannot invoke the command RPC. The API verifies the
bearer token and derives the actor ID from it. It calls the command RPC with a
server-held service key. The RPC checks event-specific permissions on every
command. Both database functions use SECURITY INVOKER. The service role has
column-specific updates and cannot update the ruleset or mutate the audit log.

## API

All paths are below `/api/team-tournaments`. Responses use `Cache-Control: no-store`.
A write or workspace read requires a bearer token.

| Method and route | Purpose |
| --- | --- |
| POST `/` | Create a draft with `name` and optional `rules` overrides |
| POST `/:tournament/register` | Open registration |
| POST `/:tournament/teams` | Approve a team with `name` and optional `captain_id` |
| POST `/:tournament/arbiters` | Assign an arbiter by `user_id` |
| POST `/:tournament/lock` | Freeze team seeds |
| GET `/:tournament/preview` | Preview the locked schedule |
| POST `/:tournament/publish` | Atomically publish the server-generated schedule |
| GET `/:tournament/workspace` | Read the scoped participant workspace |
| GET `/:tournament` | Read public schedule, results, and standings |
| POST `/:tournament/matches/:match/boards/:board/record` | Record a provisional result |
| POST `/:tournament/matches/:match/boards/:board/confirm` | Confirm a result |
| POST `/:tournament/matches/:match/boards/:board/correct` | Replace a confirmed result with an audited correction |
| POST `/:tournament/finish` | Finalize an event with all boards confirmed |

Each board command takes `result`, `reason`, and `revision`. The first revision
is 0. Read the workspace again after a conflict. Public snapshots expose no
actor IDs or audit reasons.

## QA and rollback

- The migration is additive. The PostgreSQL 17 test applies it only to the
  disposable loopback test database. Unit tests cover schedule, scoring, and
  scenarios. HTTP tests cover the flag, token boundary, validation, and replay.
  Hosted Supabase, browser screens, and the pilot require M2 QA.
- With separate approval, verify QA project `iukmpcytsuofqhxsumbu`, compare its
  migration history with the committed filename, and apply only this migration.
  Verify grants and RLS with organizer, arbiter, captain, and spectator identities.
  Provision approved test actors and synthetic teams. Keep production outside
  the procedure.
- The API defaults off via `TEAM_TOURNAMENTS_ENABLED=false`. QA activation
  needs `SUPABASE_URL`, the public Supabase key, and the existing server-only
  `SUPABASE_SERVICE_KEY`. The frontend flag is reserved for M2.
- Roll back QA application exposure by disabling the API flag. Keep the
  migration and audit intact. An explicitly published event remains readable
  through Supabase RLS by design. Restricting already published data requires
  a separately approved access change.
