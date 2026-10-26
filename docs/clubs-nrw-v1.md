# Milestone 4 — Schach in Bochum & NRW (Draft, default OFF)

Branch `feat/clubs-nrw-v1`, base main. No production, no new games, no game result writes, no rating mutations, no automatic league scoring.

## Scope and safeguards

- Backend gate: `CLUBS_NRW_ENABLED=true` for read-only RSS proxy; UI gate: `VITE_CLUBS_NRW_ENABLED=true`. Both unset/false by default. Do not switch QA or production flags without separate approval.
- The `/clubs-nrw` directory and `/clubs-nrw/:slug` pages contain club name, city, optional address, training schedule and HTTPS club website. The first two seeded names are from the Schachverband Ruhrgebiet list. Missing addresses and training schedules are intentionally null until confirmed. Do not invent venues, hours, club memberships, or standings.
- Registered members explicitly choose a single NRW club; `public_roster=false` by default. Names become visible only on explicit opt-in and are looked up using existing `profiles.username`. Club editors cannot see private chosen memberships merely by being editors. Users can revoke display.
- `clubs_nrw_roles` role assignments must be administered by a verified site owner/service role and are not writable by browser users. Owner/moderator/admin may edit calendar rows; owner/admin only may enter or edit league table rows. No automated results and no game-based rankings.
- Optional `clubs_nrw_room_links` link to preexisting **closed**, `kind='room'` PR #126 club rooms. A room link requires the editor to be both an NRW club editor and a moderator/admin of the actual closed room. Only real members may read the link; never create rooms, invites, or grant room access through this module. The SQL checks the `kind` property dynamically so main without PR #126 fails closed.
- `clubs_nrw_duels` only allows `proposed` and `withdrawn`. There are no game IDs, active statuses, matchmaking, move or Socket.IO endpoints. Do NOT enable game launch until durable-game acceptance gate for PR #126 passes.
- RSS news fetches ONLY `https://sbboblog.wordpress.com/feed/`; backend enforces fixed-origin, 5s abort, 15m cache, 8 items max, and title+HTTPS link only; no full article caching. Failure returns an empty list with external-link fallback. No arbitrary URL proxy.
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
