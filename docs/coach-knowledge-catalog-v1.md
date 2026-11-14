# ChessAZ AI Coach — Literature Catalog V1 (QA gated)

Owner-approved bibliographic list as of 2026-11-04. This change **does not ingest any book text, scan, translation, annotated PGN or chess-analysis excerpt**. `server/coachKnowledgeCatalog.json` is a curated metadata inventory of 20 candidate works by seven authors, including posthumous editorial compilations as separate evidence types.

## Runtime contract

- `AI_COACH_KNOWLEDGE_CATALOG_ENABLED` defaults to **OFF**. No new API route, frontend copy, database, dependency or deployment change.
- When enabled on QA, author/book questions may include up to eight relevant title/author/edition records in the existing OpenAI Coach evidence packet.
- The model receives explicit instructions that this is metadata only: it must not claim it read a book, invent quotations, chess positions, page references, commented games or analyses derived from a title.
- Positional claims still require current FEN, legal SAN and engine or server-verified chess evidence; generic author mention cannot establish an engine recommendation.
- Do not enable in production without QA and explicit owner approval.

## Rights and provenance

Death of an original author does not clear **all** publications: separate copyright may protect translations, editorial annotations, newly prepared editions, photographs, cover art and scanned images. Treat every linked source as a discovery reference, not a verified downloadable public-domain source or reuse licence. Kotov's 1953/1958 analytical texts and Petrosian's later editions are **not** authorised for full-text import by this manifest. No original passage, modern translation, edition typography or book scan has been copied.

## Acceptance gate before any full-text ingestion

1. Verify authoritative edition details and public-domain/licence status for both original and the exact digital file; record provenance, jurisdiction, translator/editor and proof of licence.
2. For rights-cleared originals only, extract bounded pedagogical facts with source/edition/page and human-verified PGN or positions. Revalidate every move from FEN using chess.js and never infer engine evaluations from historical commentary.
3. Ensure no old annotations are falsely labelled as the author's when added by later editors. Label every commentary author separately.
4. Add position-grounded retrieval with bounded context, refusal on missing evidence, exact-source attribution and isolated QA tests. Do not train or fine-tune a model on protected editions without rights.
5. Run Server CI, Frontend CI and independently compare OFF/ON behaviour before considering a QA-only flag change.

Rollback: leave the flag OFF, or revert this branch before merge. No migration is required.
