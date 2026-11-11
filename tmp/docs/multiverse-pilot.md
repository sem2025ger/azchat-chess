# ChessAZ MULTIVERSE pilot

Status: **experimental, disabled by default**. This branch must not be merged until CI and browser QA pass.

## Enable on an isolated Vercel Preview
Set `VITE_CHESSAZ_MULTIVERSE=true` in the preview build environment, rebuild, and open the existing Analysis page. Leave the variable unset for production.

## User flow
1. Open Analysis, load a completed game or create a legal position in the existing editor.
2. Navigate to the desired ply (or play an alternative move), choose your color and computer depth.
3. Click **Play from here**. A dedicated Stockfish Web Worker plays the opposite color on the same board.
4. **Try again** restarts from the same root FEN. **Return to analysis** restores the original analysis without changing its history.
5. **Save variation** keeps the independent move line in bounded local browser storage; **My variations** reopens it for analysis. **Copy PGN** exports the selected saved line including its setup FEN for sharing outside ChessAZ.

## Safety
- No multiplayer socket messages, rated games or server clocks are involved.
- FEN is validated before the worker is called; every move is validated with chess.js.
- Stockfish practice owns a separate worker, never reuses the analysis engine callbacks.
- Local storage is browser-local and not synchronized across devices.
- The currently implemented pilot does **not** provide cross-branch engine comparison or native link sharing. Those must not be advertised as delivered.

## QA still required
- `cd tmp && npm ci && npm test && npm run build && npm run lint`
- Desktop and mobile browser QA: load PGN, seek to ply, change move, play white/black, reset, save, reload, editor FEN, checkmate, promotion, en passant, castling.
- Regression: Analysis, Chess-Treff, online games, six languages, themes, board layout and keyboard access.
- Check CI status and Vercel Preview manually before considering PR ready.
