# Closed-test preparation — 26 October 2026

## Completed

- PR #119 merged with Rebase as `4dab0dba2ea4a43126ec2dd814573a311066af85`: approved Soft Graphite default, restrained Chess Arena highlight and XL sidebar/globe sizes. Globe playback behavior is unchanged.
- PR #120's final Settings surface change merged through replacement PR #121 as `cf80ae61810f42b2fbfa4b46747edd79fc581694`. GitHub rejected rebasing #120's intermediate conflicting test commit. #121 has the same final UI diff and the same assertion in a separate file; neither branch was force-pushed. #120 is closed as superseded.
- PR #122 merged with Rebase as `c5735e6d21721794f391cd66a60e146c8d8de441`: Inter 5.3.0 is served locally for normal weights 300–900 and all upstream subsets, with the OFL notice. No Google Fonts links remain in the entry document.
- Live browser verification of `https://chessaz.de/` shows only the launch-maintenance page ("We are preparing for launch" / "The platform will be available soon").
- Vercel's automatic main deployment `dpl_4RQWTCqJBuFG777XS1BmXpTRNu2U` is READY on `c5735e6`. No hosting settings, secrets, domain routing or maintenance flag were changed.

## Evidence

Exact PR #122 head: `6041bd7511f0e55e8c9c6e113e757ed1ba5a61f9`.

- [Frontend CI](https://github.com/sem2025ger/azchat-chess/actions/runs/40331808619): 132 tests passed, zero failures/skips; typecheck/build passed; lint has zero errors and 57 existing warnings.
- The same CI's real-Chromium test loaded Inter 300–900 with Latin/Cyrillic samples, observed local font asset requests and zero `fonts.googleapis.com` / `fonts.gstatic.com` requests. Existing desktop/mobile analysis behavior checks passed.
- [Server CI](https://github.com/sem2025ger/azchat-chess/actions/runs/40331808610): 138 tests passed, zero failures/skips, including isolated PostgreSQL and fresh-process crash recovery. Server production audit reports zero vulnerabilities.
- Frontend production audit passes the high-severity gate, with two existing moderate React Router findings. The full install audit also reports development/build dependency findings (8 high, 5 moderate, 1 low); these are not cleared by the production-only gate. No automatic major-version dependency upgrade was performed.
- Local frozen install, build, 131 frontend tests and lint passed for the Inter branch before combination with #121. Local server run: 112 passed / 5 PostgreSQL-dependent skips. Do not describe those skips as local integration success. The CI numbers above include the combined main changes and real PostgreSQL.
- Local Chromium download was unavailable; browser evidence comes from CI, not a claimed local browser run.

## Database inspection (read-only)

Explicit transactions used `BEGIN READ ONLY`; `transaction_read_only` was verified as `on`. No migration, data update, role change, migration-history repair or project setting change was performed.

| Object | QA `iukmpcytsuofqhxsumbu` | Production `kmwfvvliundhuovoakoa` |
| --- | --- | --- |
| `public.durable_games` | Absent | Absent |
| `public.durable_game_transition(...)` | Absent | Absent |
| `public.username_available(text)` | Present | Absent |
| `public.set_club_pin(uuid,text)` and pin columns | Present | Absent |
| Phase 4 challenge table | Absent | Absent |

Production has 10 completed matches at this inspection. The existing matches columns match the durable migration's insert contract. This does not prove live crash recovery or activation readiness.

Supabase security advisors: production reports leaked-password protection disabled, plus informational RLS-without-policy notices on server-only tables. QA additionally flags the intended username/pin SECURITY DEFINER RPCs. Check the authorization and grants, not just the warning count; do not widen policies to silence warnings.

- [Password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Exact migration candidates

Do not run `db push` against production or replay historical/bootstrap migrations. Recorded versions differ from repository names for several already applied migrations; reconcile in a separate reviewed change, not by blindly reapplying SQL.

| Repository file | SHA-256 | Proposed next action |
| --- | --- | --- |
| `20261019215514_durable_active_games.sql` | `b250aae842ab272dedd7f00c72cd43b80b3289f88f41b589f5a76ca46540bcbc` | After owner approval, apply this exact file to QA only and verify hosted integration. |
| `20261025173000_schach_treff_username_available.sql` | `e21ac920b9ad630fee0486f9ef0aff35e73126fdffa08b913de92a083081f664` | Already on QA with recorded version `20261025165211`; production application needs separate owner approval. |
| `20261025184000_schach_treff_pinned_message.sql` | `b64971935af73dc886ec4be0acacc477c11f72f0e57a2098594e423e092e4595` | Already on QA with recorded version `20261025174913`; production application needs separate owner approval. |

QA/production username anonymization is already recorded; do not repeat that backfill. Production's recorded version is `20261025163216`, differing from the file's `20261025164000` prefix.

Durable migration objects: one table (`durable_games`, RLS enabled), its recovery index and one SECURITY INVOKER RPC. Browser roles have no table/RPC access; only `service_role` receives the required table privileges and RPC EXECUTE. The migration alone does not activate persistence.

## Next approval boundary

The concrete next operation is QA-only installation of `20261019215514_durable_active_games.sql` from the reviewed main commit, followed by the read-only preflight and real hosted PostgREST ACL tests. Record the actual assigned migration version and the exact source hash.

1. Before applying, verify the project ID, absence of both objects, migration hash and zero extra cost. Stop on unexpected schema/history or any cost above zero.
2. Apply only that migration to QA after explicit owner approval. Keep production read-only and keep Render/Vercel settings unchanged.
3. Run `docs/launch-preflight-read-only.sql` on QA; require RLS enabled and both browser-access results false. Verify the service-role RPC through an approved server-only test session; never copy its credentials into browser code or the report.
4. Run hosted recovery/concurrency/result-retry scenarios and at least 50 representative move transitions from the backend region. Require p95 <= 300 ms before considering activation. Loopback CI timing is not a substitute.
5. Prepare a new production approval request with the QA evidence and exact SQL list. Do not activate `DURABLE_ACTIVE_GAMES`, restart production, alter secrets or open maintenance as part of the QA migration approval.

See `docs/durable-active-games.md` for recovery/rollout/rollback behavior. Schema installation and server activation are distinct operations requiring their respective approval.

## Remaining scope — not claimed complete

Glicko-2 is not implemented or active. Schach-Treff phases 4–7, Spieler v1, PR #99 and PR #98 remain separate work. Private/invite games and Schach-Treff v1 challenges remain unrated. Existing placeholder profile ratings must not be presented as computed ratings. Preserve the approved mobile interface and maintenance gate throughout subsequent work.
