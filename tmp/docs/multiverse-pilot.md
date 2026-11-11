# ChessAZ MULTIVERSE

Status: **behind `VITE_CHESSAZ_MULTIVERSE`, disabled by default**. Production builds never set the flag.

## Enable on an isolated Vercel Preview
Set `VITE_CHESSAZ_MULTIVERSE=true` as a branch-scoped Preview variable for the feature branch only, deploy that branch, open `/game`. Leave the variable unset for production and for every other branch.

## Where it lives
Everything stays inside the existing Analysis page (`/game`):
- Desktop (≥1024 px): a fourth workspace tab **Training** next to Analysis / Position map / Games.
- Mobile and tablet: the same two sections render below the board and the move navigation.
- Flag off: the three original tabs and the unchanged board column; no MULTIVERSE code paths run.

Sections and actions:
1. **Play computer** — your pieces, computer level (Stockfish depth 4–20), **Play from here** (disabled on checkmate/stalemate/draw), **Try again** (same root FEN), **Save variation**, **Return to analysis**. A dedicated Stockfish Web Worker plays the opposite colour; the analysis engine is stopped while training and the original game, its history and its saved session stay untouched.
2. **My variations** — bounded local browser storage (20 entries): **Open** (loads the line into Analysis), **Share** (copies a ChessAZ link), **Copy PGN** (with `SetUp`/`FEN` headers), **Delete**, and **Compare** for variations with the same starting position.

## Engine comparison
`src/utils/multiverseEvaluation.ts`. **Compare** scores every position of the grouped variations with its own Stockfish worker (depth 12, one position at a time, UI never blocked). A result is accepted only for the exact FEN that was requested and only from the final `bestmove`, so a stale search cannot update another branch. Terminal positions are scored locally with chess.js. The table shows, per variation, the final evaluation (White perspective: `+0.35`, `-1.20`, `#3`, `#-2`, `1-0`, `0-1`, `½-½`), the difference to the starting position, and the critical move: the largest loss (≥ 1.00 pawn) by the side that moved. Mate scores dominate centipawn scores and keep their ordering.

## Shareable links
`src/utils/multiverseShare.ts`. `?mv=<base64url JSON {v:1, fen, moves, label}>` on `/game`. The receiver re-validates the FEN with the analysis validator and replays every SAN move with chess.js; a wrong version, unknown fields, illegal moves, more than 300 moves or more than 6000 encoded characters are rejected, the previous analysis is kept and a short notice is shown. A valid link opens the variation in Analysis, adds it to **My variations** (deduplicated) and removes the parameter from the address bar. No server or database is involved.

## Safety
- No multiplayer socket messages, rated games or server clocks are involved.
- FEN is validated before any worker is called; every move is validated with chess.js.
- Practice and comparison each own a separate worker; analysis-engine callbacks are never reused.
- Local storage is browser-local and not synchronized across devices.

## Verification
- `cd tmp && npm ci --legacy-peer-deps && npm test && npx tsc -b && npm run build && npm run lint`
- Browser regression with the genuine Stockfish worker (also run by Frontend CI):
  `VITE_CHESSAZ_MULTIVERSE=true npx vite build --outDir dist-multiverse && node tests/multiverse.browser.mjs`
  Covers: play from move 6 of a loaded game, engine reply, save, try again, return to analysis (session unchanged), engine comparison table, share link round trip in a fresh browser state, invalid link, black side with engine first move, checkmate position blocked, mobile placement below the board, flag-OFF build without any MULTIVERSE UI.
