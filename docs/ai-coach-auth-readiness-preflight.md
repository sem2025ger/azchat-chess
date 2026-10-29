# AI Coach — unauthenticated QA route readiness preflight

This is an optional **one-request, token-free** check before the existing authenticated hosted QA verifier. It performs no configuration change and no database write. The unauthenticated request can increment the server's ordinary in-memory IP rate-limit counter.

From `server/` on an operator-controlled runner:

```sh
QA_BASE_URL=https://chessaz-deutsch-qa-api.onrender.com node scripts/verifyOpeningPrepReadiness.js
```

The command sends exactly one POST to `/api/ai-coach/preparation` with a fixed valid one-ply opening (`e4`). It does not accept a token and never logs response bodies. Unexpectedly large authentication response bodies are rejected after a bounded read (2 KiB). It accepts exactly two pinned QA hosts (`chessaz-deutsch-qa-api.onrender.com` and `chessaz-ai-coach-v1-isolated-qa.onrender.com`), and strictly rejects production hosts, arbitrary domains, credentials in URLs, paths, redirects and search parameters; localhost and 127.0.0.1 are permitted for isolated tests only.

## Status meanings

| Status | Interpretation |
| --- | --- |
| `AUTH_ROUTE_PRESENT` | HTTP 401, JSON `authentication_required`. **Only** the route and its authentication gate were observed. |
| `BLOCKED_ROUTE_OR_FLAG` | HTTP 404. Missing route **or** disabled feature flag; this probe cannot distinguish them. |
| `BLOCKED_RATE_LIMIT` | HTTP 429. Wait for existing rate window, do not retry repeatedly. |
| `UNVERIFIED_AUTH_RESPONSE` | An upstream proxy or different app may have returned HTTP 401; body is not the expected API error. |
| `UNEXPECTED_RESPONSE` | An unauthenticated request did not receive the expected status. Check safely before further testing. |

The ordinary `/health` endpoint checks `durableGames.ready()`, **not PositionIndex readiness**. If the operator can inspect Render logs without granting account access, request **only** the nonsecret event `position_index_ready` and numeric fields `games`, `entries`, `rejected`, `excluded`, `build_ms`, `read_ms`, `replay_ms`, `sort_ms`, `rss_before`, `rss_after`. Also share whether `position_index_failed` or `position_index_memory_limit` appeared. Do not provide environment variables, passwords, raw user data or full production logs.

## Blocking acceptance gates

A successful preflight does **not** establish the deployed commit SHA, Supabase QA binding, index readiness, privacy, model games, live Gemini, browser rendering, analysis handoff or six-language/theme QA. Before using the existing authenticated `scripts/verifyOpeningPrepQa.js`, an authorized operator must confirm **the exact approved PR #139 SHA** is hosted on a *separately approved isolated QA backend* and attached only to QA data, and that the PositionIndex has completed. Do not repoint the shared Render QA service, change flags, deploy or inspect Render account settings under this PR.

Once those gates are met, the existing verifier uses a short-lived QA-only token in a secure runner (never committed or pasted into chat), makes six authenticated requests (one unauthenticated request) and remains subject to the normal rate budget. UI and real Gemini acceptance are separate.

The authenticated verifier now shares the exact allowlist and URL validation with this token-free preflight, including the isolated Coach host. Before any hosted authenticated run, use a short-lived **QA-only** account token via a secure runner. Do not place tokens in PRs, logs, screenshots or chat. A token-free readiness probe is the next independent gate. The Vercel project currently has Supabase/API variables targeted at both Preview and Production; do not deploy a Coach Preview until the Preview values are separately verified as QA-only (without revealing their values).

## Validation

Run `node --test openingPrepReadiness.test.js` from `server/`. Six isolated tests cover both pinned QA destinations, the one-request contract, 404/429/200/proxy 401 outcomes, fail-closed validation, bounded streamed responses, and an actual loopback HTTP request. No hosted call is made.
