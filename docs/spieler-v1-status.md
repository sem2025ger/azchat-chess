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

Raw catalog/TWIC tables are server-only. All four new tables have RLS. Authenticated users may read only their own claim/opt-out rows; they cannot insert/update/approve requests directly, enumerate catalog rows or execute server-only RPCs. Every Spieler HTTP read and mutation requires a valid Bearer token through the same existing verifyToken callback. Anonymous/expired/invalid tokens return 401 before storage/provider access (429 after the request budget is exhausted). HTTP never trusts body/JWT user metadata for ownership. Claims stay pending until operator verification. Up to three unverified hide requests per account immediately suppress a player with status hidden_pending_review. Further requests are stored as pending_owner_review without immediate suppression; HTTP returns 409 hide_limit. Verified claimants can always hide their own card immediately, without using this allowance. Search, direct ID and game requests exclude both hidden_pending_review and approved hides. Owner review can confirm suppression or restore the request; restoring one request does not override other active hides for the same player. No automatic identity inference from names or online nicknames.

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

`docs/spieler-v1-qa-regression.sql` passed on hosted QA using a completely rolled-back transaction and two existing QA actor IDs, without creating auth users/sessions/tokens. Original-stage assertions covered own/outsider RLS, denied raw/RPC access, no self-approval, private pending club, verified voluntary club, and the original opt-out filtering. The updated replayable regression script tests the corrected immediate hiding and the owner review procedure after the new forward migration. A fresh post-rollback read confirmed zero claim and opt-out rows, with all 36,687 imported players preserved. Security advisors add only the intended informational RLS-without-policy notices for the two server-only tables; browser grants are revoked. These directory checks do not claim hosted game recovery acceptance.

Preview target is only chessaz-preview-workspace, never azchat-chess/production and never promote. Flags stay off by default; QA backend deployment or enabling runtime flags is not part of the requested preview build. Hosted durable-game acceptance remains postponed and cannot be substituted by these directory checks. PR #126 remains Draft and Squash and merge only.


## PR #127 review corrections

Only Spieler uses an Express sub-application with `trust proxy = 1`, matching the owner's confirmed single Render hop. `req.ip` takes the rightmost forwarded address; additional client-supplied addresses to its left are ignored. The parent Express application's proxy policy and socket/game logic are unchanged. Deployment must continue to prohibit a direct public path bypassing that proxy; a different topology requires re-verification. Before any token verification, a coarse 120/minute real-client-IP budget applies to all requests. The existing 60/minute post-verification budget remains keyed by verified user ID for authenticated requests (shared across tokens/IP changes) and real client IP for unauthorized attempts. The pre-limit and post-limit each have a separate bounded, expiring 1,000-entry map. State is local to one process and resets on restart. These tests simulate the proxy header contract locally; they are not a hosted Render IP observation.

Nickname exports visibly show `Lichess-Konto: <nick> (nicht verifiziert)` or `Chess.com-Konto: <nick> (nicht verifiziert)` beside the loaded sample. The label uses the nickname/source of that response, not a later edited input; it never asserts that the account belongs to the FIDE player. Reads send the access token only in Authorization headers. Signing out/changing the session aborts pending directory requests and clears displayed private results.

New forward file: `20261026201936_spieler_review_privacy.sql`. The already applied original migration is unchanged. Legacy pending hides become hidden_pending_review; confirmed hides remain suppressed. Reimport cannot erase these separate suppression rows. A re-submitted rejected claim returns to pending, and editing an already verified club requires review again before publishing the new text.

## Owner-only claim/hide review and DSGVO handling

There is deliberately no browser/admin HTTP endpoint. Only the owner with trusted Supabase dashboard/SQL access operates `spieler_admin.review`; the private schema is not part of the public API. The function is SECURITY INVOKER, executable only by service_role and its postgres owner, with an explicit database-role check. anon/authenticated have neither schema access nor EXECUTE, including users who put an owner/admin string in user metadata. No service key or SQL credentials may be sent to the browser. Application users cannot self-approve or restore a card.

