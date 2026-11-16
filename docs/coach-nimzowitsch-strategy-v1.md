# ChessAZ Chessy — Nimzowitsch strategy lenses (QA-gated)

## Scope and provenance

ChessAZ expresses independently formulated general chess-strategy principles, including
central control, development, restraint, prophylaxis, blockade, outposts, open
files, pawn chains and overprotection. Their historical public-domain reference
is Aron Nimzowitsch, *Mein System* (B. Kagan, Berlin, 1925; author died 1935).

The repository contains no book text, translation, diagrams, annotated game scores
or source-book materials. Strategic terminology is not an engine evaluation:
all practical recommendations must be checked against the actual position and
the verified Stockfish lines.

## Runtime architecture

Opt-in env variable: `AI_COACH_NIMZOWITSCH_ENABLED=true`. **Default OFF.**

When enabled **and** Stockfish server analysis has returned candidate lines,
`groundedChat` builds a small `nimzowitschStrategy` evidence object from
`positionFacts(fen)`. It contains methodological guidance and no more than
seven deterministic geometry signals from the current FEN: blocked passed pawns,
outposts, isolated or doubled pawns, occupied weak squares and open/half-open files.

The model may cite these signals as *candidate strategic factors*, not tactical
proof, numerical evaluation or proof of a best move. Verified Stockfish lines
and scores take precedence. No claims about pawn-chain bases, manoeuvres,
prophylaxis, central superiority or overprotection may be invented when their
geometry or legal variation is missing.

The feature does **not** alter Stockfish search depth, budget, engine code,
chess rules, database, frontend or existing opening-game retrieval. When the
server engine is off or unavailable, no Nimzowitsch strategy evidence is sent.
When the flag is off, evidence and prompt instructions remain unchanged.

## QA acceptance

1. Run `cd server && npm ci && npm test` on the branch, verify `coachNimzowitsch.test.js`.
2. With both flags OFF and ON, use identical FEN and engine output. OFF must
   produce the same evidence/prompt as the original pipeline.
3. In QA only, turn on `AI_COACH_NIMZOWITSCH_ENABLED`,
   `AI_COACH_POSITION_FACTS_ENABLED` and `AI_COACH_SERVER_ENGINE_ENABLED`.
4. Compare the first verified line, score perspective, actual opponent reply,
   recorded square/file claims and final plan; reject invented variations,
   unjustified "winning" claims and off-topic references to Nimzowitsch.
5. Verify server engine timeout/failure and client-only lines do not activate
   the new evidence. Check that no book content leaks in network responses.
6. **Do not merge or deploy** without the owner's explicit authorization and
   green Server CI. Rollback: leave the flag OFF.

This is an explanatory strategy-layer milestone, not a complete annotated
chess book ingestion or a guarantee of stronger Stockfish evaluation.
