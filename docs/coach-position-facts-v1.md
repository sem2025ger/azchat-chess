# AI Coach position facts V1 (server-only)

## Gate and scope
`AI_COACH_POSITION_FACTS_ENABLED` must equal the exact string `'true'` to attach `evidence.positionFacts` to AI Coach requests. Otherwise, neither the evidence nor either model instruction string changes. The gate is **OFF by default** and is not set by this change. The existing AI Coach gate and authentication remain unchanged.

`positionFacts(fen)` is pure, deterministic, built with the existing `chess.js@1.4.0`, uses no network, engine, archive or move search, and returns `null` for invalid FEN. Objects have fixed field order; arrays are sorted by squares (file then rank) or by file. JSON is limited to 6144 UTF-8 bytes in V2; over-limit results fail closed as `null`.

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


## endFacts (V1.1) — facts at the END of a verified Stockfish variation
When the exact server flag \`AI_COACH_POSITION_FACTS_ENABLED=true\` is set and a server Stockfish analysis exists, each model-only \`evidence.candidateLines[]\` entry may include \`endFacts\`. The server replays every SAN move from the queried FEN with chess.js strict notation. If a move is illegal or fact extraction returns \`null\`, that line has **no** \`endFacts\`; the request continues without fabricating results.

\`endFacts\` contains \`fen\`, \`plies\`, \`material\`, and \`white\` / \`black\` with only \`pawns\` and \`king\`. It intentionally omits \`files\`, \`outposts\`, and \`hanging\`. For statements about a resulting pawn structure, the model is instructed to rely exclusively on the matching line's verified \`endFacts\`, not on generalized capture heuristics.

This extension is **model evidence only**: the browser-facing \`engineLines\` and \`candidateLines\` remain unchanged. Flag OFF produces exactly the earlier evidence and prompt; non-server client lines never receive endpoint facts. The supplied chess data cannot guarantee the language model follows the instruction, so QA must still check its actual answer.

Regression: Steinitz–von Bardeleben 1895, after 8...Nxd5, engine line \`9.O-O Bxc3 10.bxc3 O-O 11.Re1\`. The resulting position has exactly one white c-pawn (c3), **no** doubled c-pawns, an isolated pawn a2, and blocked d4.


## V2 strategy rules
All four rules are deterministic static board descriptors computed from the supplied FEN. They do not independently prove strategic advantage or calculate a plan. Existing V1 and V1.1 fields remain unchanged.

1. **Bad bishop** — for each bishop of side S, report \`{square, squareColor, sameColorPawns, fixedSameColorPawns, bad}\`. \`squareColor\` is \`light\` or \`dark\`. \`sameColorPawns\` lists S pawns standing on the same colour as the bishop's square. \`fixedSameColorPawns\` is the subset with an enemy pawn on the immediately forward square. A bishop is marked \`bad: true\` exactly when \`sameColorPawns.length >= 3\` AND \`fixedSameColorPawns.length >= 2\`.
2. **Holes** — \`strategy.holes\` lists squares on S's 3rd and 4th ranks (White: ranks 3–4; Black: ranks 6–5), files a–h, that can never again be attacked by an S pawn: no S pawn on an adjacent file behind the square that can advance to attack it. A pawn already level with the square cannot turn backward. A square is also NOT a hole if an S pawn on the SAME file, behind that square (from S's direction), can still advance onto it, since that pawn can occupy the square and remove the weakness. Exclude squares occupied by an S pawn. For example, black pawns f7 and h7 exclude f6 and h6 respectively; without an h-pawn behind h6, h6 remains a hole if no adjacent pawn can attack it. \`holesOccupiedByEnemyPiece\` is the subset of holes occupied by an opposing knight or bishop. Lists are sorted by square.
3. **Pawn majorities** — \`majorities\` contains \`queenside\` (a–c), \`centre\` (d–e), and \`kingside\` (f–h), each \`{white, black, majority}\` with \`majority\` \`'white'\`, \`'black'\`, or \`null\` on equality. Counts include all pawns standing on those files, regardless of rank.
4. **Queenside minority-attack structure** — \`strategy.minorityAttack\` is true for side S if and only if S has **exactly 2** pawns on files a–c, the opponent has **exactly 3** on files a–c, and an S d-file pawn has an enemy pawn immediately in front of it (a d-file pawn ram). Otherwise false. This is a structural pattern only, not proof of a successful attack.

The V2 fields are \`positionFacts.majorities\` and \`positionFacts.white.strategy\` / \`black.strategy\` containing \`{bishops, holes, holesOccupiedByEnemyPiece, minorityAttack}\`. For the ending of a strictly replayed server-verified Stockfish line, model-only \`endFacts\` contains \`majorities\` and each side's \`minorityAttack\` alongside the existing \`fen\`, \`plies\`, \`material\`, \`pawns\` and \`king\`. Bishop and hole fields are intentionally absent from \`endFacts\`. All V2 evidence remains flag-gated; the flag-OFF path is unchanged. The complete JSON size cap rises from 4096 to 6144 UTF-8 bytes.
