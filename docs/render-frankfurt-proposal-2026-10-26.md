# Frankfurt backend migration proposal — not executed

Owner scope: migrate both Render backends, preserve production Supabase in Ireland (`kmwfvvliundhuovoakoa`, `eu-west-1`) and QA Supabase in Frankfurt (`iukmpcytsuofqhxsumbu`, `eu-central-1`). No database relocation, production migration, durable activation, maintenance toggle or hosting change is executed by this proposal.

## Service and cost choice

Render cannot change an existing service's region. Create replacement services in Frankfurt in **My Workspace**, retaining Oregon services for rollback. Names below are requested names, subject to availability; use the actual assigned URLs after creation.

| Environment | Proposed Frankfurt service | Compute plan | Fixed compute/month |
| --- | --- | --- | --- |
| QA | `chessaz-deutsch-qa-api-frankfurt` | Free: 0.1 CPU, 512 MB | US$0 |
| Production, recommended for launch | `chessaz-api-frankfurt` | `0.5c-512mb` (formerly Starter): 0.5 CPU, 512 MB | US$7 |
| Recommended total | Both services above | One instance each, no disk/add-on/autoscaling | **US$7/month** |

Zero-compute-cost alternative: both replacements Free, **US$0/month**; it retains sleep/restart and shared-hour limits and is suitable for closed testing, not a reliable public launch. For matching always-on QA/production compute, both `0.5c-512mb` cost **US$14/month**. The existing Oregon services are Free, so leaving them available temporarily adds US$0 compute cost. No option is approved for creation or payment by this document.

Prices verified on Render's official pricing page on 2026-10-26, in USD before applicable taxes. These are fixed compute totals, not a promise about a usage-dependent bill: existing Supabase/Vercel/workspace fees are unchanged; bandwidth/build overages are separate. Verify workspace included usage and spending controls before any creation/deploy. For a strict zero-cost rehearsal, stop before an overage or paid change. Free services share 750 running hours/workspace/month, including old and new Free services; no keep-alive workaround is proposed.

## Exact sequence after separate owner approval

1. Record both Oregon service IDs, live commit SHAs, branch/build/start settings, frontend deployment IDs and existing `VITE_SERVER_URL` values. Transfer secrets only through provider secret controls, never reports or git. Verify Supabase project refs separately; stop if QA points to production.
2. Create the QA replacement in Frankfurt, Free, one instance, same repository and reviewed exact commit. Use root `server`, build `npm ci`, start `npm start`, health `/health`. Preserve required authentication/configuration and use QA Supabase only. Retain QA durable activation only as authorized for testing. Warm the service; cold-start time is recorded separately.
3. Point only the QA/Preview frontend environment at the new QA URL, rebuild and deploy that frontend. Validate authenticated Socket.IO, HTTP and WebSocket origin checks, private/challenge games, durable recovery/retry and result uniqueness. Rerun **at least 50 real move transitions** originating from the Frankfurt backend; record warm p50/p95 and require **p95 <= 300 ms**. Oregon baseline timing cannot clear this launch gate. QA uses Frankfurt Supabase; also identify the remaining Frankfurt-to-Ireland production database path and validate its launch performance only under a separately approved production-safe procedure. Do not assume QA's same-region latency proves the Ireland path.
4. Create the production replacement in Frankfurt using the owner-approved main commit and separately approved compute choice. Preserve production Supabase `kmwfvvliundhuovoakoa` in Ireland. Retain the current production durable flag; missing/false stays missing/false. Schema/activation approval is separate. Do not send test games, load or durable probes to production.
5. Keep the existing maintenance state. Schedule the cutover outside club testing, prevent new test starts through the agreed operational procedure, and require zero active volatile games and empty matchmaking queues. Preserve and drain any durable pending results before transferring ownership. Do not run two independently writable instances against the same active-game population; a region move does not migrate memory-only rooms or queues.
6. Update the production frontend's `VITE_SERVER_URL` to the actual new production HTTPS origin, rebuild and deploy the frontend after separate approval. Verify only approved read-only production health/origin checks. Reconnect clients and verify the region switch before retiring old resources. Keep Oregon rollback targets and previous frontend artifacts until the observation window passes.

