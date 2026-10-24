# Games Database v1 — evidence, 24 October 2026

PR: https://github.com/sem2025ger/azchat-chess/pull/99

## Scope and stage status

- Stage 1: implemented. Masters position search, documented move statistics, top games and PGN loading into the existing analysis. Current Masters statistics require a server token; none was obtained or configured during this task.
- Stage 2: implemented. Explicit Lichess username search, at most 30 recent standard games by default / 50 maximum, in-memory opening statistics by colour, PGN loading and optional source links.
- Stage 3: implemented behind `GAMES_DB_ENABLED=false` and `TWIC_IMPORT_ENABLED=false` defaults. QA-only schema applied, security and synthetic transactional checks passed. Real TWIC ingestion and public redistribution remain disabled pending rights clearance. No real issue was downloaded or imported.
- No main merge, production database writes, deployment, Vercel/Render setting changes, maintenance changes or paid services were performed by this milestone.

## Repository findings and reused mechanisms

- Server: CommonJS JavaScript, `server/index.js`; dotenv reads process environment at boot. Existing HTTP API had `/health` and a shared CORS allow-list; Socket.IO has separate authentication and socket rate limiting. `monitoring.expressErrorHandler` observes final HTTP errors. New routes mount once at `/api/games`; no socket handlers, auth handlers or durable-game implementation were modified.
- Existing server-side database path: `server/matchPersistence.js` and `server/durableStore.js` use `@supabase/supabase-js` with `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` and disabled auth-session persistence. The new independent `server/src/games/db.js` follows that path. It does not import or change either existing adapter and has no browser-key fallback.
- Tests: server `node --test *.test.js`; frontend `node --test tests/*.test.mjs`, TypeScript, Vite and ESLint. There is no server build script. No test framework was added. Existing PostgreSQL CI service runs isolated-database integration tests. Source tests mock fetch; CI needs no Lichess/TWIC network.
- Chess library: both server and frontend already depended on `chess.js` 1.4.x; no chess-library dependency change.
- Analysis: `tmp/src/screens/GameScreen.tsx` exposes the selected FEN as `displayedGame.fen()`. `tmp/src/utils/analysisWorkspace.ts::analysisFromPgn` parses the PGN. Existing `loadWorkspaceAnalysis` updates positions, moves, title and replay state and saves the session; this is reused unchanged. There is no separate unsaved-analysis flag; the existing workflow saves analysis automatically.
- Existing desktop workspace tabs are Analysis / Position map / Games. The existing Games tab now contains source search and the preserved personal saved-games panel. Mobile Analysis / Moves gets a complete Games label opening the existing native tools dialog; the overflow-menu entry remains. The desktop source component unmounts below its breakpoint, so a CSS-hidden panel cannot keep fetching.
- i18n: `tmp/src/translations.ts` / `LanguageContext`, six locales `en,de,az,tr,ua,ru`. All new visible UI text is represented in all six. No new strings were added to the pre-existing hard-coded desktop toolbar.

## Current official external findings

Verified on 24 October 2026. Raw-document browser fetch initially failed for GitHub; the official specification files were then read successfully through the GitHub connector and a local HTTPS fetch.

| Source | Official URL | Finding used |
| --- | --- | --- |
| Masters API | https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/masters.yaml | `https://explorer.lichess.org/masters`; `fen`, `play`, `since`, `until`, `moves`, `topGames` (max 15). OAuth2 with no extra scopes is declared. This implementation uses FEN and topGames only. |
| Masters response | https://github.com/lichess-org/api/blob/master/doc/specs/schemas/OpeningExplorerMasters.yaml | Aggregate white/draw/black counts, moves and `topGames`; the current schema contains neither a `recentGames` field nor a recentGames parameter. The normalized contract returns `recentGames: []`; the UI explicitly explains that this list is not supplied. No invented recent games. |
| Masters game | https://github.com/lichess-org/api/blob/master/doc/specs/schemas/OpeningExplorerMastersGame.yaml | id, winner, white, black, year, optional month; winner is mapped to the result. No undocumented event field is fabricated. The conservative eight-alphanumeric id guard matches the official examples; the schema itself declares only string. |
| Master PGN | https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/masters-pgn-gameId.yaml | `/masters/pgn/{gameId}`, PGN text. Specification declares OAuth2, but the documented sample returned HTTP 200 anonymously in the live check; anonymous PGN retrieval is permitted by this client, with 401/403 still surfaced as authorization required. |
| User export | https://github.com/lichess-org/api/blob/master/doc/specs/tags/games/api-games-user-username.yaml | `/api/games/user/{username}`, NDJSON via Accept, max/moves/opening/pgnInJson, reverse chronological order. The documentation describes anonymous export (20 games/s) and authenticated export (30 games/s, own 60). This client requests finished standard-speed games, not variants or ongoing games. |
| Export fields | https://github.com/lichess-org/api/blob/master/doc/specs/schemas/GameJson.yaml | players, createdAt, speed, winner, opening and PGN map to the normalized contract. Opening scores use wins plus half-draws from the searched player's perspective and only this sample. |
| Rate rules | https://lichess.org/page/api-tips | One outbound request at a time; full 60-second pause after 429. Both hosts share the serialized client and cooldown; the timeout covers body consumption. |
| TWIC archive | https://theweekinchess.com/twic | Weekly downloads use `https://theweekinchess.com/zips/twic<issue>g.zip`. Latest issue is parsed from archive download links, not hard-coded. At inspection it was issue 1667 (19 October 2026, 8,561 games). The archive limits the magazine to personal use and reserves rights. Permission for a public ChessAZ database is therefore unverified; import/public serving stay disabled. |
| Render Free | https://render.com/docs/free#spinning-down-on-idle | Free web services sleep after 15 minutes of inactivity; an in-process daily import timer cannot guarantee a schedule while sleeping. No paid upgrade was performed. |
| Proxy safety | https://expressjs.com/en/guide/behind-proxies/ | Trust must match the actual proxy chain; forwarding headers are spoofable otherwise. The new rate limiter has a scoped, explicit hop-count option and does not alter Express's global auth/socket-related proxy behavior. |

