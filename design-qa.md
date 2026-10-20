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
