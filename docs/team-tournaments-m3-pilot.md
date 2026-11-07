# M3 owner pilot — organizer + 4 captains + 16 players (NOT YET RUN)

**Blocked until** M3 RPCs, API, six-language UI, isolated database tests, QA-only migration and matching Preview/server deployments are complete. This is a test script, **not evidence** that the feature works.

## Accounts and safe environment

- Open the *matching* M3 Vercel Preview and QA Render backend; confirm both target Supabase QA `iukmpcytsuofqhxsumbu`, never production. Verify new feature flags are OFF in all production environments.
- Prepare one authorized organizer (O), separate arbiter (A), four captain accounts (C1–C4), sixteen distinct signed-in player accounts (P1–P16), and one uninvited spectator (S). Use separate browser profiles for O/C1/S. Have both desktop and mobile viewport/device available.
- Create a self-service test event with 4 boards, max 4 teams, min 2 teams. Use synthetic club names and nonambiguous Berlin start/deadline. Capture the actual event ID only in private QA notes.

## Organizer and invitations

1. O signs in, opens Spieltag → Turniere, creates a self-service NRW club event. Verify displayed Berlin start, deadline, min/max and team names.
2. O creates four different club invitation URLs. Verify each is one-time and that the raw token never appears in database tables or logs; only its digest is persisted.
3. O revokes an unused extra invitation and verifies its redemption fails. Test an expired token after deadline. Sign-out redemption must redirect to authentication without exposing privileged data.
4. C1–C4 each redeem their own URL in distinct accounts. Reuse C1's URL and cross-team redemption must fail. Each captain has exactly one entry.

## Rosters and consent

5. C1 chooses P1–P4 in board order, C2 chooses P5–P8, C3 chooses P9–P12, C4 chooses P13–P16. Check bounded username search. Before consent, each submission must fail.
6. Each player signs in to confirm inclusion; no other account may confirm for that player. Captains submit fully consented lineups. All four slots become occupied.
7. C1 edits its roster before the deadline and confirms slot-release/resubmit behavior. Test previous lineup draft in a second test event; no carried-over consent.
8. S sees only submitted club names and remaining spots, **not player IDs or board order**. Test direct REST and RPC under S and C2's tokens: C2 cannot obtain or modify C1's roster.
9. In a *separate* test event set max teams 4, prepare 5 complete captains, then submit concurrently. Exactly 4 succeed and one receives `event_full`. Withdraw and verify one freed spot can be claimed.

## Deadline and publication

10. Using a short future deadline, close registration without a background timer. First simultaneous GET and command after the deadline should produce exactly one publication; direct SQL checks must find no duplicates.
11. Repeat with 3 teams (3 rounds, one bye per round), 2 teams (1 round), and 1 team (cancelled). Captains must see cancellation; attempts to change roster after deadline fail through browser, REST and RPC.
12. Check all published player names, colors, team pairings, round ordering and standings. No illegal online-game result path may have been invoked.

## Player reporting and dispute

13. P1 opens Home and sees `My tournament: round 1, board …, vs …, White/Black`, with 1 / ½ / 0 controls and no external link.
14. P1 reports a win; opponent sees the inverse result and confirms. Verify final result, audit, match score and standings.
15. On a different board, submit conflicting reports to create a **disputed** board. O opens Turniere → round → match → board, sees both reports highlighted, chooses `Decide result` and supplies a reason. Verify resolution, source and audit actor/role/time/old/new.
16. Check C1 can report for P1 only, cannot act for C2/P5. Test a captain-reported no-show and require C2 confirmation or O decision.
17. Correct an already confirmed board with a reason, then verify updated standings/audit. Current round must advance only after all boards in the previous round are confirmed.

## Regression and cleanup

18. Recheck Spieltag, Schach-Treff, PR #192/#193 flows, six locale switches, all existing themes, desktop and mobile.
19. Confirm test rows were created only in QA. Execute the authorized rollback-only regression transaction; ensure zero fixture rows remain. Review Supabase security advisors and record any previously existing warnings separately.
20. Capture: Draft PR/SHA, migration version, per-job CI test counts and zero skips, security review, desktop/mobile evidence, backend and frontend Preview URLs. Leave production untouched and flags OFF outside QA.

**Owner sign-off** requires actual evidence for each step. Unexecuted steps remain unchecked.

## Hosted Chromium acceptance (PR #194)

The owner applies `run-qa-m3-pilot` **after** CI is green and the dedicated
`https://chessaz-m3-qa-api.onrender.com/health` reports the exact full PR HEAD.
Do not apply the label automatically. After pushing, poll this public endpoint
for at most 20 minutes; a mismatch blocks execution, not implementation.
The workflow runs the existing API pilot first, then `server/scripts/qaM3Browser.js`.
The one-use label is removed only after both jobs finish. Re-running an old
Actions run performs cleanup only; a new acceptance requires a fresh label.

The browser job is hard-bound to PR 194, its feature branch, QA Supabase
`iukmpcytsuofqhxsumbu`, and the exact frontend origin:
`https://chessaz-preview-workspace-git-135194-semov20207-3068s-projects.vercel.app`.
No other Preview, production service, M2 API, migration or RLS change is allowed.
The SHA precondition runs before database connection, fixture writes or browser
launch. SQL connections reuse the existing QA-only host/user and pinned TLS CA
guard. Redirects on fixture HTTP operations are rejected.

Each viewport (1280×900 and 390×844) gets one Chromium context/page and one video.
Both run all ten acceptance steps: organizer UI creation; two signed-out invite
login returns with exact URL equality; redemption; captain-as-player lineups and
consent; natural deadline publication with duplicate-count proof; Home score
report and opponent confirmation; a second event's conflicting reports and
reasoned organizer decision/audit; English/German UI switching; overflow checks;
and token privacy. SQL is used for fixture organizer grants and assertions, never
to create tournaments, accelerate deadlines or submit tournament commands.
Sign-in always uses the real email/password form; switching actors clears only
the synthetic browser session. No stored JWT is injected.

Fixtures are tagged `QA-M3-BROWSER-<run-id>`, use `@example.com`, and have separate
roles from the API pilot. Cleanup uses the existing ownership-checked event graph
and Auth Admin deletion, followed by zero-row proof for tournament rows, accounts,
sessions, profiles and organizer grants. `finally` cleanup is supplemented by an
`always()` workflow cleanup retry, including interrupted/replayed runs. A failure
in either acceptance or cleanup fails the job. Unrelated registrations due within
the browser run's 35-minute window block fixture creation to avoid advancing them.

The `m3-browser-acceptance-<sha>-<attempt>` workflow artifact is retained **7 days**:
`summary.md`, numbered `NN-step.png` screenshots in each viewport directory,
additional Home/dispute/English screenshots, and one `acceptance.webm` per viewport.
A failed step also attempts a screenshot; later steps remain explicitly NOT RUN.
Playwright captures web content, so the address bar is cropped out by design.
Invite, email and password inputs are hidden before rendering for video and
masked in screenshots. Raw exception text, browser console messages, URLs, HAR,
traces and auth state are not exported. Non-QA requests are blocked; attempted
production requests or token-bearing third-party URLs/referrers fail acceptance.
HTTP redirects fail acceptance before Chromium can follow them.
The storage proof checks all rows in the fixture tournament graph (including
reports/audit), plus fixture Auth/users/sessions/profiles. It does not scan or
claim to audit unrelated QA data or unavailable Render logs.

Until the owner applies the label, hosted browser results and artifact links are
**pending**, even when unit tests/CI pass. Keep PR #194 Draft.
