# Global position search (QA)

The Spieler page shows an open position board above the existing name search only
when `VITE_POSITION_SEARCH_ENABLED=true`. The server endpoint is installed with
`POSITION_SEARCH_ENABLED=true`; both flags default off. No database objects,
importer changes or database writes are involved.

On startup the server reads the existing Lichess broadcast archive in bounded,
id-ordered pages. It replays up to 60 plies with chess.js and indexes the initial
position (ply 0) and positions after plies 1–60. One immutable metadata record is
kept per game. Position entries are three parallel sorted typed arrays:
`BigUint64Array` hashes, `Uint32Array` game indices and `Uint8Array` plies. Game
indices address a separate array of archive ids; no per-entry JS objects are kept.

The key is chess.js's normalized FEN placement, turn, castling and legal en passant
fields, without counters. Its deterministic unsigned 64-bit hash is the first
eight bytes of SHA-256, big-endian. Binary search identifies the hash range;
chess.js replays candidates to their indexed ply and compares the complete key,
so a hash collision cannot produce a match. Repeated positions return the first
matching ply of a game. A bounded cache stores verified matches by the complete
key for this immutable snapshot, never by hash alone.

Active `spieler_opt_out` FIDE ids (`hidden_pending_review`, `approved`) exclude a
game if either player's FIDE id is hidden. Opt-outs are read during the build and
again on every query, including cached queries. A privacy-read failure fails the
request closed. A startup-excluded game becomes searchable again only after a
restart if its opt-out is withdrawn.

## Endpoint

`GET /api/positions/search?fen=...&side=white|black|any&fideId=optional&limit=10`

Bearer authentication and the Vorbereitung-style 120/IP/min pre-authentication
and 12/user/min post-authentication budgets apply. Limit is capped at 50. Invalid
FEN returns 400; disabled flag returns 404; a building index returns 503 with
`code=index_warming` and `Retry-After: 5`. Failed builds return `index_unavailable`.
Responses are not cached by HTTP clients.

The response contains `games`, `total`, `nextMoves`, `side`, `perspective`,
`maxIndexedPlies` and `searchMs`. Games are ordered by date descending (unknown
dates last), then id ascending, and include PGN, players, optional ratings, event,
date, result, matching ply, perspective/outcome and source/license URLs. The
current archive schema has no rating columns; ratings are now resolved from the
existing Spieler player table as described below.

Without a FIDE filter, side selects the perspective for results, not a subset of
games: every game has both colors. With a FIDE filter, white/black also require
that player to occupy the chosen side. With `any`, use the filtered player's
side, or otherwise the side to move at the searched position. Next moves are SAN
for the side to move; their W/D/L percentages use that same chosen result
perspective. Counts/stats use all verified visible games before the display limit.
Unknown results are omitted from the W/D/L denominator. Analysis opens at the
matching ply through the existing `openSpielerAnalysis` handoff.

## Operations

Build logs include `position_index_building` and `position_index_ready`, with
build time, entries, games, rejected/excluded counts, and process RSS before/after.
Building yields to the event loop between small game batches. At more than
350,000,000 bytes RSS, stop building and fail closed, logging
`position_index_memory_limit`. Do not enable or roll out further changes until
the memory result is reviewed.

**After any future import, restart the QA Render service to refresh the index.**
There is no reload endpoint and no request-triggered rebuild. No archive import
is performed by this feature. Deploy Vercel previews using the branch name so
branch-scoped preview variables are applied.

## Owner's manual QA deploy

In Render, open **chessaz-deutsch-qa-api** (service `srv-dbcktr0473hc739d5qn0`).
Add the new environment variable `POSITION_SEARCH_ENABLED` with value `true`;
preserve existing variables and secrets. Save without deploying if the dashboard
offers that option. In **Manual Deploy → Deploy a specific commit**, select the
final green CI commit from **feat/global-position-search-v1**, as identified in
the milestone report. A specific-commit deploy disables automatic deploys in
Render; inspect that setting yourself before choosing a future deploy strategy.

