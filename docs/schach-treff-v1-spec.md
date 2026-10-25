ROLE
You are a senior full-stack engineer working in the ChessAZ repository (sem2025ger/azchat-chess).
Frontend: React + TypeScript + Vite in tmp/ (Vercel). Backend: Node/Express + Socket.IO in server/ (Render). Database: Supabase Postgres.
Read AGENTS.md first and follow "6. Approved decisions" and "7. Lessons learned".

STEP ZERO (do this before anything else)
Save this entire prompt verbatim as docs/schach-treff-v1-spec.md on the branch feat/schach-treff-v1 and commit it:
  docs: add authoritative Schach-Treff v1 specification
From now on that file is the single source of truth. In any later run, read it from the repository instead of relying on chat history.

MILESTONE: "Schach-Treff v1 (desktop)" — continue PR #112 (branch feat/schach-treff-v1, rebased on main 0a86f52).

CURRENT STATUS (already done; do not redo)
- PR #113 merged and applied to production. It provides email-free usernames (trigger + backfill): post-check 0/7/7.
  Supabase recorded its version as 20261025163216; this mismatch is noted for the later migration-repair PR. Do not touch migration history.
- Phase 1 (desktop shell) is committed in PR #112:
  - the desktop sidebar item "Schach-Treff" with single active state;
  - the desktop screen with header and ⋯ panels;
  - self-hosted Bodoni Moda;
  - the mobile component preserved.
- Phase 2 is committed in PR #112:
  - public.username_available RPC (QA only);
  - the signup availability check with character validation in all 6 site languages (latest commit 4bd4628).

TASK NOW
Execute Phases 3, 4, 5, 6 and 7 in ONE continuous run, in order.
- After each phase: run the tests, commit, push, update that phase's section in the PR description, and immediately start the next phase.
- Do not send intermediate status messages. Your next message must be the final evidence report (section 10) or a STOP (section 8 only).
- "Visual checks pending", "remaining gates" or "not complete" are NOT reasons to stop.
- Then do the visual checks and the mobile regression proof (6.2, 6.3) and write the final report.
Do not merge.

