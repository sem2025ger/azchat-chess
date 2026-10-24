# ChessAZ Deutsch — Tournament Calendar M1 (DRAFT / QA-ONLY)

## Scope and current status

This change is the **foundation for recurring tournament announcements and member registration**, not automated chess games. The existing Play-screen tournament control remains disabled. No Swiss or round-robin pairing engine, games, results, standings, rating adjustment, player matchmaking or prizes are added.

**Not deployed or activated by opening the PR.** Production ChessAZ and production Supabase are out of scope. The existing QA deployment will not auto-apply this migration. The database migration's template rows are **disabled by default**, and it does **not** install/activate pg_cron.

## Data model

* `chess_club_tournament_templates`: admin-only recurring calendar definitions; daily or weekly; weekday ISO 1-7; local start time in `Europe/Berlin`; capacity, registration lead time; `enabled=false` by default.
* `chess_club_tournaments`: materialized upcoming dates with UTC instants, registration opening instant, `scheduled/cancelled` status and unique `(template_id, starts_at)` for replay-safe generation.
* `chess_club_tournament_entries`: participant registration with unique composite key `(tournament_id,user_id)`.

A private `SECURITY DEFINER` generator with `search_path=''`, explicit schema qualifications, a transaction-scoped advisory lock, and an `ON CONFLICT DO NOTHING` guard creates dates inside a bounded 1-30-day horizon. Daylight savings transitions use `Europe/Berlin`, not 24-hour interval arithmetic across dates. The seed schedules are suggested, not activated:

| Template | Local recurring slot | Format | Status |
|---|---|---|---|
| Daily blitz | Every day 20:00 Europe/Berlin | Blitz | Disabled |
| Sunday rapid | Sunday 18:00 Europe/Berlin | Rapid | Disabled |

**Planning policy:** A future QA-only operator-run scheduler can invoke the private function daily using a privileged, audited connection, after an explicit rollout review. A separate operational decision is needed for `pg_cron` or an external scheduler; do not place service-role keys in GitHub or browser code. Current Render free service may sleep; do not use its process timers as the authoritative scheduler. Do not enable templates before verifying the schedule, registration policy, DST behavior and available email flow.

## Authorization

All three new tables have RLS. Templates are internal-only without browser grants. Signed-in club members can read upcoming dates and see signups. Browser roles cannot create/update/cancel dates or edit templates. Users may add/remove **their own** registrations. A private serialized trigger locks the event row before counting participants, checks the registration window and enforces capacity under concurrent joins. No `anon` access to these resources.

## QA acceptance gates

1. Static checks, `cd server && npm test`; `cd tmp && npm ci --legacy-peer-deps && npx tsc -b && npm test && npm run lint && npm run build`.
2. Apply migration to **QA only** after verifying baseline PR #70 is present. Verify 3 tables, RLS, exact policies/grants, private function permissions, and indexes. Never apply to production.
3. Test generator twice with fixed `p_now` and horizon and assert second run inserts zero, including concurrent invocations; test both DST boundaries for Berlin.
4. Test as anonymous user, nonmember, member and forged-ID member. Test duplicate registration, closed registration, at-capacity registration and concurrent registration.
5. Test mobile and desktop `/chat` calendar view; compare user-facing times against `Europe/Berlin` and ensure UI does **not** imply chess matches will start automatically.
6. Decide whether/when to turn on templates and configure a reliable server-side daily scheduler with monitoring and failure alerts.
7. Separately design actual tournament engine (pairing, legally validated moves, clocks, result adjudication, reconnect, anti-cheat, player eligibility, GDPR).

## Known limitations / sign-off

**M1 alone does not automatically publish dates:** it has a ready-to-call idempotent generator, but all templates are disabled and no scheduler is configured. The UI only shows rows after QA activation. This conservative rollout avoids inventing playable tournament infrastructure. Production and the current QA database remain unchanged until specifically approved.

This plan intentionally waits for the existing QA authentication issue (email rate limit / redirect) to be resolved before claiming end-to-end user acceptance.
