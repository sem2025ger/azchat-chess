# AI Coach V1 — Omega QA, 2026-10-30

Acceptance remains partial. V2 is not started. No Render account access, hosting changes,
secret/environment changes, Supabase interaction, migration, production deployment or merge.

## Verified starting state

- PR #139: open Draft, `feat/ai-coach-v1-qa-20261029`, head
  `a470cfd74bd1db712e3b8b73d6a65f4640049110`, base `main` at `5345c958`.
  Frontend and Server CI both completed successfully.
- PR #141: open Draft, `qa/ai-coach-auth-preflight-20261029`, head
  `e02e08e56a2530dfa01130dc407efe585a315a1b`, base PR #139's branch.
  [Frontend CI 40975356108](https://github.com/sem2025ger/azchat-chess/actions/runs/40975356108)
  completed successfully: frontend 179/179, isolated-PostgreSQL server 258/258,
  zero failed/skipped. Typecheck, build, browser checks, lint and dependency audits passed.
- [Hosted token-free smoke 40975356264](https://github.com/sem2025ger/azchat-chess/actions/runs/40975356264)
  succeeded. A new one-request local probe of the isolated QA host also returned HTTP 401,
  `AUTH_ROUTE_PRESENT`, measured 5524 ms to response headers. This proves only route/auth,
  not the hosted SHA, database, index, authenticated lessons or Gemini.
- No deployment matching either PR head, or PR #139's branch, was returned by Vercel.
  Metadata lists `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SERVER_URL`
  each targeting both Production and Preview, with no branch override in that listing.
  Values were not decrypted. Separate QA bindings are **not confirmed**; do not deploy a Preview.
- No `QA_ACCESS_TOKEN` is available in the secure runner environment. No token was requested,
  acquired from a personal session, printed, committed or sent to the hosted API.
  The previously reported 14,979 games / 853,036 entries is historical index evidence,
  not a fresh authenticated observation in this stage.

## Confirmed defect and minimal correction

Alpha: Gemini's `response.text()` buffered the entire body before the 16 KiB check.
Absent or understated Content-Length therefore bypassed the intended streaming bound;
counting JavaScript characters also admitted UTF-8 responses exceeding 16 KiB.
Two regression tests failed on the original code: three chunks were read instead of one,
and an oversized multibyte JSON response was accepted.

The correction counts streamed bytes, stops before buffering more than 16 KiB,
cancels/releases the reader, rejects invalid UTF-8, and cancels HTTP/header rejects.
The existing 9-second provider signal, endpoint, model, prompt, schema, flags and null-briefing
fallback remain the same. Oversized responses preserve legal archive examples via the real
loopback HTTP verifier. No shared provider utility or frontend module changes.

Omega: six added tests independently cover stream cancellation, missing/understated length,
UTF-8 bytes, exact boundary, invalid encoding, HTTP/header rejection, coarse IP throttling,
per-account identity across token rotation, window reset and stable privacy/warming errors.
The existing verifier now also exercises oversized-provider fallback.

## Executed local validation

- `node --test aiCoach.test.js openingPrepQa.test.js openingPrepReadiness.test.js positions.test.js`
  from `server/`: **38 passed, 0 failed/skipped**. Includes real loopback HTTP and PositionIndex
  using synthetic public-archive fixtures; no live Supabase authentication or Gemini call.
- Full `node --test *.test.js` from `server/`: **214 passed, 0 failed, 14 skipped** out of 228.
  The skipped database tests require isolated PostgreSQL; rely on the new PR's CI result
  separately, not the previous commit's successful run.
- `npm run build` from `tmp/`: success, including TypeScript project build and verified cached
  Stockfish assets. Existing CSS selector and bundle-size warnings remain.
- `node tests/openingPrep.browser.mjs` from `tmp/`: real Chromium 153, **PASS** for six locales
  DE/EN/AZ/TR/UA/RU, 390/1280 px, both colors/turns, errors, no horizontal overflow,
  stale response cancellation, default-OFF and transposed game's indexed-ply session handoff.
  Initial browser launches failed because of runner graphics initialization; the successful
  run used the installed headless binary with GPU/software rasterizer disabled. Test source
  and assertions were unchanged. This test uses synthetic API responses and a destination
  placeholder; it does not verify the actual hosted analysis board or every theme.
- `git diff --check`: success.

## Next safe hosted stage — V1 only

Do not deploy or change configuration under this QA authorization. An operator must provide
nonsecret evidence that the selected backend SHA and QA Supabase binding are correct, and
arrange a short-lived session for an isolated QA-only account in a secure runner. Never
paste a token into chat or PRs. If those gates cannot be met without prohibited settings
changes, authenticated hosted acceptance remains blocked.

| Gate | Required evidence / action |
| --- | --- |
| Source and index | Exact deployed reviewed SHA; QA Supabase ref `iukmpcytsuofqhxsumbu`; current `position_index_ready` numeric fields only. No Render login is required for the reviewer. |
| API chess acceptance | Run existing `scripts/verifyOpeningPrepQa.js` against the pinned isolated host: Spanish ply 8, both KID move orders, each model PGN at its indexed ply, illegal moves, 40/41-ply limits, cache headers. Six authenticated requests per run; respect the normal minute budget. |
| Privacy and throttling | Local negative tests passed. Hosted proof must use authorized QA fixtures/accounts; do not edit public opt-outs or production data. Do not stress/load-test the hosted service. |
| Gemini | If already safely configured in isolated QA, run with `QA_EXPECT_AI=generated` and review factual claims, opening context, language and caveat. This only proves provider success; teaching quality needs human chess review. If unavailable, record fallback; do not add/remove provider keys or alter flags. |
| Preview isolation | Before creation: separately verified QA-only API and Supabase bindings, QA auth redirect/CORS and exact frontend SHA. Shared Production/Preview variable metadata is insufficient. |
| Language and layout | DE/EN/AZ/TR/UA/RU at mobile 390 px and desktop 1280 px; long labels, error/fallback text, keyboard/focus and language switch without reload. Preserve legacy `ua` and canonical `uk` compatibility. |
| Themes and analysis | Use the existing theme registries. Check each interface theme, board theme and selectable piece set; click real model games and verify actual AnalysisScreen FEN at the game's own indexed ply, navigation and legal continuation. No claim of an exhaustive cross-product test yet. |

Only after matching hosted evidence, successful CI and owner acceptance should the relevant
Draft PRs be considered for review readiness. No merge or production release is authorized.

## Continuation — real analysis board and theme coverage

Rechecked source PRs #139/#141/#142: all remain open Draft at the starting SHAs
above; all returned completed successful checks. Local starting tree was clean at
`97e57656ed18c925da7d6d8c96d64d9a11c03eda`. Follow-up branch:
`qa/ai-coach-analysis-themes-20261030`, based on #142.

### Confirmed defect / Alpha correction

The real desktop analysis header called the absent translation key
`game.analysis.title`. Browser console warnings and rendered `aria-label` exposed
the untranslated key. The new six-language server-rendered regression failed on
the original component (`de: translated analysis region name`). Use the existing
`analysisCopy[language].analysis` label. This is a one-line component correction;
no new translation system, layout, board rules or engine changes.

### Omega evidence executed in this continuation

- `node --test tests/analysisHeaderLocale.test.mjs tests/mobileAnalysisLayout.test.mjs tests/analysisDesktopMenu.test.mjs`
  from `tmp/`: **5 PASS, 0 failed/skipped**, after the new regression failed before
  the fix. Existing mobile action wiring and desktop menu checks remain intact.
- Expanded `tests/openingPrep.browser.mjs`: **PASS** in real Chromium, now using
  actual `Layout`, `GameRoute`, `GameScreen`, `ChessBoard` and `ThemeProvider`,
  replacing the former destination placeholder. For six locales at both 390 and
  1280 px, the four-ply query opens its transposed model game at indexed ply 8;
  every rendered piece/square is compared with a separate chess.js replay.
  Previous/next/last positions and illegal `e2-e5` rejection / legal `e2-e4`
  continuation were checked. Localized region names and absence of missing-key
  console warnings were asserted. Existing lifecycle/default-OFF checks remain.
- Each of **15 interface palettes**, **10 board themes** and **4 selectable piece
  sets** was swept independently at both widths. Assertions cover square board
  geometry, horizontal fit, configured square classes and loaded piece images.
  This is not all 7,200 combinations, a contrast audit, or human visual approval
  of every palette. Sample mobile/desktop captures were visually inspected.
- The fixture disables env-file loading, uses synthetic public bindings, blocks
  external HTTPS/WSS, and asserts no external fetch attempt. Auth/socket contexts
  stay signed out; the engine is a handshake stub. Thus this is real UI/chess
  integration with synthetic API data, not hosted auth/Gemini/Stockfish proof.
- Targeted server command from the earlier section repeated on the unchanged
  server source: **38 PASS, 0 failed/skipped**.
- `npm run build`: **PASS**, including TypeScript. Existing bundle/CSS warnings
  remain. `npm run lint`: **PASS**, **0 errors, 62 existing warnings**.
- `git diff --check`: **PASS**. Full follow-up CI must be verified separately.

### Hosted gates remain blocked

A fresh Vercel query returned no deployment for #142's exact SHA. The three API /
Supabase variables still list Production + Preview together without branch
scoping. Values were not decrypted. Isolation is not confirmed; no deployment was
created. A new token-free isolated-host probe from this runner failed before a
verified HTTP response, so it does not renew the earlier HTTP 401 evidence.
`QA_ACCESS_TOKEN` and QA Supabase bindings are absent in the secure runner.
No account/session was acquired and no authenticated or real Gemini request was
made. Earlier successful CI and hosted smoke are historical observations at
those exact SHAs, not evidence that this follow-up is deployed.

Next operational gate is unchanged: nonsecret operator confirmation of the
reviewed backend SHA, QA-only Supabase binding and fresh `position_index_ready`
numeric fields; then a QA-only short-lived session made available in a protected
runner without pasting credentials into chat. Run the existing
`server/scripts/verifyOpeningPrepQa.js` only after those gates. Confirm actual
Gemini success if already configured; otherwise record fallback. No Render
account access, settings/env/secret changes, Supabase operations, merge,
production deployment or V2 work occurred.

### Final local regression / publication state

- Full local `npm test`: **178/180 PASS, 2 failed, 0 skipped**. The failures were
  the global-position browser wrapper (`dbus-daemon: Failed to open socket:
  Operation not permitted`) and the font transform under a `node_modules` symlink
  outside this checkout. This is not a successful full-suite result.
- The unchanged `node tests/globalPositions.browser.mjs` passed when launched
  directly with Chromium: arrows/keyboard, redo tail, orientation/flip, scope,
  exact matched ply, session restore and all six locales at both widths. The
  D-Bus wrapper itself remains unverified here; no wrapper or CI check was edited.
- Dependencies were copied locally from the same existing installation, replacing
  only the checkout's dependency symlink; manifests/lockfiles stayed unchanged.
  `node --test tests/interFontPrivacy.test.mjs` then passed (**1/1**). No network
  install, service setting or secret change was involved.
- The desktop board-navigation controls still have legacy Russian accessible
  labels across locales. This correction covers the analysis region label;
  it is not acceptance of exhaustive localization of the whole analysis screen.
- Automatic approval review rejected `github.create_tree` (uploading these source
  and QA-document changes to `sem2025ger/azchat-chess`), stating that explicit
  user-authored authorization for that upload destination/side effect was not
  sufficiently established. No alternative upload method was attempted. A new
  remote branch/PR and its CI are **not created**. Changes are retained locally
  for review; publishing requires explicit owner approval after this report.

The final patch is limited to `AnalysisWorkspaceHeader.tsx`, the expanded
`openingPrep.browser.mjs`, new `analysisHeaderLocale.test.mjs`, and this report.
The generated Stockfish build outputs are not part of the patch. The original
Draft PR #142 remains unchanged.