1. Open the **QA project iukmpcytsuofqhxsumbu** SQL Editor as the owner. This milestone does not authorize any production SQL. Review the oldest pending rows privately; do not paste user IDs or evidence into public PRs/logs. `created_at` records the current request's receipt (repeat pending requests preserve the original deadline); `reviewed_at` records a decision.
2. For a claim, verify the claimant's relationship to the FIDE identity using the minimum necessary evidence through an existing private owner contact channel. Never infer ownership from a matching name, nickname, email or client-supplied role. Do not store identity documents in these tables. Approve or reject only an existing pending request; a second verified owner is rejected atomically.
3. A hide is immediate for up to three unverified pending requests per account; excess requests wait visibly in pending_owner_review and only suppress after owner confirmation. A verified own-card hide is always immediate and exempt. Repeating an existing immediate request uses no extra slot, while restoring/confirming an unverified immediate request releases its pending slot. The per-actor transaction lock serializes all requests across FIDE IDs, preventing parallel overbooking. After verifying the request, confirm continued suppression. Restore only after a documented decision such as a mistaken/abusive request or the subject's verified withdrawal, and inform the requester privately. Do not automatically restore at a timer/deadline. A confirmed suppression can also be restored by the owner after a later justified review. Other active suppression requests still apply.
4. The owner records the minimal decision context in the private support record. Every successful procedure decision adds an append-only event with request/user/FIDE IDs, old/new status, decision and timestamp in the non-exposed `spieler_admin.review_events` table. No free-text documents/emails are stored. Browser roles cannot read it; service_role cannot update/delete it. Review closed support evidence/events for deletion after 90 days unless an active dispute requires retention; retain the minimal suppression marker for as long as needed to prevent republication. The owner performs any separately authorized retention cleanup; this migration schedules no deletion jobs.

Privately list queues (no emails or tokens):

```sql
SELECT user_id,fide_id,club,created_at FROM public.spieler_claims
 WHERE status='pending' ORDER BY created_at;
SELECT user_id,fide_id,status,created_at FROM public.spieler_opt_out
 WHERE status IN ('hidden_pending_review','pending_owner_review') ORDER BY created_at;
```

Replace the UUID below privately with the actual request's user_id. Use one matching decision, with the request's actual FIDE ID. These examples do not authorize executing reviews of real users during development:

```sql
BEGIN;
SET LOCAL ROLE service_role;
-- Claim: 'approve' -> verified; 'reject' -> rejected.
SELECT spieler_admin.review('claim','<request-user-uuid>'::uuid,13404431,'approve');
-- Hide: 'confirm' -> approved (stays hidden); 'restore' -> restored.
-- SELECT spieler_admin.review('hide','<request-user-uuid>'::uuid,13404431,'confirm');
COMMIT;
```

Operational target: owner checks both pending queues daily and acknowledges a privacy request within 24 hours. Within the unverified allowance and for a verified self-claim, hiding is immediate; queued excess requests await review. The limit never discards or resets the receipt time of a pending request. Handle DSGVO rights requests without undue delay and respond no later than **one month after receipt**. If complexity/volume justifies an extension, notify the subject of the reason within that first month; up to two additional months are permitted under Article 12(3). A rejected request also requires a timely reasoned response and information about complaint/judicial remedies under Article 12(4). Verification must be proportionate, with only necessary extra information where reasonable identity doubts exist (Article 12(6)); never treat the queue as automatic legal compliance or silently extend deadlines. No automatic outgoing messages have been implemented or sent.

