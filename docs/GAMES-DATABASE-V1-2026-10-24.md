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
8. Documentation: this sanitized public evidence report and `.env.example`. AGENTS.md is unchanged: automatic approval review rejected the requested additions and requires explicit permission naming that protected file. This administrative exception does not prevent code review; deployment and activation remain separate owner steps.

New runtime dependency: `fflate` 0.8.3 only, for bounded in-memory ZIP extraction. No database dumps, real PGNs, ZIPs or personal data are committed. Lockfile changes are limited to this dependency; the existing security patch is preserved.

## Database and QA summary

**Nothing applied to production.** The additive migration was applied only to the approved QA environment.

- The implementation adds game, opening-position and import-progress storage with supporting indexes. Name search is prefix-only; no new extension was installed.
- Synthetic checks verified duplicate prevention, combined name/position lookup, restricted browser access and atomic imports. Test rows were rolled back; the game tables remain empty.
- No real TWIC issue was imported. Storage per issue and the number of issues fitting the budget remain unmeasured. The enforced 300 MiB total-database budget must be checked before real backfill; a four-issue request is not a promise that four issues fit.
- Actual QA project identifiers, connection information and environment-specific advisory details are omitted from this public report. No credentials or real game data are included.
- Real import and public distribution remain disabled pending source-rights clearance and owner activation. No production import is allowed by this milestone.

## Validation

- Frozen installs: `npm ci --legacy-peer-deps` passed for server and frontend.
- Frontend: 106 tests passed, TypeScript and Vite build passed; lint 0 errors / 50 existing warnings. Browser source modes were tested against explicit synthetic API responses, not represented as live masters data.
- Server: 127 tests passed locally; 3 PostgreSQL-only suites skipped locally. The checked code revision subsequently passed 151/151 tests in CI, with zero skipped tests, including isolated PostgreSQL checks.
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


## Closure status

The functional code passed both required CI checks, frontend 106/106 and server 151/151, including real-Stockfish browser regression. The final documentation-only update does not enable any feature, import data, change credentials, alter hosting settings, merge the PR or publish the site. The PR description records CI links for the current revision. Source-rights clearance, token provisioning and operational activation are separate owner steps.

Administrative exception: the two requested AGENTS.md additions remain unapplied because automatic approval review requires explicit approval of that exact protected-file change. No alternative file is used to override existing instructions.
