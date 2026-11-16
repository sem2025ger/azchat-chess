# Chessy Strategy Knowledge — pilot (16 November 2026)

## Status and scope

This QA-only pilot is a **position-conditioned strategy cue bank**, not an ingestion of complete chess books and not model fine-tuning. Twelve original short paraphrases based on identifiable classical works are stored in `server/coachStrategicPrinciples.json`. The selector in `server/coachStrategyKnowledge.js` sends only up to six context-relevant cues from deterministic `positionFacts`. Every cue names an author, source, attribution strength, side, objective observed fact, possible goal, and a warning that it is not engine-verified.

* Wilhelm Steinitz — `The Modern Chess Instructor` (1889), classical accumulation and prerequisites of attack.
* Emanuel Lasker — `Lasker's Manual of Chess` (1927), chapter "The Plan" and treatment of combinations and opening development.
* Aron Nimzowitsch — `Mein System` (published in instalments 1925–1927), passed pawn blockade, outposts, half-open files and prophylaxis.
* Alexander Alekhine — `My Best Games of Chess 1908–1923` and `1924–1937`, selected themes **inferred** from annotated-game practice; not falsely attributed as explicit maxims.

## Verified reference entry points

- Steinitz original book bibliographic record: https://books.google.com/books/about/The_Modern_Chess_Instructor.html?id=e4IiyAEACAAJ
- Steinitz excerpts from the 1889 book, curated with attribution: https://en.chessbase.com/post/an-interview-with-wilhelm-steinitz
- Lasker original 1927 text, `The Plan`: https://en.wikisource.org/wiki/Page:Lasker_(1927)_-_Manual_of_Chess.pdf/216
- Lasker original 1927 text, `The Combination`: https://en.wikisource.org/wiki/Page:Lasker_(1927)_-_Manual_of_Chess.pdf/152
- Lasker original 1927 text, openings: https://en.wikisource.org/wiki/Page:Lasker_(1927)_-_Manual_of_Chess.pdf/73
- `Mein System` publication timeline, 1925 instalments to bound 1927 volume: https://www.chesshistory.com/winter/extra/mysystem.html
- Nimzowitsch translated edition excerpt (reference only; no extraction or inclusion of translated text): https://www.chessmarket.gr/wp-content/uploads/2021/02/MySystem-excerpt.pdf
- Alekhine annotated games original source collection: https://classicchess.com/annotated/alexander-alekhine-my-best-games-of-chess-19081923-1927/
- Alekhine second volume bibliography: https://books.google.com/books/about/My_Best_Games_of_Chess_1924_1937.html?id=oCYMAAAAYAAJ

The evidence is uneven: Alekhine principles in this pilot are clearly labelled **editorial inferences from annotated games** rather than authenticated verbatim prescriptions by him.

## Grounding and safety contract

1. No third-party webpages are fetched by production/QA requests; all entries are curated server-side.
2. No quotation, modern translation, new edition, commentary text, PGN or scan is copied into the data bank.
3. This pilot is not a comprehensive study of all works by these four masters.
4. Cues are selected from computed position features, never treated as evidence of a win, compensation, forcing line or move legality.
5. `Stockfish 19` is the sole source of verified candidate variations/scores, when server evidence is available. Model explanations MUST check those lines before proposing a concrete continuation.
6. The existing `AI_COACH_POSITION_FACTS_ENABLED` gate also governs this pilot. With position facts off, the evidence packet is unchanged. No environment, engine-time or depth settings are modified.
7. Chessy must not assert that a historical author wrote a literal quotation or that a contemporary translation was ingested.
8. Even when the cue triggers, the model may disregard it if contradicted by a verified line or current tactical necessity.

## Rights

Under German Copyright Act section 64, original literary copyright generally expires 70 years after the author's death: https://www.gesetze-im-internet.de/urhg/__64.html . This does **not** automatically clear separate copyright for translators, later editors, commentary, photographs, modern layout or special editions. Permissions and provenance must be checked per edition before any full-text ingestion. This pilot deliberately uses original phrasing and metadata rather than book passages.

## Further work required before production

- Expand from twelve cues to a meticulously sourced, per-chapter annotated corpus, with independently reviewed source/edition rights and optional historical PGN reference records.
- Validate each cue against a human-reviewed benchmark of tactical, positional, equal, materially unbalanced and endgame FENs.
- Compare responses with/without cues in a real model QA run; assess false strategic attribution, unsupported outcomes, and whether the learner understands *goal, mechanism, achievable gain, opponent's defence*.
- Consider a separate **single main plan with an optional truly distinct alternative** response contract and adaptive length. Do not simply increase the present 1200-character limit without assessing UI, speech and rate limits.
- Keep PR #231, #232, #233, main, production and Render/Vercel environments untouched unless explicitly authorized.