Live checks, sequential, no token or real game payload persisted:

- Masters starting position, topGames=1: HTTP 401.
- Masters sample PGN `aAbqI4ey`: HTTP 200, 687 bytes.
- User export sample, max=1: HTTP 200, 1,389 bytes.
- No 429 occurred. No further live requests were needed.

## Implementation and commit groups

1. `feat(games): add bounded Lichess client and Masters routes with tests`: `server/index.js`, `server/src/games/{errors,validate,cache,lichessClient,normalize,routes}.js`, `server/gamesSources.test.js`.
2. `feat(analysis): integrate Masters search into desktop and mobile Games workspace`: `GamesLibraryPanel.tsx`, `MobileAnalysis.tsx`, `GameScreen.tsx`, `gamesDatabase.ts`, translations and frontend contract tests.
3. `feat(games): add player export, opening statistics and search mode`: `userGames.js`, routes, source tests and corresponding frontend modes/types/translations.
4. `feat(db): define QA-only game index with server-only RLS grants`: one additive migration, generated through Supabase CLI. Its filename was subsequently aligned with the QA migration version: `20261024045303_games_database_v1.sql`.
5. `feat(games): add guarded QA TWIC importer, hashing and size limits`: server DB adapter, `twic/{pgn,importer,cli}.js`, importer tests, package and lockfile.
6. `feat(games): add gated database search, QA integration tests and scheduler`: parameterized search routes, isolated PostgreSQL test, daily scheduler, frontend database mode, strengthened saved-games regression and migration-version alignment.
7. Follow-up fixes: observed public PGN access, documented move-field validation, complete phone tab labels, scoped proxy identity and stopping requests from a hidden desktop panel. Each has a regression assertion.
8. Documentation: this report and `.env.example`. The requested AGENTS additions are pending explicit owner permission in a user message: automatic approval review rejected publishing that protected file, including after checking the attachment. AGENTS.md remains unchanged in the remote PR; proposed entries are preserved below.

New runtime dependency: `fflate` 0.8.3 only, for bounded in-memory ZIP extraction. No database dumps, real PGNs, ZIPs or personal data are committed. Lockfile changes are limited to this dependency; the existing security patch is preserved.

## Database objects and QA evidence

QA ref: `iukmpcytsuofqhxsumbu`. **Nothing applied to production.**

- Tables: `chess_db_games`, `chess_db_positions`, `chess_db_imports`.
- Indexes: games primary id, unique game_hash, white/black prefix indexes, year, ECO; positions primary `(pos_hash,game_id,ply)` plus game_id covering index; imports primary issue. No new extension. pg_trgm was not installed on QA; name search is prefix-only.
- All three tables: RLS enabled, no anon/authenticated policies or table grants. Sequence also revoked from browser roles. Only service_role has table/sequence access.
- Functions: `chess_db_control(text,int,jsonb,int,text,int)` and `chess_db_search(text,bigint,int,int)`, SECURITY INVOKER with empty search_path; execute revoked from PUBLIC/anon/authenticated, granted only to service_role. SQL uses function parameters, not dynamic SQL.
- Import batches are atomic with advisory locking, unique game hash, index insertion only for newly added games, pre-batch budget estimate and post-insert size check inside the transaction. Only plies 1–24 are indexed. No browser import endpoint exists.
- CLI and scheduler hard-refuse every target except the explicitly supplied QA ref. Both import flags default off. No credentials were retrieved or logged.
- Migration applied: yes, QA only. Synthetic QA transaction: inserted=1, duplicate inserted=0, combined name/position search total=1, RLS/grant assertions passed; then ROLLBACK.
- Final QA state after verification: games=0, positions=0, imports=0. Size before schema 12,293,811 bytes (11.72 MiB); after schema/rolled-back verification 12,555,955 bytes (11.97 MiB). Small physical allocation from schema/testing remains; no test rows remain.
- Real one-issue import: not executed because public reuse permission is not established. Real inserted/skipped and measured MiB per issue are unavailable. The 300 MiB total-database budget leaves about 288 MiB at the observed QA size; the number of issues that fit cannot be established responsibly from one synthetic short game. The default four-issue backfill can stop early at the budget and must not be assumed to fit.
- After TWIC rights clearance, with the owner's existing QA-only server credentials loaded securely and `TWIC_IMPORT_ENABLED` set by the owner, start with `npm --prefix server run twic:import -- --issue 1667 --target-ref iukmpcytsuofqhxsumbu`. No inline credential or new paid infrastructure is required. The CLI emits inserted/skipped and size before/after; use those measurements before backfilling. No production import is allowed by this implementation.
- Supabase security advisor: new tables intentionally produce INFO `rls_enabled_no_policy` because they are server-only. Existing leaked-password-protection warning was unchanged. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Validation