Wait for Live and check `https://chessaz-deutsch-qa-api.onrender.com/health`.
The health check confirms that the server is alive, not that the index is ready.
The runtime log must subsequently contain `position_index_ready` with `build_ms`,
`entries`, `games`, `rss_before`, `rss_after`, and `max_indexed_plies:60`.
If `rss_after` exceeds 350,000,000 bytes, stop validation and report it. A
`position_index_failed` or `position_index_memory_limit` log is not a successful
build. During a normal build, authenticated searches return 503 `index_warming`
and `Retry-After: 5`; after readiness, use the preview and sign in yourself to
run the supplied Najdorf position from the milestone report with side Black.

## Player fallback, rating order and NRW scope

Search also accepts `scope=all|nrw` (default all) and
`sort=newest|strongest` (default newest). Ratings are loaded once per startup from
`spieler_players.fide_rating`, matched only by exact white/black FIDE ids.
Strength is the average when both ratings are known; unknown averages sort last,
then the existing newest/id ordering breaks ties. Known individual ratings are
shown even when the other rating is missing. Restart refreshes rating snapshots.

Every successful search includes `fallback`, `playerStats`, `fallbackGames`,
`fallbackTotal`, `fallbackNextMoves`, `fallbackScope`, `scope`, `sort`, `nrwCount`.
Own `games`/`total`/`nextMoves` are never combined with fallback lists. A nonempty
player result means fallback=false. An empty player result means fallback=true
and whole-database results for the same position/side/order/limit, even if the
original scope was NRW. `playerStats.total` counts all visible, valid indexed
games involving that FIDE id, regardless of color/scope; firstWhite/replyE4/replyD4
contain up to three canonical SAN moves with counts. Zero-game players have total
0. The UI distinguishes these two cases and shows stats only for nonzero totals.

NRW membership is exactly a verified `spieler_claims` FIDE id whose club_id joins
a published `clubs_nrw` row. The joined read excludes pending/rejected claims,
unpublished/missing clubs and deduplicates ids. It runs during build and on every
search together with opt-outs; read errors fail closed. No names or other
membership sources are used. NRW selects the chosen color, or either color for
any. Empty NRW sets remain selectable. The current count appears after a
successful authenticated search (until then shown as —). Empty NRW results offer
a button that changes to all and immediately searches again. Fallback sections
are explicitly labelled whole database, with their own next-move table.

## Owner deployment from the currently connected QA branch

The owner reports Settings → Build & Deploy → Branch as
`feat/settings-match-preview-surface-20261027`, Auto-Deploy On Commit, and no
POSITION_SEARCH_ENABLED. GitHub comparison proves that branch (3a716443) is an
ancestor of global-position-search-v1. No migration, dependency, old server route
or deployment entry point changes between those branches; server/index.js only
adds the positions installer. The other server changes are new position modules
and tests. The new installer reuses existing SUPABASE_URL and SUPABASE_SERVICE_KEY
and adds only POSITION_SEARCH_ENABLED=true. Existing feature flags remain as set.
The actual running commit must be checked by the owner in Render's latest Live
deployment; branch configuration alone does not prove a deployed SHA.

The proposed plan is supported: add the new flag, switch this QA service's Branch
to feat/global-position-search-v1, save, then deploy the final green commit if
saving did not already deploy it. Verify the Live deployment SHA. With On Commit,
subsequent commits on the new branch will also deploy automatically, while pushes
to the old branch will no longer deploy this service. Existing QA server features
remain available under their existing flags; new API/index functionality becomes
available and consumes startup CPU/memory, which still needs owner measurement.
Alternatively, if the service already tracks the new branch, deploy its latest
commit after confirming the SHA; if Render offers the final SHA under Deploy a
specific commit, that path avoids switching the tracked branch but disables
Auto-Deploy. The owner must inspect that setting afterwards. Never deploy the old
branch's latest commit expecting this feature to appear.
