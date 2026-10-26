# Closed-test preparation — 26 October 2026

Last updated after QA migration retry on 2026-10-26. Production remains unchanged.

## Completed

- PR #119 merged with Rebase as `4dab0dba2ea4a43126ec2dd814573a311066af85`: approved Soft Graphite default, restrained Chess Arena highlight and XL sidebar/globe sizes. Globe playback behavior is unchanged.
- PR #120's final Settings surface change merged through replacement PR #121 as `cf80ae61810f42b2fbfa4b46747edd79fc581694`. GitHub rejected rebasing #120's intermediate conflicting test commit. #121 has the same final UI diff and the same assertion in a separate file; neither branch was force-pushed. #120 is closed as superseded.
- PR #122 merged with Rebase as `c5735e6d21721794f391cd66a60e146c8d8de441`: Inter 5.3.0 is served locally for normal weights 300–900 and all upstream subsets, with the OFL notice. No Google Fonts links remain in the entry document.
- Live browser verification of `https://chessaz.de/` shows only the launch-maintenance page ("We are preparing for launch" / "The platform will be available soon").
- Vercel's automatic main deployment `dpl_4RQWTCqJBuFG777XS1BmXpTRNu2U` is READY on `c5735e6`. No hosting settings, secrets, domain routing or maintenance flag were changed.

- PR #124 merged with Rebase as `e1356ad52b8651eaa00b2617778d1d91e9b5e81c`: compatible lockfile updates removed all eight high-severity frontend install findings. Full install audit: zero high/critical, five moderate; runtime audit: two moderate React Router findings.
- PR #125 merged with Rebase as `58ae74b671312456314c17d59e1307a98e53fef2`: pure Glicko-2 calculation core with seven regression tests. Runtime integration and rating writes are not implemented or active.
- Draft PR #126 review-fix code `6a4fd55d4b8d95bbf70a2fe5ac815b5400059176`: Server CI 151/151 and Frontend CI 135/135, zero failures/skips. Real PostgreSQL and the single-limiter Socket.IO regression ran in CI. Build/typecheck passed; lint zero errors / 57 existing warnings.

## Evidence

Exact PR #122 head: `6041bd7511f0e55e8c9c6e113e757ed1ba5a61f9`.

