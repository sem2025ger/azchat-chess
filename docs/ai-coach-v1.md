# ChessAZ AI Coach — general opening preparation (QA only)

User-selected legal SAN sequences (1–40 plies) and playing color, any opening. Uses the existing privacy-aware PositionIndex and compares up to 50 strongest and 50 newest records for the exact resulting position. Continuations are grouped by the next SAN move. All entries are verified by replaying their PGN at the indexed ply. Up to five model games per move and reply counts based only on shown games. AI explanations are optional and not engine-verified.

Route: POST /api/ai-coach/preparation with {moves,color,language}. Existing feature flags remain default OFF. No production deploy, no migrations, no environment changes, no merge. QA must verify opt-outs, correctness, six locales and mobile layout before release.

## Universal preparation follow-up

- Component and stylesheet: `OpeningPrep`. Shared copy: `tmp/src/i18n/openingPrepCopy.ts`, with complete de/en/ru/az/tr/uk dictionaries, including accessible labels, turn, color and errors. Existing application `ua` preferences map to `uk` within this module; the API retains `ua` compatibility. The app-wide language/storage contract is unchanged.
- Each continuation has neutral `replies` and `replyColor`; the reply side depends on whose turn it is, independently of the user's playing color.
- Analysis receives each game's own indexed `ply`, rather than the number of input moves. This also handles transpositions reached at a different ply.
- Input, color, language or token changes abort a pending request and hide mismatched results. A late response cannot replace the current query.
- Coach reuses `normalizedPositionKey` from PositionIndex. Keys exclude halfmove/fullmove counters, preserve side/castling, and canonicalize legally relevant en passant. The index verifies the complete position after a 64-bit hash match; hash equality alone is insufficient.
- Production source adapter reads only `spieler_broadcast_games`, plus ratings, verified public club membership and active opt-outs. It does not read club-room games, durable games or personal preparation. Coach rejects records without the public archive provenance tag. This tag is an extra boundary check; the authoritative boundary is the dedicated archive adapter and server-only table grants, not a caller-provided string.
- Opt-outs for either player are reread on every index query, after cached position matching; a failed privacy lookup fails closed.

Validation: `server/aiCoach.test.js`, existing positions/replay regressions and `tmp/tests/openingPrep.test.mjs` (real Chromium, synthetic HTTP responses). A separate read-only QA archive check used eight real rows in a local index, 16 opening/color queries, with zero rejected rows. The hosted QA database contains 14,979 archive games; the eight-row check is not a complete hosted acceptance run.

Still required before Ready for Review: fresh CI on the follow-up commit, hosted QA against the deployed API/full index, owner visual/chess acceptance. No Gemini key or hosted feature flag was changed, and no live Gemini response was evaluated.

Stage 2 design is separate: [engine-grounded coaching](ai-coach-stage2-design.md). Main-platform launch preparation is independent: [production readiness](production-readiness-20261029.md).
