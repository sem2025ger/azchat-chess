# Team Tournaments M2 QA pilot

## Setup

Use the M2 Vercel Preview on `chessaz-preview-workspace` and the
`chessaz-deutsch-qa-api` Render service. Both must run the reviewed M2
commit. Check that the frontend and API use QA project
`iukmpcytsuofqhxsumbu`. Enable `TEAM_TOURNAMENTS_ENABLED=true` on the QA
service and `VITE_TEAM_TOURNAMENTS_ENABLED=true` for this Vercel Preview
branch. On the same branch point `VITE_SERVER_URL` at
`https://chessaz-deutsch-qa-api.onrender.com`. Use the QA Supabase URL and
its publishable key for sign-in. Confirm that the anonymous GET to
`/api/team-tournaments` on that service returns HTTP 200.

QA recorded migration `20261105225735_team_tournaments_m1` when the SQL
from repository migration `20261105221809_team_tournaments_m1.sql` was
applied. Verify the existing history entry before any future migration
reconciliation.

Choose an approved QA organizer and a separate QA arbiter. Both must already
have QA profiles. The owner runs [the organizer SQL](team-tournaments-qa-setup.sql)
using the organizer's QA UUID. Keep the arbiter's and optional captain's QA UUIDs
available for the forms. Use synthetic team names. Keep a second browser profile
or a private window for the arbiter and a signed-out window for the spectator.

## Organizer and spectator

1. Open `/spieltag?tab=turniere` on the Preview. Sign in as the organizer.
   Reopen the tournament tab if sign-in returned to your profile.
2. Choose **Turnier anlegen**. Enter a unique name. Keep four boards,
   2/1/0 match points, alternating colors and the default forfeit scores.
3. In **Turnierleitung**, select **Anmeldung öffnen**. Add Alpha, Bravo,
   Charlie and Delta in that order with **Mannschaft zulassen**. Optionally
   assign a QA captain to Alpha. Assign the arbiter using **Schiedsrichter zuweisen**.
4. Choose **Mannschaften fixieren**, then **Spielplan ansehen**. Expand all
   three rounds and verify these pairings.

   | Round | Pairings |
   | --- | --- |
   | 1 | Alpha–Delta, Bravo–Charlie |
   | 2 | Delta–Charlie, Alpha–Bravo |
   | 3 | Bravo–Delta, Charlie–Alpha |

5. Before publication, open the same event link in a signed-out window.
   The event should be unavailable there. Return to the organizer and
   choose **Spielplan veröffentlichen**. The spectator now sees all three
   rounds and the standings, with no edit controls.

## Arbiter and correction

1. Open the event link in the arbiter's signed-in window. Select round 1,
   Alpha–Delta, board 1. The screen labels Alpha as White and Delta as Black.
2. Choose `1-0 · Weiß gewinnt`, enter a reason and select
   **Vorläufig erfassen**. Refresh the spectator page. The board is labeled
   **Vorläufig** and the official standings still exclude the incomplete match.
3. On the same board enter a reason and select **Bestätigen**. Then change
   that result to `1/2-1/2 · Remis`, enter the correction reason and select
   **Korrigieren**. On reload the official board result must show the draw.
4. In all three rounds, confirm draws with a reason on the remaining
   23 boards. For each round check that the display counts results for
   the correct teams and keeps the orientation of alternating boards.
5. After the last confirmation, reload as organizer and choose
   **Turnier abschließen**. The official table should show all four teams
   tied at place 1 with 3 match points, 6 board points and 15 Berlin points.

## Phone checks

Open the same link on a phone. Confirm that switching rounds, reading the
team names and board colors, and submitting a board result work at a narrow
width. The standings may scroll horizontally within their own container.
If testing the captain role, sign in as Alpha's captain and verify that the
match list contains only Alpha's matches and offers no result editor.
In a signed-out phone window, verify that the finished tournament and
official standings are readable. Record the Preview URL, tournament name,
devices, final table and correction result in the QA report.
