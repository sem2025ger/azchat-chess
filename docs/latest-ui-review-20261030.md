# Consolidated interface review — 30 October 2026

Source branch: `qa/latest-ui-review-20261030`, based on reviewed PR #143
(`58260c274e6f912fafbb435e717784ad0f18cea1`; local tree-equivalent checkpoint
`5818d407ef45371b58fa2bb2fe0e2fde0d5de068`). No merge into main is authorized.

| Area | Snapshot source |
| --- | --- |
| Schach-Treff, private rooms/challenges, NRW/club/team/preparation screens | Current `main` at `5345c958`, consolidated through merged #137; preserve the newer files rather than overwrite them with superseded #126–#136 branch copies. |
| Six locales, bronze navigation, regional readability, responsive screens | Current main / #137 snapshot, with existing theme and translation systems. |
| Settings style assistant and themes | Existing SettingsCommandCenter / ThemeProvider in main. No new assistant framework. |
| AI Coach opening UI, Gemini provider safety and board integration | #139 → #141 → #142 → #143, including exact indexed-ply handoff and bounded provider response reading. |
| Desktop Home balance | Two-commit reviewed #138 snapshot at `2b38bcb9`: apply only its Home CSS and matching regression. |
| Latest sidebar preview | Compare actual file contents at `730f0e30` with current files. Wordmark, SVG and branding tests already match. Transfer only the remaining king-sheen gradient; preserve newer NRW navigation, scrolling and typography. |
| Future intelligence architecture | #140 is a design proposal, not a working second conversational assistant. It is not represented as implemented. |

## Isolated visual build

From `tmp/`, run `node scripts/buildReview.mjs <full-published-source-sha>`.
This uses the real application and existing Vite configuration. It produces a
separate `dist-review/` artifact with visible QA feature routes, explicit `.invalid`
service bindings, no credential, no env-file loading or VITE-prefixed env import,
no Sentry endpoint, and a CSP permitting network connections only to the static
site's own origin. Ordinary builds/default-OFF flags and server code are unchanged.

`review.html` is an owner-facing Russian navigation/report page outside the product
UI. It identifies this as a visual-only copy before entering the actual app. No
synthetic session, fake conversations, generated lesson or fabricated game data is
inserted. `snapshot.json` records the exact published GitHub source SHA. Explicit
route index files support static hosting without changing any service setting.

The native private review Site receives only this prebuilt static artifact. Its
own publication is a separate review resource, never the ChessAZ production
project/domain. Existing Render/Vercel settings, secrets, bindings, Supabase data,
migrations and the public ChessAZ release remain unchanged.

## Acceptance boundaries

The owner can review current screens, local theme/appearance controls and local
chess analysis. Authentication, remote chat/messages, online play, archive data and
real Gemini remain unavailable in this visual-only copy. Network/error/empty states
are the actual application's states, not fixture replacements. The previous hosted
QA blockers are still open and must not be marked accepted by this publication.

Validation to record in the Draft PR: the updated Home regression, review isolation
checks, full CI on the exact integrated head, build, mobile/desktop browser review,
Stockfish worker/board interaction and the returned private hosting deployment URL.
