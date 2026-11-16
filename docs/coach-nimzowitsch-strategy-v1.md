# ChessAZ Chessy — Nimzowitsch strategy lenses (QA-gated)

## Scope and provenance

Source supplied by the owner: Aron Nimzowitsch, *My System*, Quality Chess English
new translation, scanned PDF. The PDF is used **only to identify general chess
strategic concepts**. The English translation and modern edition are not cleared
for redistribution. No image, quotation, translation, game score, annotated PGN,
passage, or source PDF is embedded in the ChessAZ repository, model prompts or API.

Topics reviewed in the supplied PDF (printed page numbering):

- **Centre and development**, pp. 17–30: central influence and development tempo.
- **Open files / 7th rank**, pp. 31–52: file control and penetration points.
- **Passed pawn and blockade**, pp. 73–102: restraint is more than immediate capture.
- **Pinned pieces / pawn chains**, pp. 125–164: structural restraints and attack on chain bases.
- **Prophylaxis and the centre**, pp. 177–200: prevent opponent counterplay; consolidate.
- **Isolated queen's pawn**, pp. 229–233: static weakness versus dynamic possibilities.
- **Overprotection and weak pawns**, pp. 247–252: strategically important defended points.

These are section/topic references, not a claim that the application stores or
quotes the referenced edition. Principles are independently phrased for ChessAZ.

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
