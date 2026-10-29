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

### Derived-game licensing and QA size gate

**CC BY-SA 4.0 applies to derived game data as well as the original broadcast PGN.**
Compact PGNs, SAN-only mainlines, position indexes, name/FIDE links, opening summaries,
next-move statistics and exported subsets derived from Lichess broadcast archives must
retain appropriate Lichess broadcast attribution, archive source URL, a link to
https://creativecommons.org/licenses/by-sa/4.0/, and an indication of modifications.
Redistributed adaptations remain under the same CC BY-SA 4.0 terms. Do **not**
treat these broadcasts or their adapted game records as CC0. The source/license
links must remain visible on every view presenting individual broadcast games.

**QA import storage gate (2026-10-27): HALTED.** Measured QA database size
29,193,907 bytes, 3,500 April broadcast games, 1,672.73 bytes average full PGN,
7,815,168 bytes including broadcast-table indexes. A trial computation keeping only
the seven standard headers plus WhiteFideId/BlackFideId/ECO/Opening/TimeControl and
plain SAN moves averaged 1,169.02 bytes per game. Extrapolated table/index growth
for 207,840 staged records is approximately 380–440 MB, above the owner's 300 MB
ceiling. This is a projection based on the first 3,500 games, not a completed import.
**No further QA inserts** until the storage plan is explicitly revised and a
representative end-to-end size projection is demonstrably below 300 MB.


### Owner decision — compact German-FIDE-only archive (2026-10-27)

Only archive games involving a German `public.spieler_players` FIDE ID, or an exact full-name match when that player's FIDE ID is missing, may be uploaded. The 36,687-player list is exported as a local TSV snapshot, without any secret or user session. `importBroadcast.js` requires `--fide-list=/absolute/snapshot.tsv` for staging and application, and checksum-binds every staged report to this snapshot. Unmatched records are excluded prior to upload. Saved `pgn` is SAN movetext with move numbers and result only; standard tags are reconstructed for ChessAZ analysis from the existing metadata columns. No GPG or encryption step is required or permitted for this batch path.

**Verified local dry run, official SHA-256 archives April–September 2026:** 224,224 raw records; 16,223 candidate PGNs by FIDE ID/exact unmatched-ID name, 14,976 accepted valid games, 1,247 rejected among matches, 0 staged ID duplicates. Stored SAN is 10,972,691 bytes, not a full-game tag/comment corpus. Against 29,193,907 byte QA baseline, projected complete QA database around 45–70 MB including indexes; this is below the owner’s 150 MB gate and is not a guarantee of the eventual size. Of 3,500 preexisting April entries, 537 are eligible; the other 2,963 are removed in QA-only cleanup after CI. No new schema objects or staging tables for import. All imported game-derived data remain CC BY-SA 4.0 with source and license links.