## URL, DNS and CORS

Recommended first cutover uses the replacements' assigned `onrender.com` URLs. No chessaz.de DNS, nameserver or frontend domain change is required. `VITE_SERVER_URL` is embedded at Vite build time: changing a hosting variable alone does not update the delivered application; each affected Vercel environment needs a new build/deployment.

| Setting | QA / Preview | Production |
| --- | --- | --- |
| `VITE_SERVER_URL` | Actual Frankfurt QA HTTPS URL | Actual Frankfurt production HTTPS URL |
| Backend `FRONTEND_URL` | Exact existing QA frontend origin | `https://chessaz.de` |
| Socket transport | HTTPS URL, secure WebSocket upgrade | HTTPS URL, secure WebSocket upgrade |

CORS authorizes the **frontend origin**, not the backend's new URL. Preserve the exact origin allowlist and the Socket.IO `allowRequest` enforcement in `server/index.js`. Current code also explicitly permits `https://www.chessaz.de` and known project-scoped Vercel previews. If the QA hostname changes, add only its exact approved frontend origin; do not introduce a wildcard. Verify an allowed HTTP preflight and WebSocket handshake, plus rejection of a foreign origin. Supabase Auth redirect URLs need no change while frontend origins stay the same.

Optional later stable API subdomains (such as `api.chessaz.de` and `qa-api.chessaz.de`) would require separate DNS approval: attach each domain to its correct new service, create the provider-directed CNAME to that service's assigned hostname, verify DNS/TLS, then rebuild with that API URL. Keep `chessaz.de` frontend DNS intact. Check included custom-domain quota before choosing this option; beyond quota, Render charges US$0.25/domain/month. This optional DNS path is excluded from the US$7 recommendation.

## Downtime and rollback

Parallel provisioning leaves the old backend available while the replacement builds. Once drained, reserve an estimated **5–15 minute cutover window** for the frontend deployment, smoke checks and reconnects; this is an operational estimate, not a Render SLA. Existing WebSockets reconnect and cannot be promised zero interruption. New default service URLs avoid DNS propagation; optional custom-domain switching adds DNS/TLS propagation time. Free QA waking after idle adds roughly one minute, excluded from warm latency percentiles.

Rollback before any new games start: restore/promote the saved frontend artifact containing the Oregon URL (or rebuild with the saved value); keep the saved CORS/frontend origin settings and confirm old service health. DNS is unchanged in the recommended path. If DNS was used later, restore the saved CNAME and allow its TTL to elapse.

If Frankfurt already accepted games, first stop new starts and drain volatile games; never discard them by redirecting players. For durable games, use a compatible recovery-capable Oregon build, let the old owner stop/lease expire, and verify fencing plus pending-result completion before resuming. Do not revert to the old QA commit `3032afe` while durable games remain. No table drops, data deletion, migration-history repair, database move or production flag changes belong to rollback. Keep replacement services until the rollback is verified; suspend/delete only with separate approval.

## Current execution status

Oregon baseline remains unexecuted. QA's configured Supabase ref must be verified first. The Render connector does not expose environment reads or changing the deployed branch, and no local Render CLI/API credential is configured. Browser/Dashboard fallback needs access approval before use. No Render configuration, redeploy, region, plan, DNS or frontend hosting variable has been changed.

Sources checked 2026-10-26: [regions](https://render.com/docs/regions), [compute plans](https://render.com/docs/compute-plans), [pricing](https://render.com/pricing), [Free limits](https://render.com/docs/free), [custom domains](https://render.com/docs/custom-domains), [WebSocket reconnect behavior](https://render.com/docs/websocket). Service configuration and CORS names were read from this repository and the owner-confirmed Render workspace.
