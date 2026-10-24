# Approved mobile release — 24 October 2026

Owner approved the final mobile result and requested publication to the main mobile site on 24 October 2026.

- Approved reference: PR #92, `fffbf7f808e96409c10573e33712b23021dd4b9d`.
- Production baseline: `2242c36d6cf81909ef30feec72d47ee11bc3cc79`.
- Preserve the approved reference in a backup branch before publishing.
- Integrate only the approved mobile analysis/editor/home/navigation/Settings files and their supporting helpers/tests onto main.
- Four optional interface palettes have approximately half their initial HSL lightness; retain all existing themes and the readable restore-defaults control.
- Opt-in mobile move confirmation stays off by default and does not affect Analysis or desktop gameplay.
- Existing production authentication, profile, chat and club routes, server code, direct dependencies and database migrations stay at the production baseline, except the transitive security patch recorded below.
- No database migration, backend configuration change, paid plan, or automatic Preview change is part of this release.
- Frontend CI includes the approved mobile browser regression. Desktop three/five-line Analysis controls must remain available.

The source QA stack also contains separate club, tournament and authentication work. Those changes are deliberately excluded from this mobile release.

## Verification of the extracted release

- Frontend: 85 tests passed (club/auth QA-only tests are not part of this release).
- TypeScript production build passed; lint: 0 errors, 50 existing production warnings.
- Real Chromium Analysis regression passed at six mobile sizes, with a simulated bottom safe area, real Stockfish, history, board flip, editor validation/cancel and desktop three/five-line controls.
- Settings checked at 360×640, 393×852, 430×932, 1024×600 and 1280×720: all 14 themes reachable, new dark gradients applied, reload persistence, restore-defaults behavior and readable controls.
- Source parity: approved UI source files are copied from the approved SHA; only trailing whitespace in GameScreen is cleaned; the browser test harness cleanup/diagnostics are hardened as recorded below.
- GitHub Frontend and Server CI must pass on the release PR before main is updated.

## Required dependency security patch

The first release CI passed all 119 server tests but npm audit blocked release on GHSA-27r3-jxmh-p828 in the existing body-parser 1.20.8 lock entry. Update only that transitive lock entry to 1.20.9; retain package.json, server code, all other lock entries (including platform metadata), and database migrations. Local audit after the patch reports zero vulnerabilities. Frontend and Server CI are required again for the final release commit. This does not change backend configuration or provision services.

## Browser regression diagnostics

Two final CI attempts passed all mobile geometry, real Stockfish, move/history/flip and editor checks, then timed out during the desktop transition. Preserve every assertion; log desktop progress and the original exception, and bound disposable Chromium/server cleanup so it cannot mask the failing stage. Local checks continue to exercise real Stockfish and desktop three/five-line controls. No application behavior is changed by this test-harness follow-up.
