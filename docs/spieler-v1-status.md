# Milestone 3 — Spieler v1 (blocked on acceptance data)

Branch: `feat/spieler-v1`, from main `58ae74b671312456314c17d59e1307a98e53fef2`.
Draft work only. Do not merge, deploy a backend, enable flags or apply the migration while the acceptance discrepancy below is unresolved.

## Owner decision required

The requested acceptance example is FM Sabir Huseynov, Bochumer SV 02, FIDE 2379.
The actual official bulk XML downloaded from
`https://ratings.fide.com/download/standard_rating_list_xml.zip`
contains FIDE ID `13404431`, name `Huseynov, Sabir`, federation `AZE`, title `FM`, **standard rating 2371**.
The archive entry `standard_rating_list.xml` is dated **2026-10-25 23:06:44**.
Downloaded ZIP SHA-256: `6357c562beb767c087f012ff737bc169cb94eab5d2b9d0a44068bd4bc4250d8d`.
The earlier web-rendered FIDE profile showed 2379 and a rating history ending August 2026. That page is not evidence that the newer official list has the same rating.

The importer must not fabricate or pin 2379 to satisfy the acceptance check. Owner must choose either the current-list acceptance value **2371**, or a clearly dated historical official snapshot containing **2379**. This is the global STOP condition for contradictory criteria, not a request for production access.

Sabir's federation is AZE, not GER. He is included only through explicit FIDE-ID inclusion, alongside the GER filter. The club value `Bochumer SV 02` is owner-supplied voluntary text; no DSB/DeWIS/ChessBase data is loaded. DWZ remains unavailable.

## Prepared implementation

- Server `SPIELER_V1_ENABLED` and client `VITE_SPIELER_V1_ENABLED`: strict literal `true`, **false by default**. No flag/env changes executed. Disabled HTTP paths return 404 before database/provider work; disabled client exposes no Spieler route/navigation.
- New forward migration `20261026184317_spieler_v1.sql` (CLI-generated): imported FIDE catalog, claims, opt-outs and TWIC PGNs. No hosted application yet and no migration-history version to report.
- Browser roles cannot enumerate raw catalog/games, call server RPCs, forge claims, approve themselves or hide another player. RLS exposes only each authenticated user's own requests. Search and direct-ID reads both exclude approved opt-outs.
- `Das bin ich` creates a pending request, not verified identity. Unverified hiding is a pending moderation request; only an operator-verified owner can cause immediate hiding. Approval requires the separate operator identity-verification process; no automatic matching by name/email/nickname.
- Surname-prefix search, card with FIDE title/rating and voluntary club; DWZ `—`; Partien tab with read-only GamesProvider adapters for explicit public Lichess/Chess.com nicknames and operator-imported TWIC PGNs. Nicknames are not verified real-person associations. Bounded requests, fixed external hosts, no redirects, no scraping.
- Opening summary is a bounded 25-game sample using PGN headers (or actual opening moves if unavailable), not invented theory statistics. `In Analyse öffnen` reuses existing PGN validation and analysis-session storage; no live-game handlers/clock/results/rating writes changed.
- DSB adapter is a non-network stub until written permission.

## Import checks performed without writes

Official standard FIDE XML was downloaded and processed locally. Dry run selected **36,687** records (GER plus explicitly included `13404431`). No hosted rows were written. DOB/sex and other unnecessary source attributes are not imported.

Example, after the owner resolves the snapshot choice:

```sh
# SUPABASE_URL must be exactly the QA project URL or an explicit local HTTP URL.
# Obtain/unzip the official bulk XML separately; no profile-page scraper.
node server/scripts/importFideGer.js --file=/path/standard_rating_list.xml \
  --target=qa --date=2026-10-25 --include=13404431 \
  --clubs=/path/owner-voluntary-clubs.json --out=/path/selected-players.json
# Dry run by default. --apply requires the server-only QA credential and green CI.
```

The target guard rejects production, alternate remote hosts, deceptive host suffixes, URL credentials and non-root paths. The TWIC import also shares this local/QA guard. No credential was retrieved or printed.

## Validation and remaining work

Local build/typecheck passed. Frontend **135/135**, zero failures/skips. Lint zero errors / 57 existing warnings. New server tests: **11 passed, 1 real-PostgreSQL parent skipped locally**; do not call that database verification. Draft CI must execute the full server/frontend suites including real PostgreSQL. Further browser/visual and hosted acceptance remain incomplete.

The historical 2379 unit fixture tests the supplied example's rendering/data contract; it is not a claim that the current official list contains 2379.

No production, Render, hosting, maintenance, paid setting, real-game test or database setting changed. QA migration application, QA data import and preview activation remain blocked. PR #126 was updated with the accepted **Squash and merge only** requirement; it remains Draft and blocked by the postponed hosted durable-game test.
