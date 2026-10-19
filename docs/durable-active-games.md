# Durable started games — review and rollout notes

Status: implementation under review; no production migration or activation is
part of this change. Production games remain volatile until migration and
activation are separately approved, performed and verified.

## Storage and transactions

`supabase/migrations/20261019215514_durable_active_games.sql` is additive. It
creates `public.durable_games` and `public.durable_game_transition`; it does not
replay bootstrap, change existing policies or change completed-match constraints.

A room UUID and an independently generated match UUID are stable from durable
startup through result retries and restarts. The JSON state contains the two
authenticated player UUIDs and colours, initial FEN, ordered SAN moves, time
control, millisecond clock balances and reference time, start time, status, draw
offer, recorded disconnect timestamps/deadlines and terminal outcome/time. No
socket IDs, handles, tokens or session data are serialized. Recovery replays all
moves into chess.js from the initial FEN; the final FEN is never used as a
replacement for repetition history.

Each start or accepted state transition is **one RPC / one PostgreSQL
transaction**. `SELECT FOR UPDATE`, revision comparison, live lease and fence
checks precede the write. Natural game completion is part of the move's same
transaction, rather than a second move-time RPC. Moves, resignation, draw
offer/decline/accept, recorded disconnect/reconnect and deadline endings install
their candidate state in memory and broadcast only after database acknowledgement.
The existing volatile handlers remain in use for rooms started with the flag off.

For a normal move, expected extra database traffic is one RPC rather than the
previous zero active-state writes; its network round trip and commit time are
added before board acknowledgement. There is no separate per-move read or lease
query. Terminal actions atomically record the pending handoff in their one RPC;
the asynchronous completion/compaction is one further RPC, outside move
acknowledgement latency. With durability enabled or known games awaiting
recovery, background traffic is one recovery scan per five seconds per process
and roughly one renewal per five to six seconds per owned game. Disabled-mode
discovery/backoff is described below. Replay/JSON payload work grows with game history. An ambiguous response
can require an exceptional read; reconnect clearing a deadline is one RPC.

A process-local promise queue serializes each room's mutations, reconnects,
lease renewals and completion. Candidate chess state is isolated
from the accepted room. A failed or unresolved write blocks that room; no
volatile acceptance is used as fallback. On a lost response the store performs
an **exceptional additional read**, checking request UUID, expected revision,
owner and fence. It never blindly reapplies a transition. If even this read
fails, recovery reconciles storage before the room accepts another action.
Delivery over the network is not exactly once; database effects are idempotent.

## Ownership and recovery

Each process has a random owner UUID. The database issues a 15-second lease and
monotonically increasing fencing token. Renewals occur when less than ten
seconds remain, using the one-second watchdog. The RPC checks database time
after acquiring its row lock. A different process can claim only an expired
lease, incrementing its fence. Every subsequent mutation and acknowledgement
must supply that fence; a stale process cannot write or finalize the game.
Result completion is also fenced, retains the same immutable match ID and
verifies duplicates inside the RPC before acknowledging success.

Startup scans durable non-tombstone rows, claims expired leases, rebuilds rooms,
checks elapsed deadlines and resumes pending results. A process never depends on shutdown hooks or memory from
the previous process. During deployment overlap an affected client receives
`recovery_pending` while the other lease is live. With healthy storage, takeover
is normally within the remaining lease plus one scan interval and RPC latency.
With new durable starts enabled, storage/reconstruction failure makes `/health`
return 503 and starts are rejected with `storage_unavailable`. Blocked durable
rooms reject actions regardless of the new-start flag.

### Disabled-mode availability and discovery

`DURABLE_ACTIVE_GAMES=false` separates ordinary volatile availability from
optional durable recovery. HTTP/socket startup does not wait for the initial
recovery query. `/health` stays 200 and queue/private starts remain volatile
even during an initial or later durable-storage failure. In this mode HTTP
health is **not** a statement that existing durable games are healthy: each
durable room retains its fenced storage checks, blocking and recovery. There
is no conversion of a durable room into a volatile one.

- Confirmed missing migration/table, with no known pending durable games:
  perform the startup probe and stop periodic scans. Restart after applying
  the migration; an explicit recovery request can also probe again.
