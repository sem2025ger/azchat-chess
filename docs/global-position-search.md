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
current archive schema has no rating columns; these values are null.

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