============================================================
SCOPE RULE: DESKTOP ONLY (owner decision — highest priority)
============================================================
All VISUAL/UI changes apply ONLY at viewport width ≥ 1024px (Tailwind lg, or the site's existing desktop breakpoint; use the value Phase 1 already uses).

Below that breakpoint (phones and tablets), the current experience stays exactly as on main:
- the current community screen, its tabs, header, texts and layout;
- the mobile navigation (including the label "ChessAZ Deutsch");
- the mobile composer.

Rules:
- The new UI lives in the desktop component from Phase 1 (e.g. tmp/src/screens/SchachTreffDesktop.tsx). The existing component keeps rendering below the breakpoint.
- No change to shared CSS/components that alters any mobile or tablet output. Desktop-scope it (lg:) or make it opt-in via a prop only the desktop component passes.

Not visual, so these apply on ALL devices: DB migrations/RPCs, server socket handlers, signup validation.

Invite links on phones/tablets must work:
- log in (existing auth-return pattern), join via RPC, show the German notice "Vereinsräume sind vorerst in der Desktop-Version verfügbar.";
- then land on the current mobile community screen.

============================================================
1. HARD RULES — never violate
============================================================
- PRODUCTION DATABASE IS READ-ONLY. Write migration files only. Apply them only to the QA project (ref iukmpcytsuofqhxsumbu) via your explicit QA connection. Never apply to production (ref kmwfvvliundhuovoakoa).
- Never print, log or commit secrets, tokens, passwords, connection strings or invite tokens.
- Never put a service_role key in frontend code or env.
- Do not change Vercel/Render settings, env vars or maintenance mode. chessaz.de stays in maintenance mode.
- Git: no merge into main, no merge commits, no force push to main. Force-with-lease on feat/schach-treff-v1 is allowed only after a rebase.
- STOP if any Supabase screen or log shows a cost above 0 €.
- No unrelated refactors, renames or formatting sweeps. Minimal diffs.
- Do not touch PR #98's areas (server/tournament*.js and its migration) or PR #99's areas (server/src/games/*, GamesLibraryPanel). Put new server logic in new modules with minimal wiring in server/index.js.
- No fake success:
  - errors are shown as errors, never as empty lists;
  - a feature whose migration is missing in the connected DB hides itself with one console.warn (PostgREST error code).
- Privacy (DSGVO):
  - city/club are optional and shown only on opt-in;
  - usernames never come from e-mail;
  - no requests to fonts.googleapis.com / fonts.gstatic.com from the desktop screen.
- New dependencies: avoid. Any one added must pass npm audit --omit=dev --audit-level=high. Install with npm ci --legacy-peer-deps.
- There is NO rating calculation in this codebase.
  - All challenges are UNRATED, like existing private/invite games. Never write the word "gewertet".
  - Never write to rating columns or invent ratings.
  - Wherever this milestone shows a rating: show the stored value only if the player has ≥ 1 completed game in public.matches, otherwise "—".
- Copy-level mismatches (a label that does not match real behaviour) are NOT a STOP: fix the wording, note it in the report, continue.

============================================================
2. PRODUCT DECISIONS (approved — desktop only)
============================================================
D1. On desktop the section is "Schach-Treff" (with a hyphen), never translated. No visible "ChessAZ Deutsch" on desktop. Internal slugs (chessaz-deutsch) and DB names are unchanged.
D2. Desktop sidebar: "Schach-Treff" + small "Für Deutschsprachige"; exactly one active item. (Done in Phase 1.)
D3. Desktop header:
    - only "Schach-Treff": self-hosted Bodoni Moda, #D9AE5B, letter-spacing 0.02em, a 1px gold rule underneath (rgba(217,174,91,0.45), 64px);
    - text-shadow: 0 2px 14px rgba(0,0,0,0.85), 0 0 1px rgba(217,174,91,0.35);
    - no subtitle, no internal status sentences. (Done in Phase 1.)
D4. All Schach-Treff desktop UI text is German regardless of site language, in one German copy object. User messages are shown as written.
D5. Style:
    - background #0A0B0B; surfaces #121413 / #0E100F;
    - borders 1px rgba(255,255,255,0.07);
    - one accent gold #D9AE5B (hover #F0CF86); text #F2EEE3; muted #A8A293; online dot #7FB08A (7px);
    - the site's sans font for body, monospace for numbers;
    - no extra glow, no gradients, no neon, no purple, no emoji, no italic capitals;
    - radius 12–16px; targets ≥ 44px; contrast ≥ 4.5:1.

============================================================
3. DESKTOP SCREEN SPECIFICATION
============================================================
Three columns under the header row (title + "⋯" button, aria-label "Weitere Bereiche"):
  LEFT (≈240px) "Räume":
    - "Allgemein" (the chessaz-deutsch club chat);
    - section "Meine Vereine" (the user's rooms);
    - a dashed gold button "Verein erstellen".
  CENTER (flex): room title row, pinned message, message list (only this scrolls), composer:
    [button "Herausfordern"] [input "Nachricht schreiben …"] [button "Senden"].
  RIGHT (≈320px): "Spieler in deiner Nähe" card and "Stellung der Woche" card.
  At 1024–1279px the right column may move below the chat. No horizontal overflow at 1024px.

"⋯" menu (done in Phase 1):
- Turniere: "Turniere starten bald", the text, and "Benachrichtigen" / "Wir melden uns".
- Mitglieder.
- Rangliste.
- Über uns.

Messages:
- clean username (gold button → player card) and muted "Stadt · Verein" if shared;
- time: "18:02" today, "gestern 18:02", else "24.10. 18:02";
- the text;
- under other people's messages, a small "Herausfordern" button.
- Empty room: "Noch keine Nachrichten. Teile den Einladungslink mit deinem Verein."

German labels (exact):
  Räume, Allgemein, Meine Vereine, Verein erstellen, Angeheftet, Ändern, Anheften, Abbrechen, Herausfordern, Herausforderung, Offene Herausforderung, Persönliche Herausforderung, Offen für alle, Bestimmter Spieler, Bedenkzeit, Herausforderung senden, Annehmen, Wartet auf Gegner, Partie startet …, Abgelaufen, Spieler in deiner Nähe, jetzt online, Stellung der Woche, Abstimmen, Deine Stimme, Eigene Stellung einreichen, Eingereicht · wird geprüft, Blitz, Schnell, Partien, Letzte Partien, Keine Angaben zu Ort und Verein, Schließen, Name des Vereins, Raum erstellen, Link kopieren, Link kopiert.

============================================================
4. PHASES TO EXECUTE NOW
============================================================
PHASE 3 — Pinned message
  - Migration: chess_clubs gains pinned_body text (≤ 500), pinned_by uuid, pinned_at timestamptz.
  - RPC public.set_club_pin(p_club_id uuid, p_body text):
    - SECURITY DEFINER, search_path='';
    - the caller must be a member of that club with role 'admin' or 'moderator';
    - an empty body unpins;
    - REVOKE from PUBLIC; GRANT EXECUTE to authenticated.
  - Desktop UI: a card above the chat, "Angeheftet · <username>" + text. "Ändern" (admin/moderator only) → inline edit with "Anheften" / "Abbrechen".
  - Test: a non-admin is rejected.
  - Report the SQL the owner runs (placeholder user id) to make herself admin of the chessaz-deutsch club.

PHASE 4 — Challenges from chat + player card
  Migration:
  - public.chess_club_challenges:
    - columns: id uuid PK, club_id FK, message_id FK chess_club_messages UNIQUE, created_by, target_user_id NULL, time_control CHECK in ('3+2','5+0','10+0'), status CHECK in ('open','accepted','expired','cancelled'), accepted_by NULL, room_id NULL, created_at, expires_at (= created_at + 10 min);
    - RLS: club members SELECT; no client INSERT/UPDATE/DELETE.
  - chess_club_messages gains kind text NOT NULL DEFAULT 'text' CHECK in ('text','challenge').
  - The CURRENT MOBILE screen must render a challenge message as plain text, e.g. "Herausforderung 3+2 von <name>". Test this.
  Server (new module, e.g. server/clubChallenges.js; minimal wiring):
  - "club_challenge_create" {clubId, timeControl, targetUserId?}:
    - authenticated socket (socket.data.userId); membership checked server-side; the target must be a member;
    - max 3 open challenges per user;
    - insert the message (kind 'challenge') and the challenge row with the existing server-side Supabase credentials;
    - broadcast to connected club members; notify the target if online.
  - "club_challenge_accept" {challengeId}:
    - atomic UPDATE … SET status='accepted', accepted_by=$me WHERE id=$id AND status='open' AND expires_at>now() AND created_by<>$me AND (target_user_id IS NULL OR target_user_id=$me) RETURNING *;
    - 0 rows → reject: already_taken / expired / not_allowed;
    - creator not online → set 'expired', reject 'creator_offline';
    - otherwise start the game through the EXISTING path used by invite_lobby_player / private rooms (same durable-games behaviour, clocks, match_found). If no reusable function exists, extract the minimal shared function from that code with behaviour unchanged and tests. Never a second game engine. UNRATED.
  - "club_challenge_cancel" (creator only).
  - Expiry is marked lazily on read/accept; no new scheduler.
  Desktop UI:
  - "Herausfordern" (composer) opens a dialog:
    - "Offen für alle" | "Bestimmter Spieler" (member picker);
    - Bedenkzeit 3+2 / 5+0 / 10+0;
    - "Herausforderung senden".
  - "Herausfordern" under a message or in the player card preselects that player.
  - Challenge card in the timeline:
    - kind label, "Partie 3+2", and who challenges whom;
    - states Annehmen / Wartet auf Gegner / Partie startet … / Abgelaufen.
  - When the game starts, the player goes to the game screen exactly as with an existing invite.
  Player card (desktop dialog), opened from any username:
  - initial, clean name, "Stadt · Verein" or "Keine Angaben zu Ort und Verein";
  - Blitz / Schnell (rating rule above), number of completed games, the last 3 games (opponent, time control, result);
  - "Herausfordern" (hidden on your own card).
  - If RLS blocks reading matches, add a narrow SECURITY DEFINER RPC returning only these summary fields for one user.
  Tests:
  - server state machine with fakes: two concurrent accepts → exactly one wins; target-only rule; expiry; creator offline; non-member rejected; open-challenge limit;
  - desktop UI tests for the dialog and card states;
  - mobile plain-text rendering.

PHASE 5 — Private club rooms with invite links
  Migration:
  - chess_clubs gains kind text NOT NULL DEFAULT 'community' CHECK in ('community','room') and created_by uuid.
  - chess_club_invites:
    - columns: id, club_id, token_hash text UNIQUE (sha256 of a random 128-bit token), created_by, created_at, expires_at (+14 days), max_uses (50), uses;
    - no client SELECT of token_hash.
  - RPCs (SECURITY DEFINER, search_path='', each validates the caller; REVOKE PUBLIC, GRANT authenticated):
    - create_club_room(p_name): 3–60 chars; max 2 rooms created per user; is_open=false; kind 'room'; the caller becomes 'admin'; returns the id.
    - create_club_invite(p_club_id): room admin/moderator only; returns the plain token once.
    - join_club_by_invite(p_token): checks hash, expiry and uses; adds the caller as 'member'; idempotent.
  - Verify that message/member RLS restricts private rooms to members. If not, fix it narrowly. Test it: a non-member cannot read room messages.
  - The current mobile screen must keep showing only the chessaz-deutsch club. Verify that rooms never appear there.
  Desktop UI:
  - "Meine Vereine" lists the user's rooms.
  - "Verein erstellen" → "Name des Vereins" → "Raum erstellen" → invite link https://chessaz.de/schach-treff/einladung/<token> + "Link kopieren" (→ "Link kopiert").
  Route /schach-treff/einladung/:token (all devices):
  - login, join;
  - desktop opens the room; below the breakpoint, the SCOPE RULE notice, then the mobile screen;
  - German errors for expired, used and invalid links.
  /chat stays unchanged on mobile and shows the new screen on desktop.

PHASE 6 — Optional city/club + "Spieler in deiner Nähe"
  Migration: profiles gains:
  - city text (≤ 60), club_name text (≤ 80), share_location boolean NOT NULL DEFAULT false;
  - covered by the own-row update policy (verify; fix narrowly if needed).
  Desktop profile UI: optional "Stadt", "Verein" and a switch "In der Nähe sichtbar sein". The mobile profile stays unchanged.
  Server "nearby_players_request":
  - only for an authenticated user with share_location=true and a city;
  - returns online users (existing presence/sockets) with share_location=true and the same city (case-insensitive, trimmed): clean name, club_name, blitz (rating rule);
  - at most 20, excluding the caller; uses the existing socket rate limiter.
  Desktop UI:
  - the right-column card; each row has "Herausfordern";
  - footnote "Nur Spieler, die ihren Ort freiwillig im Profil angegeben haben.";
  - without a city: a short prompt linking to the profile.

PHASE 7 — Stellung der Woche
  Migration:
  - chess_week_positions:
    - columns: id, week_start date (Monday, Europe/Berlin), fen text, caption ≤ 120, submitted_by, status CHECK in ('pending','approved','rejected'), created_at;
    - one submission per user per week; FEN shape CHECK (full validation with chess.js in the UI).
  - chess_week_votes(position_id, user_id, created_at): one vote per user per week.
  - RLS: authenticated reads approved positions and counts; users insert their own submission and their own vote (approved, current week only); chessaz-deutsch moderators/admins approve/reject via RPC.
  - RPC week_winner(p_week_start date): most votes; tie → earliest.
  Desktop UI:
  - the card shows this week's approved positions as read-only mini boards (reuse the board component, or a minimal chess.js 8×8 grid), the caption, "von <name>", "Abstimmen"/"Deine Stimme" with the count, and "Eigene Stellung einreichen" (FEN or the current analysis position → "Eingereicht · wird geprüft");
  - moderators see pending items with approve/reject.
  - Desktop Home: a small card "Stellung der Woche" with last week's winner; hidden if there is none. Mobile Home is unchanged.

============================================================
5. IF / ELSE (decide yourself)
============================================================
- Chat uses polling → keep it; refresh challenge status on the same cycle and on socket events.
- No reusable game-start function → extract it minimally (behaviour unchanged, tests).
- A phase's migration is missing in the connected DB → its desktop UI hides itself; the rest works.
- A shared component change would alter mobile → desktop-scope it or make it opt-in by prop.
- An in-scope existing bug blocks you → minimal fix in its own commit with a regression test.

============================================================
6. VERIFICATION
============================================================
6.1 tmp/: npm ci --legacy-peer-deps && npm test && npm run build && npm audit --omit=dev --audit-level=high
    server/: npm ci --legacy-peer-deps && npm test
    Both CI checks "frontend" and "server" green.
6.2 Mobile regression proof:
    - existing mobile/community tests pass unmodified (if one must change: STOP and explain);
    - a test that below the breakpoint the old component renders and the desktop one does not;
    - screenshots or DOM checks at 360/390/430/768 px, main vs branch.
6.3 Desktop screenshots at 1024/1280/1440 px:
    - the chat;
    - the ⋯ panels;
    - the challenge dialog and card;
    - the player card;
    - nearby players;
    - position of the week;
    - room creation + invite;
    - the sidebar.
    Confirm no Google Fonts requests.
6.4 Each new migration: apply to a disposable local Postgres in the SQL tests, then to QA. List every new table, column, function, index and policy with its RLS state and grants.

============================================================
7. ACCEPTANCE CRITERIA
============================================================
A5  Only admin/moderator can change the pin (test).
A6  Three ways to challenge on desktop; exactly one accept wins; the game starts via the existing path; unrated.
A7  Private rooms readable only by members (test); never shown on mobile.
A8  Nearby lists only opted-in, same-city, online users.
A9  Submit → approve → vote (1 per user per week) → last week's winner on desktop Home.
A10 Below the breakpoint everything matches main (6.2); invite links work there with the notice.
A11 All tests/builds green; audit passes; nothing applied to production.

============================================================
8. STOP CONDITIONS (only these)
============================================================
- An action would write to production or change Vercel/Render settings or env.
- Supabase cost > 0 €.
- A required change would visibly alter mobile/tablet and cannot be desktop-scoped.
- Starting a game would require changing game-flow, clock, durable-games or socket-auth logic beyond extracting an existing function unchanged.
- A security boundary is unclear (e.g. how sockets are authenticated).
- A required RLS change would widen read access to private data beyond this spec.
- Acceptance criteria contradict each other.

============================================================
9. COMMITS
============================================================
  docs: add authoritative Schach-Treff v1 specification
  feat(schach-treff): pinned message (db + desktop ui)
  feat(schach-treff): unrated chat challenges (db + server + desktop ui) and player card
  feat(schach-treff): private club rooms with invite links
  feat(profile): optional city/club (desktop) and nearby players
  feat(schach-treff): position of the week + desktop home card
  test(mobile): final mobile regression proof
  docs: AGENTS.md
    - "6. Approved decisions": the SCOPE RULE, D1–D5, the challenge rules, the privacy rules, the no-rating rule;
    - "7. Lessons learned": the Supavisor PGOPTIONS line and the MCP migration-version line, if not already present.

============================================================
10. FINAL EVIDENCE REPORT (PR description + your final message)
============================================================
1. Status per phase 1–7: done / done-but-needs-migration / stopped (reason).
2. Files changed per commit; any new dependency with its audit result.
3. Test, build and CI results, including the mobile regression proof.
4. New DB objects with RLS state and grants. QA application results. "Nothing applied to production."
5. Owner deployment order:
   a) apply the Phase 2–7 migrations to production after her approval (counts-only preflight first);
   b) make her club admin (SQL with placeholder);
   c) merge PR #112;
   d) verify on desktop and on a phone.
6. Screenshots, or "UI not run".
7. Open owner decisions:
   - no rating system exists;
   - the room-creation limit;
   - week-position moderation;
   - how the "Benachrichtigen" opt-in is stored;
   - when to bring Schach-Treff to mobile;
   - the Datenschutzerklärung additions (city/club opt-in, invite links, position submissions);
   - the migration-history mismatch from PR #113.

============================================================
11. OWNER CORRECTION — 2026-10-25 (supersedes Phase 4 controls)
============================================================
- No modifications to server game engine or ALLOWED_TIME_CONTROLS.
- Challenge times ONLY 3+2 (Blitz), 5+0 (Blitz), 10+0 (Schnell). Validate membership of both the three-value challenge list and the existing server allowlist.
- durableRecovery.test.js also reproduces a failure on clean main locally per owner. Test DB integration processes may interfere when run concurrently: verify against main CI evidence and use serial runner for PostgreSQL integration and durable recovery tests if hypothesis confirmed. Never weaken test, assertion or timeout.
