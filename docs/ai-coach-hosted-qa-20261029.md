# OpeningPrep final QA — 2026-10-29

Scope: finish PR #139 acceptance and prepare production reconciliation. Runtime application code, flags, keys, schema, history, accounts, live games and production deployments are unchanged.

## Fresh observations

- GitHub: PR #139 open Draft, head `3ac858a9fa4227c07d9493f974aed85b6cf8a3f8`, base main `5345c9586a98b4926f1f92399b8b6664bc76d77a`. Frontend CI [40876232167](https://github.com/sem2025ger/azchat-chess/actions/runs/40876232167) and Server CI [40876232175](https://github.com/sem2025ger/azchat-chess/actions/runs/40876232175) both completed success. These are the existing commit's CI, not results for the QA-tooling follow-up.
- Render QA `srv-dbcktr0473hc739d5qn0`: branch `feat/global-position-search-v1`, latest live commit `cc60c1cc59a66f2898dfc279b7ff1b1e51e4e43e`, deploy `dep-dbhb0vo473hc73ccd8cg`. It does **not** deploy PR #139.
- One external GET to `https://chessaz-deutsch-qa-api.onrender.com/health`: HTTP **200**, **28184 ms**. One POST to `/api/ai-coach/preparation`: HTTP **404**, **5743 ms**, HTML `Cannot POST /api/ai-coach/preparation`. These are single observations, not warm latency percentiles. No authentication token was sent and no live Gemini call occurred. This is an absent route, not a tested AI fallback.
- Render production remains autodeploy OFF, latest live `58ae74b671312456314c17d59e1307a98e53fef2`. No hosting setting was changed.
- Vercel project `prj_jmEnT6f9Yu189AoBMGrpT8CxGaaJ`, owner team `team_2LmH2gx37Myq8DUinXfoEmvG`: deployment list filtered by the exact `3ac858a` SHA is empty. No matching Preview was found and no deployment was created.

## Reproducible API acceptance

`server/scripts/verifyOpeningPrepQa.js` sends only explicit read-only lesson requests. It refuses production hosts, accepts only the known Render QA origin or localhost, rejects redirects, uses no-store and a 30-second per-request deadline. It prints status/latency, never tokens, PGN or provider secrets. The authenticated user's normal six-per-minute budget is preserved: one unauthenticated check and exactly six authenticated requests. Do not run again until that user's minute budget has reset.

Provide these through a secure runner environment, never command arguments or committed files:

- `QA_BASE_URL`: known QA origin, once the exact reviewed SHA has been deployed and the index is ready.
- `QA_ACCESS_TOKEN`: short-lived token from an existing QA-only test account. No automatic signup or database write.
- `QA_EXPECT_AI`: `fallback`, `generated`, or `either`. This is an assertion, not a switch that changes the server/provider.

Run from `server/`:

```sh
node scripts/verifyOpeningPrepQa.js
```

Checks: unauthorized 401; Spanish line through `4...Nf6` (8 input plies); both King's Indian move orders with identical groups/example IDs/counts; illegal sequence 400; 40 plies accepted; 41 rejected. Every model game's PGN is replayed to **its own indexed ply**, and the resulting normalized position must equal the query; selected continuation and reply-side labels are verified. A transposition can occur at a different game ply. This does not itself verify the rendered board.

`QA_EXPECT_AI=fallback` verifies the no-explanation response without removing the games. Live provider success, missing-key and provider-error acceptance require separately controlled QA configurations. Do not remove/change a key on a shared service to simulate an outage. Local `openingPrepQa.test.js` covers all three degraded configurations and simulated provider success through the real HTTP router and PositionIndex; it is not a live Gemini-quality test.

## Browser acceptance

The existing `tmp/tests/openingPrep.browser.mjs` passed again in real Chromium 153 with synthetic API responses at desktop/mobile widths: six locales, both turns/colors, translated errors, cancellation, default-off and indexed analysis-session handoff. Test fixtures do not prove the hosted API, actual AnalysisScreen rendering, live Gemini, or all production theme combinations. Complete those on the reviewed Preview before Ready.

## Concrete hosting handoff

The connected Render tool can trigger only the currently configured branch, not choose a commit or change that branch. Triggering it now would redeploy the wrong source. No such deploy was triggered. The current QA service's database binding and secret configuration cannot be verified from the service metadata; its name is insufficient proof of isolation.

To prepare a hosted acceptance environment, first verify the backend's configured Supabase ref is QA **`iukmpcytsuofqhxsumbu`**, not production. Use the reviewed PR head as source with the existing Node server build/start contract. Enable `POSITION_SEARCH_ENABLED=true` and `AI_COACH_ENABLED=true` **only in the approved isolated QA runtime**, leaving repository defaults and production OFF. Validate CORS and QA-only authentication, then wait for full index readiness before smoke requests. No migrations or archive imports are part of this step.

The frontend Preview must use the QA API origin and QA Supabase ref, with `VITE_SPIELER_V1_ENABLED=true`, `VITE_AI_COACH_ENABLED=true` and other required existing QA flags; never inherit production bindings. Verify its exact source SHA in Vercel. Do not enable features or replace the shared QA service without the corresponding isolated-QA configuration approval. Preview/manual chess and theme acceptance remain outstanding.

Production's exact object inventory and lock/history risks are separate: [schema reconciliation](production-schema-reconciliation-20261029.md), [SELECT-only preflight](production-schema-preflight-20261029.sql). Stage 2 remains design-only in [ai-coach-stage2-design.md](ai-coach-stage2-design.md). Its worker/evidence layer can enrich internal preparation facts while preserving the current v1 response; any new structured teaching response needs an additive/versioned contract, bounded work and independent tests. No engine integration is claimed by this QA follow-up.
