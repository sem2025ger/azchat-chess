# Milestone 5b — Vorbereitung (default OFF)

Branch `feat/vorbereitung-v1`, PR base `feat/spieltag-v1` (#129). Required merge order #127 → #128 → #129 → this PR, **Squash and merge only**; retarget and recheck each dependent diff/CI after a dependency squash. Existing GamesProvider, SpielerCard and Spieltag files are extended in place. No duplicated provider/player/team implementations and no applied migration edits.

## User flow

Enter a Lichess username in Vorbereitung to load up to 200 latest completed standard games. Eröffnung/Variante accepts a case-insensitive part of the official Lichess opening name (for example Najdorf) or an exact ECO code (for example B90). The game list, white/black totals and opening rows use the same filtered sample. Colour, speed category and exact clock controls can be combined. Win/draw/loss percentages are from the named account's perspective, with each colour/opening group as its denominator; zero groups show zero rather than NaN. Rounding is to one decimal. No matches says **Keine Partien in dieser Variante**.

Every listed game opens with one click through the existing `openSpielerAnalysis` handoff, which validates the PGN and saves the existing analysis session. No game, clock, move-validation, engine or board-rendering code is changed.

Entry points: existing Schach-Treff desktop player-card popup; existing SpielerCard; Spieltag Gegner. The first two open a blank username form and do not infer a Lichess account from the person's real name, FIDE ID or ChessAZ username. A Spieltag captain can attach/remove an opponent's username, always labelled **Lichess-Konto: … (nicht verifiziert)**. Preparation links pass the public username in navigation state, not URL parameters; no access token is placed in a URL. The preparation screen labels the loaded account separately from the editable input and describes the 200-game sample/cache limitation. There is no claim of verified identity, complete repertoire or complete statistics.

## Official Lichess access

The existing `server/spielerGamesProvider.js` now has `GamesProvider.preparation`. Only `https://lichess.org/api/games/user/<validated username>` is used for this feature: Accept `application/x-ndjson`, `opening=true`, `pgnInJson=true`, `max=200`, `sort=dateDesc`, finished only, standard performance types. No OAuth key or Authorization header is sent upstream, no scraping or other provider is used by Vorbereitung.

One module-global access gate serializes Lichess requests across provider instances, including the existing Spieler Lichess PGN export. The gate remains held through consuming/cancelling the body. All calls carry `User-Agent: ChessAZ/1.0 (+https://github.com/sem2025ger/azchat-chess/issues)`, a real project contact URL. On 429, a global 60-second cooldown blocks further outgoing Lichess calls, including queued/legacy calls. Clients receive 429 plus Retry-After and retry manually after the interval; the server does not repeatedly retry during the pause. Cache hits may still be served without any outgoing call.

Limits: 30-second upstream timeout; 8 MiB streaming response cap; 128 KiB NDJSON line cap; at most 200 nonempty records consumed; normalized PGN max 64 KiB and 2,048 plies using the existing normalizer. Unsupported/malformed games, other users, ongoing games and invalid results are excluded. A malformed JSON stream or exceeded byte cap fails closed and is not cached. Duplicate Lichess IDs retain the first/latest record. PGN validation and official JSON opening name/ECO are reused, never an invented opening classification.

Cache: case-insensitive username, 15-minute TTL from completed fetch, concurrent requests for the same account coalesced. At most 32 cache entries / 16 MiB of serialized data, bounded 16 in-flight accounts and 16 queued Lichess operations. These controls apply per Node server process; any future multi-process deployment requires shared coordination before scaling this exporter. No usernames, game data or team associations are persisted by this cache.

Official references: https://lichess.org/page/api-tips and https://github.com/lichess-org/api/blob/master/doc/specs/tags/games/api-games-user-username.yaml .

## Flags, authentication and private team association

- Backend `VORBEREITUNG_ENABLED`, frontend `VITE_VORBEREITUNG_ENABLED`, both default OFF. The authenticated API is `/api/vorbereitung/:username`; optional validated filters are colour, speed, exact timeControl and variation. The UI downloads once and applies these shared filters locally, without new upstream calls for every keystroke.
- API login uses the existing verifier. A one-hop Render IP pre-limit (120/min) runs before verification, and a verified-account limit (12/min) survives token/IP rotation. Responses are no-store, errors do not expose backend diagnostics. Route/UI state is cleared and requests aborted on identity/token changes. No new credentials or external account login.
- New forward migration `20261027015306_vorbereitung_v1.sql` adds only nullable `spieltag_boards.opponent_lichess_username`, validates 2–30 username characters and grants column UPDATE under the existing captain-only RLS. Existing explicit team-read RLS protects the association. No public profile/FIDE association or verification flag is created.
- `PATCH /api/spieltag/matches/:match/boards/:board/lichess` is additionally gated by Vorbereitung, uses the existing request-scoped user-JWT client, allows only `{username: string | null}`, and retains RLS against foreign teams and ordinary members. Changing a nickname does not change game/board identifiers or results. The existing board update serializer deliberately excludes the new field, so editing lineup/results cannot accidentally erase it.
- The flag gates application entry/API; the database's authoritative team membership continues to protect direct Data API requests. General preparation of public games requires login, but does not turn a team-private manual association into a public directory.

## Validation and QA gate

CI includes official NDJSON format, opening metadata, target-user checks, latest ordering, shared serialized legacy/new Lichess access, byte/line/game caps and cancellation, 15-minute cache/coalescing/bounds, full 60-second 429 handling and retry recovery. Shared variation tests cover name, exact ECO, colour/clock combinations, white/black WDL denominators and empty results. HTTP tests cover flags, login, rate limits, allowlists and Retry-After. PostgreSQL applies all dependencies then the new migration and checks captain-only nickname attach/read/removal, denied member/outsider/other-team access and invalid names.

Frontend/Chromium regression covers entry from Spieltag Gegner, private nickname and unverified label, loading, name/ECO/no-match filtering and the existing one-click analysis session, plus prior captain/member/account-change safeguards. SpielerCard entry and read-only member nickname rendering are also checked. These browser scenarios use synthetic auth/API data, not a claim that hosted flags were enabled.

Apply the new migration to **QA iukmpcytsuofqhxsumbu only AFTER both exact-head CI runs are green with zero skips**. Inspect history/column first; do not apply twice. Record actual assigned version and SQL hash in the PR. Then execute the extended `docs/spieltag-v1-qa-regression.sql` in its fully rolled-back transaction, inspect a separate post-rollback state and compare security advisors.

Flags, production, maintenance and hosted environment/deployment settings remain unchanged. Existing gameplay acceptance/Frankfurt gates remain in force. Report and STOP.