- [Frontend CI](https://github.com/sem2025ger/azchat-chess/actions/runs/40331808619): 132 tests passed, zero failures/skips; typecheck/build passed; lint has zero errors and 57 existing warnings.
- The same CI's real-Chromium test loaded Inter 300–900 with Latin/Cyrillic samples, observed local font asset requests and zero `fonts.googleapis.com` / `fonts.gstatic.com` requests. Existing desktop/mobile analysis behavior checks passed.
- [Server CI](https://github.com/sem2025ger/azchat-chess/actions/runs/40331808610): 138 tests passed, zero failures/skips, including isolated PostgreSQL and fresh-process crash recovery. Server production audit reports zero vulnerabilities.
- The initial Inter verification still had eight high development/build dependency findings; PR #124 subsequently removed those through compatible lockfile updates. No automatic major-version upgrade was performed.
- Local frozen install, build, 131 frontend tests and lint passed for the Inter branch before combination with #121. Local server run: 112 passed / 5 PostgreSQL-dependent skips. Do not describe those skips as local integration success. The CI numbers above include the combined main changes and real PostgreSQL.
- Local Chromium download was unavailable; browser evidence comes from CI, not a claimed local browser run.

## Database state

Initial inspections used explicit read-only transactions. The owner subsequently authorized QA-only migration application. Production received no migration, data write, migration-history repair or project-setting change. The production column below reflects the earlier read-only inspection, not an activation claim.

| Object | QA `iukmpcytsuofqhxsumbu` | Production `kmwfvvliundhuovoakoa` |
| --- | --- | --- |
| `public.durable_games` | Present; QA version `20261026135741` | Absent |
| `public.durable_game_transition(...)` | Present; browser access denied | Absent |
| `public.username_available(text)` | Present | Absent |
| `public.set_club_pin(uuid,text)` and pin columns | Present | Absent |
| Phase 4 challenge table | Present; QA version `20261026142732` | Absent |
| Summary authorization / accepted cleanup | Present; QA version `20261026150625` | Not applied by this work |
| Private rooms / hashed invites | Present; QA version `20261026152003` | Not applied by this work |
| Ten-active-invite limit | Present; QA version `20261026152016` | Not applied by this work |

Production had 10 completed matches at the earlier inspection. The existing matches columns match the durable migration's insert contract. This does not prove live crash recovery or activation readiness.

Supabase security advisors: production reports leaked-password protection disabled, plus informational RLS-without-policy notices on server-only tables. QA additionally flags the intended username/pin SECURITY DEFINER RPCs. Check the authorization and grants, not just the warning count; do not widen policies to silence warnings.

- [Password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Exact migration sources and status

Do not run `db push` against production or replay historical/bootstrap migrations. Recorded versions differ from repository names for several already applied migrations; reconcile in a separate reviewed change, not by blindly reapplying SQL.

| Repository file | SHA-256 | Status / next action |
| --- | --- | --- |
| `20261019215514_durable_active_games.sql` | `b250aae842ab272dedd7f00c72cd43b80b3289f88f41b589f5a76ca46540bcbc` | Applied to QA as `20261026135741`; hosted backend acceptance is outstanding. Production requires separate approval. |
| `20261025173000_schach_treff_username_available.sql` | `e21ac920b9ad630fee0486f9ef0aff35e73126fdffa08b913de92a083081f664` | Already on QA with recorded version `20261025165211`; production application needs separate owner approval. |
| `20261025184000_schach_treff_pinned_message.sql` | `b64971935af73dc886ec4be0acacc477c11f72f0e57a2098594e423e092e4595` | Already on QA with recorded version `20261025174913`; production application needs separate owner approval. |

QA/production username anonymization is already recorded; do not repeat that backfill. Production's recorded version is `20261025163216`, differing from the file's `20261025164000` prefix.

Durable migration objects: one table (`durable_games`, RLS enabled), its recovery index and one SECURITY INVOKER RPC. Browser roles have no table/RPC access; only `service_role` receives the required table privileges and RPC EXECUTE. The migration alone does not activate persistence.

## Step 4 and production approval boundary

The durable schema and the three challenge/private-room review migrations are installed on QA. Database-role durable ACL/start/retry/completion assertions passed with rollback; the additional hosted QA review checks also passed and rolled back. They verified summary outsider `42501`, self/shared access, stale accepted cleanup, live-room preservation, private-room isolation, token-hash ACL, invite cap and idempotent join. A fresh read found zero fixture users/rooms, three original profiles and zero matches.

1. Verify the existing QA Render service's configured Supabase project ref is `iukmpcytsuofqhxsumbu`; never print secret values. Stop immediately if it points to production. Its name is not proof of binding.
2. Only after verification, the owner approved setting `DURABLE_ACTIVE_GAMES=true` and deploying the reviewed branch on `chessaz-deutsch-qa-api`, Free plan, zero cost. The currently live QA commit is the old `3032afe574a7cf04e92b51536d1448a62a5d8eee`. No Render mutation has been made. The available connector lacks environment reads and branch updates; no authenticated local CLI/API path is configured.
3. Verify genuine hosted PostgREST access, authenticated games, crash recovery/concurrency and result/response retries. Database-role assertions and loopback CI do not substitute for this.
4. Run the approved **Oregon baseline** for correctness. Measure at least 50 actual move transitions from the backend, report warm p50/p95, and exclude Free-plan cold start. Oregon latency is reference-only. The **launch gate** remains p95 <= 300 ms on at least 50 move transitions and must be rerun after the backend moves to Frankfurt.
5. Prepare the two-service Frankfurt proposal only; do not execute it. Include cost, cutover downtime, Vite build-time backend URL, CORS, DNS and rollback. Production Supabase remains in `eu-west-1`; do not propose a database move. Any eventual production database/schema/activation/deploy request needs its own concrete evidence and explicit approval. Do not change production flags or maintenance here.

Verified geography: QA Supabase Frankfurt (`eu-central-1`), production Supabase Ireland (`eu-west-1`); both Render services Oregon / Free in owner-confirmed My Workspace. Production must not receive load/durable tests. QA project binding and hosted Oregon correctness remain unverified, so no baseline latency or activation readiness is claimed.

Detailed QA history, hashes, assertions and scope are maintained in [PR #126](https://github.com/sem2025ger/azchat-chess/pull/126), `docs/schach-treff-phase4-status.md`. The already-applied original challenge SQL was not edited. The original private-room SQL was also not edited and is now applied on QA; further changes must be forward migrations. See `docs/durable-active-games.md` for recovery and rollback behavior.

## Remaining scope — not claimed complete

Glicko-2 has a tested pure core, but live calculation/integration remains inactive. Schach-Treff phases 4–5 are Draft in PR #126 with CI and QA schema checks complete; hosted/visual acceptance remains. Phases 6–7, Spieler v1, PR #99 and PR #98 remain unfinished/separate work. Private/invite games and Schach-Treff v1 challenges remain unrated. Existing placeholder profile ratings must not be presented as computed ratings. Preserve the approved mobile interface and maintenance gate throughout subsequent work.
