# ChessAZ desktop analysis — approved geometry integration

## Acceptance and scope

On 20 October 2026 the owner inspected `ChessAZ-board-panel-aligned.html`,
approved the board/panel sizes, positions and gap as final, and explicitly
requested integration into the site's main version. This supersedes the earlier
request to keep PR #66 in draft pending layout approval.

The approved reference workspace is 1560 × 880 px, excluding the sidebar:

- Playing field: 716 × 716 px; board frame: 760 × 760 px.
- Analysis panel: 574 × 760 px; board/panel gap: 51 px.
- Board column: 814 px, including the 24 px evaluation bar and 30 px gap.
- Left/top workspace inset: 66/10 px; player labels: 36 px per row.
- Board and panel share the same height and top player-row offset.
- Smaller workspaces scale this composition together; larger ones retain the approved size.

The production React interface retains its real analysis controls, history,
position map, editor and exports. The static HTML's placeholder analysis content
is not copied into production. Final geometry rules apply only from 1024 px.

## Validation

- Local production build and project-reference typecheck: passed.
- Frontend tests: 50 passed, zero failures/skips.
- Lint: zero errors, 50 existing warnings.
- Regression coverage checks reference dimensions, overflow on smaller
  workspaces, the size cap, and the CSS board/panel alignment contract.
- Owner approval applies to the HTML reference. Live React rendering and
  interactive browser acceptance remain unverified; browser access was previously
  declined and was not retried or bypassed.

## Existing feature limits

The position map derives current-board facts and legal Stockfish continuations;
it is not a full strategic explanation system. Map body translations cover
Russian/English with English fallback. The source mock's full graph is not implemented.
Public maintenance gating and backend/database settings are unchanged.

## Mobile play controls — 24 October 2026

Scope: restore the owner's older multicolor play-panel reference on mobile
only. The golden desktop panel, game screen and analysis screen are preserved.
The selected reference is `1000173859.jpg` (a camera photograph, not a pixel
specification). The mobile adaptation deliberately omits the two footer
subtitles and retains the requested tournament availability label.

- Compared the source panel and the rendered mobile panel together in a
  normalized comparison image. The time/icon/chevron, rounded gradient CTA,
  dark frame and two footer actions follow the reference's visual hierarchy.
- Initial P1: the footer overlapped bottom navigation at 375 × 667. Fixed by
  constraining the pre-game board to available portrait height while retaining
  its square aspect ratio. Re-capture confirmed panel bottom 569, navigation
  top 595, board 277 × 277; no scrollable overflow.
- At 390 × 844: panel bottom 674, navigation top 772; board 382 × 382.
- Browser verified native clock selection and the existing invitation dialog.
  CSS respects reduced-motion preferences; controls retain touch target sizes.
- Desktop golden panel retains its original JSX/styles, four quick presets,
  and readiness off by default. Browser inspection confirmed these controls.
- Local validation: 105 frontend tests passed, production build/typecheck
  passed, lint zero errors (55 pre-existing warnings). CI adds viewport and
  dialog/focus regressions for 375 × 667, 393 × 720 and 390 × 844.
- This UI-only task does not certify real-account mail/password delivery or
  replay a two-person game. No auth, backend or chess rules were changed.

final result: passed
