# Classics knowledge base for Chessy

Full texts of public-domain chess classics, with moves in modern notation, positions and
strategic themes, so the coach can quote a classic passage that fits the current position or
question. Retrieval: `server/coachClassics.js`. It is wired into Chessy's grounded chat and
position-analysis pipeline (`aiCoach.js`, `aiCoachChat.js`, `aiCoachOpenAI.js`) behind
`AI_COACH_CLASSICS_ENABLED` (off by default).

## Rules for adding a book

- The author has been dead for more than 70 years (Germany, § 64 UrhG). Translations, editor notes
  and modern re-editions have their own rights. Use them only after checking those rights.
- Take the source file unmodified and record its checksum, edition and source URL. Fix printing
  slips only through the `ERRATA` list in the builder, never in the source file.
- Convert a move only when exactly one legal move fits it. Anything else stays as printed.

## Books

| Book | Edition used | Rights | Status |
|---|---|---|---|
| Capablanca, *Chess Fundamentals* (1921) | Project Gutenberg #33870: revised edition with the 1934 preface | Author died 1942. Public domain in Germany since 2013 and in the USA. | Done |
| Nimzowitsch, *Mein System* (1925) | Needed: German original, B. Kagan, Berlin 1925 (1958 Engelhardt and later reprints carry their own rights) | Author died 1935. Original public domain since 2006. Hereford's English translation: translator's rights not cleared. | Waiting for a scan of the original |
| Löwenthal, *Morphy's Games of Chess* (1860) | Needed: 1860 Bohn edition | Löwenthal died 1876 | Waiting for source file |
| Steinitz, *The Modern Chess Instructor* (1889) | Needed: 1889 Putnam edition | Steinitz died 1900 | Waiting for source file |
| Philidor, *Analyse du jeu des échecs* (1749/1777) | Needed: French original or an early English edition | Philidor died 1795 | Waiting for source file |
| Lasker, *Lehrbuch des Schachspiels* (1926) | Needed: German original | Lasker died 1941. The 1927 English translation has its own rights. | Waiting for source file |
| Alekhine, *My Best Games of Chess 1908–1923* (1927) | David McKay / Tartan Books reprint (trans. J. du Mont, d. 1956 & M. E. Goldstein, d. 1966) | Alekhine died 1946 (original PD in EU). English translation protected until 31 Dec 2036 (§§ 3, 64, 65 UrhG). Zero verbatim translation prose committed: factual PGN/SAN/FEN data, metadata, errata and fresh ChessAZ coaching summaries only. | Done (100 games, 292 PDF pp.) |

The build environment can only reach GitHub. archive.org and gutenberg.org are blocked there, so
the owner has to supply other sources as files.

## Capablanca, *Chess Fundamentals*: how the record is made

1. `sources/capablanca-chess-fundamentals/gutenberg-33870-8.txt` is the unmodified Gutenberg file,
   licence included (SHA-256 checked by the builder).
2. The text is split into 112 units: the introductions to the 33 sections, 67 examples and
   14 games. `originalText` keeps each unit verbatim.
3. Descriptive moves ("Kt - K B 3", "P × P") are converted to SAN in a concrete position
   (`descriptiveNotation.js`, `notationTracker.js`):
   - A printed game score is resolved as one sequence, so later moves settle an ambiguity.
   - Numbered notes branch from the score. "followed by" skips the unrecorded reply.
   - An unnumbered move is converted only if its context (for example "Not …", "If …", "is
     preferable") gives one reading. Such moves get no +/# mark.

   Result: 3,421 of 3,747 printed moves converted (91.3%). All 60 main lines replay legally.
4. The positions of the 150 diagrams are recorded in `diagrams.json` with the method used for each:
   - 71 come from the game score itself.
   - 74 were read by an image classifier. It was trained on the score-verified diagrams
     (cross-validated cell error 0.25%), and 53 of these were then checked against the scan by eye.
   - 5 were transcribed by hand.

   Every start position is validated by the legality of the moves that follow it.
5. Themes: each section has its themes in `sectionThemes.json`, and keyword tags are added per
   passage (`classicsThemes.js`). Each position also gets a material signature, so that a rook
   ending on the board finds the rook-ending chapter.

## Alekhine, *My Best Games of Chess 1908–1923*: how the record is made

1. Source batches `sources/alekhine-best-games-1908-1923/metadata.json` and `batch-01.json`..`batch-10.json`
   cover all 292 pages (`i–xii`, `1–267`, cover & indexes) and all 100 games (`g1`–`g100`).
2. Copyright compliance: because the J. du Mont (1881–1956) and M. E. Goldstein (1901–1966)
   English translation remains under copyright until Dec 31, 2036, no verbatim translated prose,
   `originalText`, raw OCR, or PDF scans are stored in the repository. Only factual chess data
   (moves, variations, FENs, metadata, errata) and fresh technical ChessAZ coaching summaries are
   retained, enforced automatically by `assertNoVerbatimCopyrightFields` in `buildAlekhineBestGames.js`.
3. Every mainline move (7,060 across all 100 complete games), variation move (3,390 across 499
   variations — 10,450 validated moves total), and diagram FEN (295 diagrams) is replayed and
   verified with `chess.js`, yielding 11,344 generated FENs (9,811 unique FENs) indexed by 4-part
   normalized `positionKeys` (excluding printer-erratum plates).
4. All 48 verified book/diagram/score/arithmetic errata are recorded explicitly in `errata` with
   descriptive strings; Games 10 and 21 are re-verified against the scanned pages and replay to
   completion (113 and 91 plies).

Rebuild after changing the builder or the source files:

```
cd server
node scripts/buildClassicsKnowledge.js          # writes capablanca-chess-fundamentals.json & alekhine-best-games-1908-1923.json
node scripts/buildClassicsKnowledge.js --check  # what the test enforces
```