- Installed but empty schema: scan once per minute. An empty scan cannot prove
  the feature was never used or that another process will not create a game.
- Database state unknown because a query failed: retry after 5, 10, 20, 40,
  then at most 60 seconds between attempts, without blocking volatile starts.
  A missing function alone does not prove there is no recoverable data.
- Known unfinished games/pending results (including another owner's lease):
  retain five-second discovery and normal ownership renewal/result retries.
  A later missing-schema response does not abandon known games.
- An authenticated reconnect that reads a non-tombstone row wakes recovery
  immediately; only the recovery path claims ownership. Socket requests do
  not bypass ownership or make durable state authoritative in memory alone.

After all known games drain, a successful empty scan returns to minute discovery.
The trade-off is bounded discovery delay for previously unknown games: up to
60 seconds plus query time (and any remaining lease), unless reconnect wakes
recovery earlier. Zero periodic traffic is guaranteed only for a confirmed
absent schema/no known games or absent storage credentials, not for an installed
schema or unknown state. A restart loses that observation and probes again.

## Clocks and disconnects

The stored balance belongs to `lastMoveTimestamp`. Elapsed wall-clock time,
including downtime, counts against the running side. Replay/read/resync does
not reset that reference or deduct elapsed time twice. A legal move debits
elapsed time and adds the configured increment once. Terminal clocks stop at
the effective ending time. If multiple deadlines elapsed during downtime, the
earliest clock or actually recorded disconnect deadline determines the outcome.
Equal clock/disconnect deadlines prefer the clock.

Only actual disconnect events create a 30-second deadline. Missing sockets in a
restored room do not create deadlines or select a loser. Reconnecting before
an existing deadline expires durably clears that player's deadline. The other
player's recorded deadline is preserved. A legitimately expired clock or
recorded deadline may end a recovered game.

## Client protocol

Existing events are retained. `reconnect_game` still accepts only `{roomId}`;
membership is checked against authenticated user identity. The URL room ID is a
reload hint, not authorization. No local position/history is uploaded.

The client requests resync on mounting a room URL and on every socket `connect`.
It retries `recovery_pending`/`storage_unavailable` after two seconds and removes
listeners/timers on unmount. It does not buffer moves while disconnected or
before synchronization. Snapshots restore the full board history, authoritative
colour, clocks, draw offer and status. An ended snapshot and `game_over` restore
games that finished while the player was away, including after room cleanup.

Durable `update_board`/`reconnect_success` add `roomId`, `initialFen`, `status`,
`outcome`, `revision`, `timeControl` and (on reconnect) `color` as appropriate.
Legacy fields remain. Legacy reconnect responses without the additions still
work. Temporary recovery failure does not redirect a client to matchmaking.
New database lookups use the existing lobby budget; in-memory resync does not
consume the game-action bucket. Existing bucket capacities/refill rates remain
unchanged and queued actions are charged at arrival, before database waits.

## Completion and retention

The terminal transition stores `ended`, outcome and completion time before
broadcast. `ended && !result_saved` is the durable pending-result handoff; it
cannot be cleaned up. Milestone A's bounded retry/error classification and
confirmation helper is reused. The volatile INSERT adapter is unchanged;
durable games use a fenced completion RPC with duplicate verification. Both
use a stable match ID. `persisted=true` requires database confirmation.

The completion RPC inserts the completed match and verifies its ID, source
room, participants, result, termination, final position and PGN, then replaces
the durable JSON with a minimal tombstone containing only player IDs, ended
status and outcome **in the same transaction**. A duplicate exact result is
verified and acknowledged; an unrelated conflict leaves the handoff intact.
No move history, initial position, clocks, disconnect state or PGN remains in
the durable row. Only the completed match holds the persisted history. The
minimal tombstone currently has no automatic expiry, so an old room URL can
recover the terminal result without resurrecting the game. In-memory ended
rooms are removed after 30 seconds only after this atomic completion. Failed
result writes remain recoverable and retry after a 30-second cooldown following
the existing bounded attempt sequence.

## Database access

The new table has RLS enabled and no policies. All table privileges are revoked
from PUBLIC, anon and authenticated; only service_role receives SELECT/INSERT/
UPDATE. The function is SECURITY INVOKER, has `SET search_path = ''`, uses
qualified relation names, and has EXECUTE revoked from PUBLIC/anon/authenticated
and granted only to service_role. It needs no SECURITY DEFINER bypass. Browser
clients must use the authenticated socket protocol.

The isolated PostgreSQL suite executes SELECT, INSERT, UPDATE, DELETE and RPC
calls as both browser roles and requires permission denied (`42501`). It also
checks RLS is enabled and no policies exist. This is not a claim about the live
project's grants; production was not modified or queried for this verification.

## Tests and measurements

Baseline at `559509f183afb2dd2c47f11141e9764c13d60362`: 71 server tests, 34 frontend
tests; lint 0 errors / 50 warnings. Node on this machine is 24.15.0 and npm
11.12.1, different from the historical AGENTS baseline. A locked native package
prevented `npm ci --legacy-peer-deps` in the original frontend node_modules.
The verification copy uses the same source and lockfile, with a successful
frozen install; no dependency/version workaround is committed.
That frozen dependency directory was copied back without deleting the frontend;
the final frontend checks below were run from the original `tmp/` directory.

Initial feature verification on 2026-10-20 (Europe/Berlin), before the
disabled-mode correction:

| Check | Result |
| --- | --- |
| Server frozen install | `npm ci --ignore-scripts`, exit 0 |
| Server suite with real isolated PostgreSQL | 99 passed, 0 failed, 0 skipped |
| Frontend tests | 37 passed, 0 failed |
| Frontend typecheck | `tsc -b`, exit 0 |
| Frontend production build | exit 0 |
| Frontend lint | 0 errors, 50 warnings, equal to baseline |
| Server production dependency audit | exit 0, 0 vulnerabilities |
| Frontend production dependency audit | exit 0, 2 moderate, 0 high/critical |
| 50 accepted local socket move transitions | p50 18.23 ms, p95 30.44 ms |
| 50 unauthenticated HTTPS requests to Supabase REST root | p50 23.58 ms, p95 70.30 ms; all 401 |

The disabled-mode correction adds 14 counted regression cases, including real
HTTP/socket starts while the initial recovery request is still held, absent
schema, initial outage and outage after successful startup. Fake-clock tests
verify no periodic requests after confirmed absence, minute discovery, capped
backoff and continued recovery of active games/pending results. Local checks
passed 98 server tests with the PostgreSQL parent suite explicitly skipped
(local PostgreSQL unavailable), all 37 frontend tests, typecheck, build and
lint (0 errors / 50 warnings). Both production audit gates passed with the same
findings as above. The full PostgreSQL suite remains required in Server CI on
the correction's head; do not treat the local skipped suite as database proof.

The HTTPS target was `https://kmwfvvliundhuovoakoa.supabase.co/rest/v1/`;
sequential GETs consumed each response body and used `performance.now()`.
Percentiles use sorted samples 25 and 48 of 50 (nearest rank p50/p95).
The probe's request timeout was ten seconds. No credential or database
payload was sent. The Windows environment's geographic egress was not verified.
Both observed p95 values are below 300 ms; neither establishes the production
move-transition p95 or clears the production activation requirement.

Run ordinary server checks with `cd server && npm ci --ignore-scripts && npm test`.
For integration, supply `DURABLE_TEST_DATABASE_URL` pointing to a **loopback-only**
disposable database whose name begins `durable_test`. Example for a local test
cluster: `postgresql://postgres:<local-test-password>@127.0.0.1:5432/durable_test`.
The harness creates a new random database, builds an isolated matches fixture
from the current schema contract (including source-room uniqueness), applies
only this additive migration, and drops its own database afterwards. It never
runs the legacy bootstrap. Without that variable the integration suite is
explicitly skipped. Server CI now supplies an isolated PostgreSQL 17 service,
so this integration suite must run there. Existing audit gates are retained.

The local run uses actual PostgreSQL 18.4 binaries. Test child processes load
the real server and Supabase JS adapter. A deliberately narrow local HTTP
adapter maps their RPC and result-write requests to real PostgreSQL transactions
under service_role. It supports response loss/failure injection. **It is not
PostgREST or the hosted Supabase stack.** The test verifier is installed only by
the separate test-process entry point, not by a production authentication flag.

The first PostgreSQL 17 CI run passed every scenario assertion but failed at
teardown: a forced database drop raced asynchronous client shutdown. Cleanup
now waits for zero database backends and performs a normal drop, without
suppressing connection errors or weakening assertions. Two small verification
fix commits follow the requested five commits because the branch was already
published and the repository forbids force-pushing.

Restart procedure: create a private game, commit several moves, SIGKILL the
process, launch a new process with no shared room memory, wait for the actual
15-second lease to expire, reconnect both users, check histories/colours/clocks,
then make an en passant capture. Completion procedures kill once with a pending
handoff before the result write, and once after the atomic result+tombstone
transaction commits while its response is withheld. Fresh servers with new
durable starts disabled verify one completed row and a history-free tombstone
without resurrecting either game. Seeded clock/deadline/special-move fixtures
also test expiry, threefold repetition, castling and promotion. Only seeded
fixture leases are accelerated; the SIGKILL tests use real lease expiry.

The integration suite measures 50 accepted socket moves, using unchanged rate
limits and 110 ms pacing outside each measured interval. Its reported p50/p95
include local socket transport, room queue, chess validation/replay, the actual
RPC-shaped HTTP call, PostgreSQL commit and board acknowledgement. These local
numbers are not production-region latency. A separate unauthenticated,
read-only HTTPS probe to the specified Supabase endpoint measures transport
responses only (401); it does not measure database execution. Render-origin RTT
and hosted Supabase move-transition p95 remain unverified. If a representative
staging p95 exceeds **300 ms**, production activation is blocked; this does not
block reviewing the PR. Do not infer activation readiness from loopback numbers.

## Separately approved rollout — do not execute in this PR

1. Review and merge only with owner authorization. Keep maintenance and Sentry
   unchanged. Do not change regions, plans, auto-deploy or hosting settings.
2. In an isolated/staging Supabase environment, apply only the new migration,
   verify real PostgREST grants, run the fresh-process scenarios and measure
   at least 50 representative move transitions from the backend network region.
   Require p95 <=300 ms before production activation.
3. Obtain separate production migration approval. Apply only
   `20261019215514_durable_active_games.sql` through the approved migration path.
   Never replay bootstrap or the old migration history against production.
   Independently verify the existing completed-match contract and new ACLs.
4. With `DURABLE_ACTIVE_GAMES` absent/false, deploy only when separately
   authorized. It probes recovery in the background if service credentials
   exist, without gating volatile availability. A missing RPC triggers a
   separate table-absence check; an installed/unknown schema retains bounded
   recovery attempts. Restart this binary after applying the migration so a
   process that confirmed the old absent schema probes again. With the flag
   enabled, unavailable storage still fails readiness and durable starts.
5. Prevent new starts through the owner's maintenance process and drain any
   already started volatile games before restarting to activate. Existing
   volatile games are not retroactively persisted; a restart still loses them.
   Unstarted private invitations and matchmaking queues remain ephemeral.
6. After separate activation approval, set **server-only**
   `DURABLE_ACTIVE_GAMES=true` using the approved owner operation. Retain the
   existing service credentials. Verify readiness, two authenticated users,
   startup failure, reconnect, restart, result handoff and retention before
   ending maintenance. No browser env flag or schema access is needed.

## Rollback

1. Keep the migration and service credentials. Set the server flag to false
   only through a separately approved owner operation. This stops *new durable
   starts*; existing durable games still recover, renew leases, accept fenced
   transitions and drain pending results. It does not discard them.
2. Keep running this version (or a compatible recovery-capable version) until
   all durable non-tombstone games and pending results have drained. Verify
   `SELECT count(*) FROM public.durable_games WHERE NOT result_saved` through
   the approved read-only operator workflow. Do not delete pending rows.
3. Do not roll back to the old memory-only binary while durable games remain.
   Do not drop the table/function, revoke service access, remove credentials
   or lower completed-match constraints as a shortcut. There is no destructive
   down migration in this PR. Retain minimal tombstones and completed matches.

Remaining validation before activation: genuine hosted PostgREST/Supabase
integration, region-representative latency, actual hosting readiness wiring and
owner-approved production migration/activation. Local tests establish real
PostgreSQL crash recovery, not those production conditions.