- Frozen installs: `npm ci --legacy-peer-deps` passed for server and frontend.
- Frontend: 106 tests passed, TypeScript and Vite build passed; lint 0 errors / 50 existing warnings. Browser source modes were tested against explicit synthetic API responses, not represented as live masters data.
- Server: 127 tests passed locally; 3 PostgreSQL-only suites skipped locally because no local Postgres binary/service was available. Required CI runs them against its disposable Postgres 17 service.
- Production audits: server 0 vulnerabilities; frontend 0 high/critical, 2 moderate entries in existing react-router/react-router-dom. Both requested high-severity gates pass. No unrelated dependency upgrade or audit-fix sweep.
- Browser: Chromium at 360/390/430/1280 px; all three source modes; no horizontal overflow or clipped mobile tab labels; explicit-submit-only player requests; every mode's empty/error state; Retry-After message; existing PGN load path; hidden DB mode when status.db=false; no fetch while Games is closed. A further resize check confirms a hidden desktop source panel stops requesting. Screenshots show synthetic fixture data, not user data.
- Existing real-Stockfish browser regression passed locally: all mobile geometries, real Stockfish 19 identity, two mobile PV lines, move/history/flip controls, editor validation and three/five desktop PV lines. Exact final PR-head CI results are recorded in the PR description.
- Server has no build script, so no invented server build command was executed.

## Environment names and owner decisions

Nothing was set or changed on Render or Vercel.

| Name | Where / default / action |
| --- | --- |
| `GAMES_LICHESS_ENABLED` | Server, default true. Disable both Lichess routes if needed. |
| `LICHESS_API_TOKEN` | Server only; owner must supply a Lichess OAuth token for Masters statistics. Never frontend. |
| `GAMES_DB_ENABLED` | Server, default false; keep off until data rights and QA acceptance. |
| `TWIC_IMPORT_ENABLED` | Server/QA CLI, default false; keep off pending rights clearance. |
| `TWIC_MAX_DB_MB` | Server/CLI, default 300 MiB, cannot be configured above 300. |
| `GAMES_TRUST_PROXY_HOPS` | Server rate limiter only, default 0. Owner must verify actual Render forwarding topology before configuring per-client limits behind it. Without that verification, proxy traffic may share one conservative 30/min bucket. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Existing server-only path; explicit QA for import/schema work. No frontend key fallback. |
| `VITE_SERVER_URL` | Existing frontend setting; reused unchanged. |

Open decisions: TWIC permission and exact required attribution if permission is granted; Lichess token; privacy notice naming Lichess and TWIC as data sources; scheduling reliability on sleeping Render Free; verified proxy chain. No auth, game flow or durable-game redesign is included.

Native review recommended for all new `games.*` keys in Azerbaijani, Turkish and Ukrainian; German/Russian/English were written directly. The typed dictionaries and tests enforce complete six-language coverage. The complete key list is obtained with `Object.keys(translations).filter(k => k.startsWith('games.'))`; it includes tab/tabShort, saved/sources, position/player/db, loading/retry/seconds/count/draws/top/recent/noRecentMasters, attributionMasters/attributionLichess/attributionTwic, disabled/open, username/search/openings/sample/emptyPlayer/noOpenings, playerName/onlyPosition/dbInfo/emptyDb/more, and error.INVALID_FEN/INVALID_QUERY/INVALID_USERNAME/NOT_FOUND/FEATURE_DISABLED/UPSTREAM_RATE_LIMITED/UPSTREAM_AUTH_REQUIRED/UPSTREAM_UNAVAILABLE/INTERNAL.

## Pending protected-file approval

Automatic approval review rejected including AGENTS.md in the remote tree because it did not accept the attachment as explicit permission in trusted user text. The action remains blocked; it was not retried through another route. Other code and documentation are delivered without changing that protected file. Owner confirmation is required before adding these proposed notes:

- Section 6: Games Database v1 uses server-side Lichess sources, bounded in-memory player data, disabled TWIC flags, QA-only import, plies 1–24 and a 300 MiB total-database budget. Activation and merge remain owner-only.
- Section 7, exact requested text: Supavisor session pooler ignores PGOPTIONS; to enforce read-only use BEGIN READ ONLY and verify SHOW transaction_read_only inside the same session.
