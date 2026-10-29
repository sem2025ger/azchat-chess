# ChessAZ AI Coach — general opening preparation (QA only)

User-selected legal SAN sequences (1–40 plies) and playing color, any opening. Uses the existing privacy-aware PositionIndex and compares up to 50 strongest and 50 newest records for the exact resulting position. Continuations are grouped by the next SAN move, never by a hardcoded Najdorf ply. All entries are verified by replaying their PGN at the indexed ply. Up to five model games per move and counts based only on shown games. AI explanations are optional and not engine-verified.

Route: POST /api/ai-coach/preparation with {moves,color,language}. Existing feature flags remain default OFF. No production deploy, no migrations, no environment changes, no merge. QA must verify opt-outs, correctness, six locales and mobile layout before release.
