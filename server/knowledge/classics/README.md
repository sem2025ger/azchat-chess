# Classics knowledge base for Chessy

Full texts of public-domain chess classics, with moves in modern notation, positions and
strategic themes, so the coach can quote a classic passage that fits the current position or
question. Retrieval: `server/coachClassics.js`. It is behind `AI_COACH_CLASSICS_ENABLED` (off by
default) and is not yet wired into the chat.

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
| Alekhine, games collections in the original language | Needed: Russian or German original | Alekhine died 1946. The rights to the English translations have not been checked. | Waiting for source file |

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

Rebuild after changing the builder or the source files:

```
cd server
node scripts/buildClassicsKnowledge.js          # writes capablanca-chess-fundamentals.json
node scripts/buildClassicsKnowledge.js --check  # what the test enforces
```
