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

Raw catalog/TWIC tables are server-only. All four new tables have RLS. Authenticated users may read only their own claim/opt-out rows; they cannot insert/update/approve requests directly, enumerate catalog rows or execute server-only RPCs. Every Spieler HTTP read and mutation requires a valid Bearer token through the same existing verifyToken callback. Anonymous/expired/invalid tokens return 401 before storage/provider access (429 after the request budget is exhausted). HTTP never trusts body/JWT user metadata for ownership. Claims stay pending until operator verification. Every authenticated hide request immediately suppresses the player with status hidden_pending_review, including requests without a verified claim. Search, direct ID and game requests exclude both hidden_pending_review and approved hides. Owner review can confirm suppression or restore the request; restoring one request does not override other active hides for the same player. No automatic identity inference from names or online nicknames.

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

Only Spieler uses an Express sub-application with `trust proxy = 1`, matching the owner's confirmed single Render hop. `req.ip` takes the rightmost forwarded address; additional client-supplied addresses to its left are ignored. The parent Express application's proxy policy and socket/game logic are unchanged. Deployment must continue to prohibit a direct public path bypassing that proxy; a different topology requires re-verification. The bounded 60/minute budget is keyed by verified user ID for authenticated requests (shared across tokens/IP changes) and real client IP for unauthorized attempts; both share a bounded, expiring 1,000-entry map. State is local to one process and resets on restart. These tests simulate the proxy header contract locally; they are not a hosted Render IP observation.

Nickname exports visibly show `Lichess-Konto: <nick> (nicht verifiziert)` or `Chess.com-Konto: <nick> (nicht verifiziert)` beside the loaded sample. The label uses the nickname/source of that response, not a later edited input; it never asserts that the account belongs to the FIDE player. Reads send the access token only in Authorization headers. Signing out/changing the session aborts pending directory requests and clears displayed private results.

New forward file: `20261026201936_spieler_review_privacy.sql`. The already applied original migration is unchanged. Legacy pending hides become hidden_pending_review; confirmed hides remain suppressed. Reimport cannot erase these separate suppression rows. A re-submitted rejected claim returns to pending, and editing an already verified club requires review again before publishing the new text.

## Owner-only claim/hide review and DSGVO handling

There is deliberately no browser/admin HTTP endpoint. Only the owner with trusted Supabase dashboard/SQL access operates `spieler_admin.review`; the private schema is not part of the public API. The function is SECURITY INVOKER, executable only by service_role and its postgres owner, with an explicit database-role check. anon/authenticated have neither schema access nor EXECUTE, including users who put an owner/admin string in user metadata. No service key or SQL credentials may be sent to the browser. Application users cannot self-approve or restore a card.

1. Open the **QA project iukmpcytsuofqhxsumbu** SQL Editor as the owner. This milestone does not authorize any production SQL. Review the oldest pending rows privately; do not paste user IDs or evidence into public PRs/logs. `created_at` records the current request's receipt (repeat pending requests preserve the original deadline); `reviewed_at` records a decision.
2. For a claim, verify the claimant's relationship to the FIDE identity using the minimum necessary evidence through an existing private owner contact channel. Never infer ownership from a matching name, nickname, email or client-supplied role. Do not store identity documents in these tables. Approve or reject only an existing pending request; a second verified owner is rejected atomically.
3. A hide is effective immediately, before review. After verifying the request, confirm continued suppression. Restore only after a documented decision such as a mistaken/abusive request or the subject's verified withdrawal, and inform the requester privately. Do not automatically restore at a timer/deadline. A confirmed suppression can also be restored by the owner after a later justified review. Other active suppression requests still apply.
4. The owner records the minimal decision context in the private support record. Every successful procedure decision adds an append-only event with request/user/FIDE IDs, old/new status, decision and timestamp in the non-exposed `spieler_admin.review_events` table. No free-text documents/emails are stored. Browser roles cannot read it; service_role cannot update/delete it. Review closed support evidence/events for deletion after 90 days unless an active dispute requires retention; retain the minimal suppression marker for as long as needed to prevent republication. The owner performs any separately authorized retention cleanup; this migration schedules no deletion jobs.

Privately list queues (no emails or tokens):

```sql
SELECT user_id,fide_id,club,created_at FROM public.spieler_claims
 WHERE status='pending' ORDER BY created_at;
SELECT user_id,fide_id,created_at FROM public.spieler_opt_out
 WHERE status='hidden_pending_review' ORDER BY created_at;
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

Operational target: owner checks the queue daily and acknowledges a privacy request within 24 hours; hiding itself is immediate. Handle DSGVO rights requests without undue delay and respond no later than **one month after receipt**. If complexity/volume justifies an extension, notify the subject of the reason within that first month; up to two additional months are permitted under Article 12(3). A rejected request also requires a timely reasoned response and information about complaint/judicial remedies under Article 12(4). Verification must be proportionate, with only necessary extra information where reasonable identity doubts exist (Article 12(6)); never treat the queue as automatic legal compliance or silently extend deadlines. No automatic outgoing messages have been implemented or sent.

Sources: [EDPB guidance on individuals' rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en), [GDPR Article 12](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies.html).

Review verification and recorded QA forward version will be added after green CI and QA-only application. Flags remain default false; hosted durable-games acceptance stays postponed.
