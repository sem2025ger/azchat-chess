# Milestone 4 — Schach in Bochum & NRW (Draft, default OFF)

Branch `feat/clubs-nrw-v1`, stacked on `feat/spieler-v1` (PR #127). No production, no new games, no game result writes, no rating mutations, no automatic league scoring.

## Scope and safeguards

- Backend gate: `CLUBS_NRW_ENABLED=true` for read-only RSS proxy; UI gate: `VITE_CLUBS_NRW_ENABLED=true`. Both unset/false by default. Do not switch QA or production flags without separate approval.
- The `/clubs-nrw` directory and `/clubs-nrw/:slug` pages contain club name, city, optional address, training schedule and HTTPS club website. The first two seeded names are from the Schachverband Ruhrgebiet list. Missing addresses and training schedules are intentionally null until confirmed. Do not invent venues, hours, club memberships, or standings.
- Registered members explicitly choose a single NRW club; `public_roster=false` by default. Names become visible only on explicit opt-in and are looked up using existing `profiles.username`. Club editors cannot see private chosen memberships merely by being editors. Users can revoke display.
- `clubs_nrw_roles` role assignments must be administered by a verified site owner/service role and are not writable by browser users. Owner/moderator/admin may edit calendar rows; owner/admin only may enter or edit league table rows. No automated results and no game-based rankings.
- Optional `clubs_nrw_room_links` link to preexisting **closed**, `kind='room'` PR #126 club rooms. A room link requires the editor to be both an NRW club editor and a moderator/admin of the actual closed room. Only real members may read the link; never create rooms, invites, or grant room access through this module. The SQL checks the `kind` property dynamically so main without PR #126 fails closed.
- `clubs_nrw_duels` only allows `proposed` and `withdrawn`. There are no game IDs, active statuses, matchmaking, move or Socket.IO endpoints. Do NOT enable game launch until durable-game acceptance gate for PR #126 passes.
- The default RSS response reads only the Bochum district feed and returns up to eight titles and HTTPS links. The optional aggregate and its source list are described below.
- Source list: https://ergebnisdienst.svr-schach.de/index.php/vereine?saison=0&view=vereinsliste. Official news: https://sbboblog.wordpress.com/. Club address/training updates require club confirmation.

## Gates and dependencies

1. GitHub server/frontend CI green, no skips; isolated PostgreSQL role/RLS tests required before QA migration. Do not run untrusted branch workflow with production credentials.
2. Apply this **new migration only to QA** after verified green CI and migration/version check, using forward-only changes.
3. Test anonymous/owner/moderator/admin/nonmember grants, cross-club spoofing, voluntary roster, invalid URLs, private room attachment and the PR #126 unavailable-schema fallback. Confirm migration is idempotently recorded.
4. Build a QA **Preview only** after verifying built URLs for the QA backend and QA Supabase. Production remains under maintenance and never receives this milestone without explicit separate approval.
5. The **Duell der Vereine game launch remains blocked**, even if the screens and data model are complete.
6. Review privacy/accuracy of voluntary membership and obtained club information before release. Moderation queue and account-role assignment are operational owner responsibilities.

## Implementation limitations

Feature is strictly opt-in; default-off UI and RSS route. Initial calendar and league lists are empty: club admins input values by hand. No public directory of private room members. Existing ChessAZ Deutsch tournaments and PR #126 room code are not changed. The draft PR must remain unmerged. Report and STOP.

## Owner-only club role assignment (QA)

Run these statements in the Supabase **QA SQL editor** using the privileged database administrator/service role, never from the browser. Verify the account UUID in `public.profiles` and the intended `club_id` first. Replace UUID placeholders and execute each command separately. Never expose a service-role secret to the frontend.

```sql
-- Look up the target club; confirm the exact ID before granting access.
SELECT id, name, city FROM public.clubs_nrw WHERE slug = 'bochumer-sv-02';
-- Look up the account by a trusted user ID supplied by the owner.
SELECT id, username FROM public.profiles WHERE id = '<USER_UUID>'::uuid;
-- Assign one of 'owner', 'admin', 'moderator'. Existing roles are replaced.
INSERT INTO public.clubs_nrw_roles (club_id, user_id, role)
VALUES ('<CLUB_UUID>'::uuid, '<USER_UUID>'::uuid, 'moderator')
ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role;
-- Verify the assigned permission.
SELECT club_id, user_id, role FROM public.clubs_nrw_roles
WHERE club_id = '<CLUB_UUID>'::uuid AND user_id = '<USER_UUID>'::uuid;
-- Revoke any role for this specific club/account only.
DELETE FROM public.clubs_nrw_roles
WHERE club_id = '<CLUB_UUID>'::uuid AND user_id = '<USER_UUID>'::uuid;
```

Access matrix: owner/admin/moderator may maintain calendar entries; owner/admin may maintain league rows. A role in the NRW directory does **not** grant access to PR #126 closed rooms. Grant and revoke operations are privileged-only; audit the targeted IDs and resulting row before leaving the SQL editor.

## Spieler integration and merge order

Merge order is **PR #127 → PR #128, both with Squash and merge only**. PR #128 is based on `feat/spieler-v1`; its normal dependency merge preserves both branch histories without a force-push. After #127 is squash-merged, retarget #128 to main and recheck that its diff contains only Clubs NRW and the club picker before its own squash merge.

Apply all three #127 Spieler migrations, then `20261026224500_clubs_nrw_v1.sql`, then `20261027001000_spieler_clubs_nrw_fk.sql`. `server/clubsNrwSpielerDb.test.js` exercises that exact order on isolated PostgreSQL, including published/unknown/unpublished clubs, legacy privacy, verified club display and preserved RPC ACLs. Server CI also runs for the stacked base branch.

The original free-text claim club is retained as `club_legacy` for migration safety and is never displayed as an unverified public association. The selected NRW club ID is nullable and must reference the curated `clubs_nrw` directory. Existing claims are not automatically matched to clubs by their legacy text.

## NRW news feeds

`NRW_NEWS_FEEDS_ENABLED` defaults to off. Set it to the exact value `true` only on the approved QA deployment of `chessaz-deutsch-qa-api`, with `CLUBS_NRW_ENABLED=true`. The flag does not control frontend visibility. An unset or false flag preserves the previous `{"items":[{"title":"…","url":"…"}]}` response from `GET /api/clubs-nrw/news`. With aggregation enabled, items include source, region and publication metadata, and the response also includes `updatedAt` and `sourcesOk`. The latter counts feeds contributing eligible items before the global cap.

The server uses a fixed HTTPS allowlist. It rejects redirects, allows 250,000 bytes and five seconds per feed, caches successful feeds (including empty results) for 15 minutes and retries failed feeds after 60 seconds. The feed publishes up to five headlines per source and 30 overall, omitting dated items older than 120 days. For legacy feed links with an escaped query in the path, the server restores the query and then verifies the destination against the same origin and allowlist. It discards invalid repairs without fetching article pages.

The NRW preview can show a schematic region map with `VITE_NRW_REGION_MAP_ENABLED=true`. It is off by default. The map and filter chips share the same selection, and at widths of 640 pixels or less the chips provide all region controls.

### Verified public feeds (2026-11-23)

| Source | Feed or exclusion |
| --- | --- |
| Schachbund NRW | <https://schach-nrw.de/feed/> |
| Schachjugend NRW | <https://sjnrw.de/?format=feed&type=atom> |
| Schulschach NRW | No advertised feed on the homepage. Standard `/feed/` returned HTTP 404. |
| Schachverband Ruhrgebiet | <https://svr-schach.de/feed> |
| Niederrheinischer Schachverband 1901 | <https://www.nsv1901.de/feed/> |
| Schachverband Mittelrhein | <https://sv-mittelrhein.de/feed>. Verified RSS. The feed had no articles from the last 120 days during discovery. |
| Schachverband Ostwestfalen-Lippe | <https://schachverband-owl.de/feed/> |
| Schachverband Münsterland | <https://www.svmuensterland.de/?format=feed&type=rss> |
| Schachverband Südwestfalen | <https://schach-swf.de/index.php?format=feed&type=rss> |
| Schachbezirk Bochum | <https://sbboblog.wordpress.com/feed/> |
| Bochumer Schachverein 02 | <https://bochumersv02.de/feed/> |
| Schachgesellschaft Bochum 1931 | No website recorded in the published NRW club directory. |
| ChessBase, Schach-Bundesliga, DSB | Source-directory links only, outside the NRW feed scope. |

The two Bochum clubs above match the published QA directory and the repository seed for `city = 'Bochum'`. Discover feeds only via the official homepage’s RSS/Atom alternate link or the standard WordPress `/feed/` path. Verify that the selected URL serves RSS/Atom entries directly. Webpage articles and access-restricted sources are excluded. Runtime fetches use only the verified URLs in code.
