# ChessAZ PR 66 — desktop analysis verification

final result: blocked

## Visual target
- Source: original interactive obsidian/gold mock, commit 9e9aa461f6452d40ed4e700357bc4c521e677b53, tmp/public/analysis-obsidian-violet-preview.html.
- Source was opened and visually inspected in the cloud browser at a 1364 × 936 viewport. It shows aligned board/panel, gold/obsidian tabs and buttons, and a position-map tab.
- User-provided defect evidence: upload/Снимок экрана 2026-10-20 072419.jpg, 1920 × 1080 including desktop/browser chrome. It shows header overlap, displaced panel, missing map, duplicate editor coordinates.
- Explicit owner overrides: label the engine tab Analysis; move transport buttons into the panel; retain exactly Analysis / Position map / Games; expose the editor through a separate Board editor button alongside FEN.

## Implementation
- Workspace: tmp/ in this branch. Local preview started with sites-preview at terminal.local:4173.
- Implementation screenshot: unavailable. Browser access to the local preview was explicitly declined. No alternate browser or rendering workaround was used.
- Implementation viewport, pixel dimensions, and density: unverified. There is no valid side-by-side source/implementation comparison.

## Findings and changes
- P1: board/panel alignment. Added explicit board grid placement and removed old review-only transforms/centering; panel is top-aligned and follows the measured board height from 1024px. Outer board border clipping was removed in desktop review only. Visual verification remains blocked.
- P1: missing position map. Added live pawn/file/material facts and legally replayed current-FEN Stockfish candidate continuations, with selected-line square highlights and opponent reply. These are engine continuations, not an independently validated strategic-plan explanation system.
- P2: controls. Restored transport inside the analysis panel; added genuine 1–5 MultiPV search selection and monotonically increasing depth 18/24/30/36. Board editor remains isolated from the current session until applied.
- P2: export/share. PGN includes actual cached evaluations only; share URL carries the validated current FEN.

## Required fidelity surfaces
- Typography: existing application fonts retained; source decorative opening title has no equivalent for an unknown/custom position. Browser wrapping is unverified.
- Spacing/layout rhythm: grid, transforms, offsets, sizing and board/panel coupling changed; visual measurement remains pending.
- Colors/tokens: existing obsidian/gold styling reused; new map cards use the same palette. Contrast and focus appearance need browser QA.
- Image/asset fidelity: existing board/piece assets preserved. No generated replacements were introduced.
- Copy/content: three requested tab names retained; map contains current-position facts and engine lines instead of the source's fixed example plans. Russian/English map body provided, other languages currently fall back to English. Full source graph and semantic strategic explanations remain outside this fix.

## Validation
- Local production build (includes project-reference typecheck): passed.
- Local frontend tests: 48 passed, zero failures/skips.
- Lint: zero errors, 50 existing warnings at last check.
- New five-line UCI regression failed before the engine fix, then passed.
- Browser-rendered primary interaction checks, viewport matrix, console inspection and focused/full-view comparison: blocked by denied browser access.

## Acceptance
Do not describe the full redesign or visual alignment as verified. Keep PR Draft until the board/panel geometry, map selection, editor, history navigation, depth, five lines, export/share and responsive layouts can be checked in an authorized browser session. No merge or production configuration change is included.

## Owner feedback iteration — 20 October 2026
- Owner inspected Preview 880dc00 and reported that the workspace was too small, too low, and the panel too far right. This confirms the prior alignment/sizing fix is not visually accepted.
- Removed vertical centering, the 630px board cap, and the unused space inside the board column. Geometry now uses the actual workspace and header dimensions, keeping a 24 CSS-pixel board/panel gap and a square that fits the remaining height. Panel consumes remaining width.
- Added geometry regression tests for standard, wide and wrapped-header viewports. These test actual sizing logic, not browser rendering.
- Post-fix browser evidence remains unavailable; visual acceptance is still blocked pending an authorized inspection.

## Owner feedback iteration — compact board and game metadata
- Owner approved the 9334fb5 composition and requested a modest reduction of both board and analysis panel, leaving room for player names and possible future clock information.
- Scale the preferred board and panel widths to 92%, retaining the 24px gap, readable text and minimum panel width. Reserve 96px vertically for game metadata and breathing room; the panel still follows the actual board height.
- Show existing player rows only for a loaded game. Show a clock icon next to the supplied time control; do not invent remaining clock times for custom positions or games without clock data.
- The new geometry regression failed before the fix, then passed. All 48 frontend tests and production build/typecheck passed.
- Cloud browser access to the deployment was declined in this turn. No alternative browser or rendering workaround was attempted. Browser appearance and alignment remain unverified; PR stays Draft.
