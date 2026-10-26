# Milestone 3 — Spieler v1

Branch `feat/spieler-v1`, Draft PR #127, based on main `58ae74b671312456314c17d59e1307a98e53fef2`. No merge or production changes.

## Corrected owner acceptance

Search Huseynov must find FM Sabir Huseynov, FIDE ID 13404431. Rating must equal the official imported list, never a hard-coded number. Card displays **FIDE, Stand: <list date>**. The current downloaded list contains 2371; the outdated web value 2379 is not imported or used as an expected test constant.

Official source: https://ratings.fide.com/download/standard_rating_list_xml.zip
Archive entry standard_rating_list.xml: 2026-10-25 23:06:44.
ZIP SHA-256: `6357c562beb767c087f012ff737bc169cb94eab5d2b9d0a44068bd4bc4250d8d`.
List date: 2026-10-25. Import dry run: 36,687 records, GER plus explicitly included AZE ID 13404431. DOB, sex, emails and other unnecessary attributes are not imported. The small checked-in XML test subset comes from that same official file; tests derive expected ratings from its imported records.

FIDE has no club field. Importer cannot import clubs. Public club is derived only from a player's voluntarily supplied, operator-verified Das bin ich claim. Pending club claims remain private. No inferred or scraped clubs, DSB/DeWIS data, ChessBase or geolocation. DWZ is —; DSB provider is a non-network permission-required stub.

## Security and flags

Server `SPIELER_V1_ENABLED` and client `VITE_SPIELER_V1_ENABLED` require literal true and default false. No live-game handler, clock, result, matchmaking or rating write is changed. With server flag off, all Spieler requests return 404 before storage/auth/provider calls. Client flag off hides route/navigation.

Raw catalog/TWIC tables are server-only. All four new tables have RLS. Authenticated users may read only their own claim/opt-out rows; they cannot insert/update/approve requests directly, enumerate catalog rows or execute server-only RPCs. HTTP verifies Supabase identity and never trusts body/JWT user metadata for ownership. Claims stay pending until operator verification. Unverified opt-out is pending moderation; verified owners can hide their own card. Search, direct ID and game requests respect approved hiding. No automatic identity inference from names or online nicknames.

Lichess/Chess.com adapters use official read-only public nickname APIs, fixed hosts, no redirects, bounded response size/time and an HTTP request budget. TWIC uses operator-provided official PGNs with exact FIDE-ID tags. Opening summaries describe up to 25 sample games; unknown opening names show actual moves. In Analyse öffnen validates PGN and uses the existing analysis-session flow; invalid PGN leaves the previous session unchanged.

## Import operation

Use the official manually downloaded/unzipped XML. Local/QA URL guard rejects production and all other remote targets. Defaults to dry run:

```sh
node server/scripts/importFideGer.js --file=/path/standard_rating_list.xml \
  --target=qa --date=2026-10-25 --include=13404431 --out=/path/players.json
```

`SUPABASE_URL` must be the exact QA URL (or explicit loopback URL with target local). Native --apply requires a server-only credential; no secret is printed. The assistant may transport the generated records to the same QA database through the authorized Supabase connector, without extracting a service key. Clubs are never accepted by this import path.

## Verification / hosted state

Corrected code commit `256e731dcfbb3d3690ea3a0501dd157d189c6012` passed Server CI 157/157 and Frontend CI 136/136, zero failures/skips. Real PostgreSQL directory/RLS tests ran. Typecheck/build and existing real-browser mobile regression passed; lint zero errors / 57 existing warnings.

After those green checks, exact reviewed migration `20261026184317_spieler_v1.sql` was applied only to QA `iukmpcytsuofqhxsumbu`, recorded version **20261026190900 / spieler_v1**. It is now applied and immutable. No historical migration or migration history was changed.

The importer dry-run output was transported through the authorized Supabase connector into QA in 37 bounded batches. All **36,687** records were confirmed in QA. Search Huseynov finds FM Huseynov, Sabir, FIDE ID 13404431; rating and list date exactly equal the actual imported XML record (2371, 2026-10-25), with club NULL. No club column exists in the raw imported catalog.

`docs/spieler-v1-qa-regression.sql` passed on hosted QA using a completely rolled-back transaction and two existing QA actor IDs, without creating auth users/sessions/tokens. Assertions cover own/outsider RLS, denied raw/RPC access, no self-approval, private pending club, verified voluntary club, and opt-out filtering for surname and ID. A fresh post-rollback read confirmed zero claim and opt-out rows, with all 36,687 imported players preserved. Security advisors add only the intended informational RLS-without-policy notices for the two server-only tables; browser grants are revoked. These directory checks do not claim hosted game recovery acceptance.

Preview target is only chessaz-preview-workspace, never azchat-chess/production and never promote. Flags stay off by default; QA backend deployment or enabling runtime flags is not part of the requested preview build. Hosted durable-game acceptance remains postponed and cannot be substituted by these directory checks. PR #126 remains Draft and Squash and merge only.
