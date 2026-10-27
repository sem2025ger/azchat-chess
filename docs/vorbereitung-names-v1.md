# Milestone 5c — real-name preparation (default OFF)

Branch `feat/vorbereitung-names-v1`, PR base `feat/vorbereitung-v1` (#130). Merge order #127 → #128 → #129 → #130 → this PR, **Squash and merge only**. Retarget and recheck dependent diffs/CI after each dependency squash. Existing GamesProvider, Spieler cards, variation filtering, results and analysis handoff are extended in place. No engine, multiplayer, existing game-board or game-screen changes.

## Primary identity and sources

Preparation defaults to real name / FIDE ID. Spieler **Partien** and Spieltag **Gegner → Vorbereitung** pass the existing FIDE ID to the same reusable view. A full name must be `Surname, Given name`; only case, Unicode NFC and whitespace are normalized. No surname-only, initials expansion or fuzzy matching. Name lookup gathers exact-name FIDE candidates from Spieler and imported broadcasts; multiple IDs require explicit selection. FIDE is authoritative; a conflicting non-null FIDE ID never becomes a name fallback. Missing-ID games may match the exact full name and always display **Namenszuordnung (nicht verifiziert)**. Same-name players on both sides without an ID anchor are excluded. Existing Spieler privacy suppressions apply to retrieval and candidates.

Existing TWIC records are combined with broadcasts through a service-only paginated RPC and normalized/legally replayed by GamesProvider. The TWIC import/Spieler implementation is reused, not copied. Results are deduplicated by players, date, event, round and mainline. Unsupported, illegal or unfinished PGNs are counted as rejected. At 10,000 raw records the request explicitly fails rather than silently producing incomplete statistics. Named results are not fetched from external websites at request time. The previous nickname export remains below as the secondary source, with its unchanged serialization, cache, 429, login and account-rate limits.

## Official import and license

Use only `https://database.lichess.org/broadcast/lichess_db_broadcast_YYYY-MM.pgn.zst`, verified against the official `broadcast/sha256sums.txt`. **Broadcasts are CC BY-SA 4.0, not CC0**, per the broadcasts section of https://database.lichess.org/#broadcasts . Each record retains archive URL and license; UI shows attribution/license and states that comments were removed. Downloaded PGNs retain original headers; comments and side variations are removed from the stored mainline. No scraping, unofficial archives or third-party search.

`server/scripts/importBroadcast.js` uses streaming Zstandard and bounded per-game parsing, extracts names, WhiteFideId/BlackFideId, event, date, ECO/opening and time control. Source archive cap 256 MiB, record cap 1 MiB, stored PGN cap 64 KiB, bounded mainline tokens. Full legal replay occurs when GamesProvider retrieves games and when the position index examines them; metadata import does not pretend to validate every ply. Local staging is atomic and checksum-verifies both source archive and staged output before reuse. Upsert by deterministic ID is idempotent.

Target guard accepts only local loopback or QA `iukmpcytsuofqhxsumbu`; production is rejected. Stage first (no database credentials/write):

```sh
SUPABASE_URL=https://iukmpcytsuofqhxsumbu.supabase.co node server/scripts/importBroadcast.js --target=qa --end=2026-09 --months=6 --dir=/absolute/staging/path
```

After the exact-head green-CI migration gate, `--apply` with the existing server-only service key writes 500-row batches. The same staged rows can be submitted through the authorized QA SQL connector when server credentials are unavailable; never expose credentials or grant browser import access. Record actual unique DB counts and source SHA-256 values in the PR. Latest six published files at implementation: April–September 2026; staging accepted 207,840 of 224,224 records before ID deduplication. This staging count is **not** a QA import claim. QA import totals are reported after the gated write.

## Position search and interface

The isolated preparation board accepts SAN or German D/T/L/S/K, move numbers, castling and promotions, or two taps/clicks on squares. Promotion choice is explicit. It does not invoke an engine or alter the existing chessboard. A worker legally replays the selected player's games once, indexes positions and reuses existing colour, speed, exact clock and variation name/ECO filters. Position identity is board placement, side to move, castling rights and legally capturable en-passant square; move counters are ignored. Transpositions therefore match. Each game counts once at its first occurrence.

The same board's **Stellung aufstellen** mode offers palette, eraser, clear, side to move, castling rights and FEN. Existing analysis FEN validation checks kings, checks, pawns/promotion material, castling and en passant; invalid input shows **Ungültige Stellung** and does not issue a search. The existing validator checks standard-chess structural legality, not a proof of historical reachability.

Hits show colour and W/D/L/openings from the selected player's perspective. The next-move table counts only positions where that player is to move; each percentage divides by matching games with that player's next move, never opponent replies. Clicking a row plays the legal move and updates the search. A game opens the existing ChessAZ analysis session at the matched position-history index, retaining the full game. No-match variation text remains **Keine Partien in dieser Variante**. Worker and pending requests are terminated on component/token changes; private opponent seeds are consumed once and cleared on identity change.

## Database and acceptance gate

New forward migration `20261027024137_vorbereitung_names_v1.sql` adds the broadcast table and service-only name-candidate/game RPCs. RLS enabled; anon/authenticated have no raw-table or RPC privileges. The existing authenticated backend enforces login and 12 verified-user requests/minute before service access. No new user identifiers or team-public associations. Existing private captain-editable nickname mapping is unchanged.

CI tests: official metadata/license/checksums and interrupted staging; real PostgreSQL applies all Spieler dependencies plus the new migration, tests FIDE priority, exact unverified fallback, conflicting IDs, TWIC union, suppression and denied anon/authenticated access. HTTP covers authenticated named search and allowlists. Frontend tests cover German notation, transpositions, next moves, colour filters, valid/illegal setup and matched-ply analysis. Real Chromium with synthetic data covers primary opponent entry, marked fallback, variation, palette/FEN, next moves, mouse/tap board controls, secondary nickname, account cleanup and 390/1280 widths.

Apply migration to QA only **after both CI runs for the exact PR head are green, zero skips**. Check QA history/table first and record assigned migration version and SQL hash. Run `docs/vorbereitung-names-v1-qa-regression.sql` (ROLLBACK), then import the six official months, verify stored counts/attribution and compare security advisors. Flags `VORBEREITUNG_ENABLED` / `VITE_VORBEREITUNG_ENABLED` remain OFF. No production deployment, maintenance, environment, billing or merge changes. Report and STOP.
