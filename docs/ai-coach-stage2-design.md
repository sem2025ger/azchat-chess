# AI Coach Stage 2 — proposed engine-grounded teaching

Design only. No worker, model upgrade, database schema, deployment or personal memory is implemented by this follow-up. Stage 1 and the main-platform release remain independent.

## Evidence contract

1. **Engine analysis.** A bounded worker/worker pool outside the Express/Socket.IO event loop runs the pinned Stockfish binary and NNUE checksum. MultiPV 3 is the initial target; depth 18–20 is a target, subject to a measured wall-time/node budget. Return actual depth, nodes, time, UCI PV, score kind (`cp` or `mate`), perspective and any lower/upper-bound flag. Depth is not a proof of exact evaluation. Do not compare incompatible mate/cp scores or lines from different completed depths to assert an "only move". A large stable gap is a candidate teaching signal, followed by a focused re-search.
2. **Position features.** Derive reproducible facts from the validated board: material, bishop pair, doubled/isolated pawns, pawn counts by file and open/semi-open files. Put heuristic tags (backward pawns, weak squares, center classification, attacking plans) in a separate, rule-versioned category with evidence squares and explicit limitations. FEN alone cannot prove historical castling; describe king placement unless move history establishes castling.
3. **Practice.** Query public archive positions with the existing privacy checks. Aggregate statistics over the qualifying population before selecting examples, rather than the existing bounded strongest/newest sample. Report total, known-result denominator, unknown results, score `(wins + draws/2) / known`, source dates, player-color perspective and exact rating-filter semantics. Existing PositionIndex ratings are current catalog ratings, not necessarily ratings when a game was played. Do not label them historical 2200+/2400+ cohorts. Choose 3–5 source-linked examples and expose the first 25 full moves as a learning excerpt, retaining the indexed ply/full PGN for analysis.
4. **Teaching.** Gemini receives only the bounded evidence packet, requested language and playing color. A schema constrains the output to explanation blocks referencing evidence IDs, board squares and approved variation IDs. Evaluation, move notation and statistics displayed to the user are rendered by the server from approved facts. Model fallback returns verified games/facts without generated instruction.

Stockfish WDL is an approximate calibrated model of engine-game outcomes, not a forecast of this learner's winning chances. Label it separately from archive results and store its model/engine version. Side-to-move engine output is normalized once to a documented White perspective; swap W/L when changing perspective. Never mix engine WDL with practical score percentages.

## Position identity and caching

Use the four-field normalized position key for archive transpositions, preserving turn, castling and relevant en passant. Keep the full FEN, halfmove clock and initial-position-plus-move history for engine analysis: the fifty-move rule and repetition can change a position's game-theoretic status. An engine cache key must include that draw-rule context, engine/NNUE version, configuration and analysis budget. Do not reuse the archive key alone for engine conclusions.

At request boundaries validate standard chess, legal moves and size limits. Resolve all PVs against their explicit root position/history. Convert UCI to SAN server-side, replay every ply using chess.js, and reject invalid lines before including them in evidence. Recheck source privacy on every served selection, including cache hits. Keep generated explanations out of shared caches containing user-specific context.

## Output validation

Require `schemaVersion`, `positionId`, `language`, and bounded blocks such as `{kind, text, evidenceIds, variationIds, squares}`. No arbitrary model-generated move array is accepted. Reject unknown evidence/variation IDs, mismatched root/perspective/language, invalid squares, extra fields and overlong content. Permit a single bounded repair attempt; otherwise omit the generated block.

Checking regex-extracted SAN from free text is insufficient: a legal move can be bad, a token can belong to a different root, and natural-language move references can evade extraction. Prefer linked structured move tokens rendered from the server's validated variation library. Schema compliance and move legality do not prove that a tactical claim or teaching explanation is correct; claims must point to supporting engine lines/features and pass chess-expert evaluation. Treat external PGNs and text as data, never instructions.

## Operational limits and acceptance

- Authenticated explicit lesson request only; never an LLM request on every move. Preserve existing game/analysis behavior.
- Bound queue length, per-user work, worker CPU/hash memory, input/output bytes and deadlines; support cancellation, coalescing and provider cooldown. Publish measured p50/p95 with cold start separated. Do not share an unbounded engine workload with live sockets.
- Tests: sign/WDL conversion for both sides, mate scores, incomplete/bound MultiPV, legal PV replay, repetition/fifty-move context, low-data statistics, privacy after cache fill, prompt injection, malformed schema and unavailable model/engine.
- Pedagogical acceptance: a reviewed fixture set of tactical, strategic, defensive and quiet positions, including plausible legal mistakes. Score factual grounding separately from clarity in each of six languages. No "professional coach" claim based solely on green CI.
- Voice, personal memory, learning analytics and automatic methodological changes remain later milestones, with separate permissions and retention/access design.

References checked 2026-10-29: [Stockfish evaluation and WDL](https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html), [official WDL model](https://github.com/official-stockfish/WDL_model), [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). API syntax/model availability must be rechecked at implementation time; this design does not change the existing Gemini integration.