Sources: [EDPB guidance on individuals' rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en), [GDPR Article 12](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies.html).

Reviewed code head `d9f6fd1b9e9cdaea6930f3db1f291e65adab323e` passed [Server CI](https://github.com/sem2025ger/azchat-chess/actions/runs/40396785027) **161/161**, zero failures/skips, and [Frontend CI](https://github.com/sem2025ger/azchat-chess/actions/runs/40396785082) **138/138**, zero failures/skips, including build/typecheck, real mobile browser checks and lint (0 errors / 57 existing warnings). The earlier runner-only Chromium startup failure passed on retry. A demonstrated pre-existing PostgreSQL role-creation deadlock was fixed by making the community test create anon/authenticated in the same order as all other fixtures; no assertions were removed or skipped.

Only after both green checks, the exact new forward SQL was applied to QA `iukmpcytsuofqhxsumbu`: recorded version **20261026204410 / spieler_review_privacy**, source file `20261026201936_spieler_review_privacy.sql`, SHA-256 `da6a5bede6e3e7970988bb1cab34ca9b80b1d5dae944a2bfcb8262f22164fa23`. The first connector attempt returned an expired request-state error; migrations/schema were checked to confirm nothing applied before the successful retry. This file is now applied and immutable too. Original applied file SHA-256 remains unchanged.

The updated `docs/spieler-v1-qa-regression.sql` then passed on hosted QA in one rollback transaction: unverified immediate suppression for surname and ID, claim approve/reject, hide restore/confirm, own/outsider RLS, denied anon/raw/RPC/review access, no self-review, pending club privacy, verified voluntary club and all four recorded review events. A separate post-rollback query confirmed 36,687 imported players, **0 claims, 0 hides, 0 review events, 0 TWIC games**. No real ownership or hide decisions were left behind; no auth users/sessions/tokens were created.

Security advisors add only an expected INFO for the non-exposed, RLS-enabled `spieler_admin.review_events` table with no browser policies/grants. Existing unrelated SECURITY DEFINER/Auth warnings are unchanged; remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . No new WARN/ERROR was introduced.

Flags remain default false; no QA Render deployment or flag activation was performed. Hosted real-client-IP observation and manual enabled-feature use remain unclaimed; tests simulate the confirmed single-hop proxy contract. Hosted durable-games acceptance stays postponed.


## Additional abuse safeguards (Claude follow-ups)

New forward file `20261026210344_spieler_hide_abuse_limits.sql` adds pending_owner_review and an index for the per-account immediate-hide count, retaining existing RLS and server-only RPC privileges. It also reconciles legacy rows: verified self-hides become exempt approved rows; for each other account, only the three oldest immediate pending requests keep suppression, with excess requests queued and receipt times preserved. No applied migration is edited.

The SQL RPC returns `{status: "pending_owner_review", code: "hide_limit"}` as committed data, not an exception. The HTTP handler then returns 409; this ordering is required to keep the request stored. The client treats this as a conflict and explains that the request is saved for review, without removing the selected card/results. Owner confirm/restore works for both pending states, using the same private SQL procedure and audit log. A verified self-hide yields approved immediately and is not counted. The default for direct service-role inserts is now the non-suppressing pending_owner_review; browsers still cannot insert/update rows.

Tests include the literal fourth hide remaining visible and stored, retry/deadline preservation, verified own-card exemption with all three slots full, legacy-row reconciliation, owner confirm/restore and slot release, and eight concurrent requests yielding exactly three immediate hides. HTTP tests exhaust one IP with rotating invalid/throwing tokens and assert at most 120 verifyToken calls per window, independent real-IP budgets, spoofed-leftmost-header rejection, expiry, and the coarse cap across valid account rotation. Existing per-user budgets remain tested. The pre-limit runs after the default-off feature gate and before token parsing/verification, JSON parsing, storage and provider calls.

Reproduction: `docs/spieler-v1-hide-limits-qa.sql` uses existing imported players/profile only in a fully rolled-back hosted QA transaction; the updated original QA regression also checks the verified self-hide exemption. Current reviewed-code CI and the new recorded QA version will be added after verification. No runtime flag, Render configuration, production or paid change is part of these follow-ups.
