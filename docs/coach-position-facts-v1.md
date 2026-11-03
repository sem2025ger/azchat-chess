# AI Coach position facts V1 (server-only)

## Gate and scope
`AI_COACH_POSITION_FACTS_ENABLED` must equal the exact string `'true'` to attach `evidence.positionFacts` to AI Coach requests. Otherwise, neither the evidence nor either model instruction string changes. The gate is **OFF by default** and is not set by this change. The existing AI Coach gate and authentication remain unchanged.

`positionFacts(fen)` is pure, deterministic, built with the existing `chess.js@1.4.0`, uses no network, engine, archive or move search, and returns `null` for invalid FEN. Objects have fixed field order; arrays are sorted by squares (file then rank) or by file. JSON is limited to 4096 UTF-8 bytes; over-limit results fail closed as `null`.

## JSON interpretation
- `material.white` / `material.black`: counts of `p,n,b,r,q` and `bishopPair` (two or more bishops); `balanceWhite` is White's material minus Black's using P=1, N=3, B=3, R=5, Q=9.
- Each `white` / `black` object contains:
  - `pawns.isolated`: pawn squares on a file with no friendly pawn on either adjacent file (two isolated doubled pawns are both listed).
  - `pawns.doubledFiles`: files with at least two friendly pawns.
  - `pawns.passed`: pawn squares with no enemy pawn ahead on its file or either adjacent file, including enemy pawns far ahead.
  - `pawns.blockaded`: squares of all pawns whose immediately forward stop square is occupied by an enemy **non-pawn** piece (knight, bishop, rook, queen or king), whether or not the pawn is passed. A friendly piece ahead is a temporary obstruction, not a blockade. An enemy pawn directly ahead is pawn contact (a ram), not a piece blockade.
  - `pawns.passedBlockaded`: the passed-pawn subset of `pawns.blockaded`; exactly `blockaded ∩ passed`.
  - `pawns.pawnIslands`: number of contiguous groups of files occupied by friendly pawns; no pawns gives zero.
  - `files.open`: files without either side's pawns.
  - `files.halfOpen`: files without friendly pawns, with at least one opposing pawn.
  - `outposts`: knights and bishops on ranks 4–6 for White / 3–5 for Black, protected by a friendly pawn from a diagonally adjacent square one rank behind, with *no* enemy pawn on an adjacent file **still ahead of the piece** and thus able to advance to attack it in future. This conservative check ignores blocked pawn paths, pins, special captures and the turn.
  - `hanging.static`: always `true`. `undefended`: non-king pieces attacked geometrically by an enemy piece and by **no** friendly piece. `lowerValueAttacked`: non-king pieces geometrically attacked by an enemy piece of lower material value; these may also be defended. Each entry lists piece letter, exact square and attacker squares; for `lowerValueAttacked` only lower-valued attackers are listed.
  - `king.square`: current king square; `castled` is only a **heuristic** (king currently on g/c/b file on its home rank), not proof that castling actually occurred.
  - `king.pawnShield`: number of friendly pawns on the king's file and its immediately adjacent files, within the first two ranks in front of the king; an edge file uses fewer columns.
  - `king.openFilesNearKing`: within the king's file and adjacent files, those that are either open (no pawns of either side) or have no own pawn while an enemy pawn is present. The latter are half-open **for the friendly side**; having one's own pawn on the file while the enemy lacks one does not trigger this feature.

## Limits / safety
These facts are **static descriptors**, not tactical conclusions or Stockfish evaluations. Geometric attacks account for line-of-sight blockers but do not calculate pins, x-rays, en passant, legal moves, move ordering, or tactical exchange outcomes. `undefended` does not guarantee the opponent can legally capture; `lowerValueAttacked` does not guarantee a material loss. `castled` is positional only. Outposts are conservative under the stated pawn-geometry definition. Material balance is not a positional evaluation.

Only when the fact gate is ON does the model receive the additional positional-facts instruction, in both legacy and server-engine paths, requiring positional claims to be grounded in the exact supplied facts. Engine-dependent tactics must continue to rely on `candidateLines`. The instruction is a model constraint, not a proof that an external model will always comply; later evaluation of generated text remains necessary.

## Coverage
29 hand-specified fixed FEN positions cover start position, IQP, isolated/doubled and passed pawns, blockade, pawns that prevent passage, open and half-open files, both-colour knight outposts, bishop outpost, enemy pawn potential to challenge an outpost, undefended vs defended hanging pieces, lower-value attackers, castled/uncastled king, full/broken pawn shields, both sides to move, pawn islands, bishop pair, material balance and sparse endgames. Invalid FEN, repeatability, bounded size, and legacy flag-OFF behavior are also tested.
