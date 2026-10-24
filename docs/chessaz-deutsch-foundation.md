# ChessAZ Deutsch — Community Foundation (review only)

## Goal
A real, German-speaking chess community: club membership, discussion, and member-proposed chess gatherings. **ChessAZ Player DNA is a separate product feature**.

## Delivered in this branch
- Existing `/chat` route renders `ChessAZCommunityScreen` instead of a "coming soon" placeholder; navigation, shared Layout, chess board and existing game protocol remain unchanged.
- Users can join the founding `chessaz-deutsch` club, post text messages, propose events (bullet/blitz/rapid), signal participation, and withdraw from proposed events.
- Messages and event details are restricted to members through Postgres RLS, while public club details are discoverable; event capacity is enforced with a serialized database trigger. Club roster is visible to signed-in users of the platform.
- No new packages; 12-second foreground data refresh without assuming Supabase Realtime is published.
- The UI falls back to an explanatory error if the new schema has not been enabled. No fake messages or tournaments.

## Rollout and security gates (not done)
1. **Review the additive SQL migration** `supabase/migrations/20261021000000_chessaz_deutsch_community_foundation.sql`; confirm the user and privacy model. Do not apply it to the production database without owner approval.
2. Run the SQL on an isolated database and test RLS as a non-member, member, and admin. Confirm forged role/author IDs are rejected, chat access is member-only, only the author can delete their signups, and event cap remains correct under concurrent signups.
3. Run `cd tmp && npm ci --legacy-peer-deps && npx tsc -b && npm test && npm run lint && npm run build`.
4. Test responsive `/chat` with authenticated and signed-out browsers in preview; verify write errors preserve user text.
5. Review retention, deletion/moderation, abuse reporting, event timezone/voting mechanics, and notifications before a public feature release.

## Explicit exclusions
- No automatic pairing, real tournament launch, scores, standings or match creation yet. A "ready" count is **only the threshold of interested players**, not a scheduled tournament.
- No changes to `main`, production maintenance, Vercel/Render environments, chess move validation, Stockfish, personal Player DNA or live two-player game logic.
- International club creation, moderation tools, club roles and scheduled polls require later design and access-control review.

## Next milestones
**M2**: event time polls (Europe/Berlin handling), organizer controls, moderating club posts, and notifications; then tournament creation only when online game QA is complete.
**M3**: scalable multi-club lifecycle and international communities; audit moderation and GDPR obligations before broad launch.

## QA reality
The Node static contract tests do **not** establish database RLS correctness or prove the UI runs in a browser. CI verifies code-level integration; database security and manual visual QA remain open until independently tested.
