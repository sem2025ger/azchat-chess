# ChessAZ AI Coach v1 — isolated QA specification

Status: Draft PR #139. No merge, production deploy, environment change, or database migration authorized.

## What this version really delivers
A logged-in player preparing with Black in the Sicilian Najdorf can request a curated list of real model games. The server anchors on the exact position after 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 and considers only games reaching it at exactly ply 10; later transpositions must not be falsely labelled as White's sixth move.

Results are grouped by White's sixth move (for example 6.Bg5 or 6.Be3). Up to five real games are shown per group. Each game displays name, event, result, its opening sequence of up to 25 full moves and a link to the existing ChessAZ analysis board. A count of Black's responses is computed ONLY over the displayed games and must not be described as full-database, GM, or opening-theory statistics.

The server reuses PositionIndex.search on two bounded samples (maximum 50 strongest and 50 newest results) and deduplicates games. This is NOT an exhaustive catalogue of all matching games. If FIDE ratings are missing, the app does not invent player strength. One game result never proves that its opening variation is objectively sound.

A short Gemini introduction is optional, server-side, generated only on a user action, and identified as NOT verified with Stockfish. The model receives only bounded canonical SAN sequences, not player names or user chat content. A missing key, time-out or malformed response causes a transparent non-AI fallback. No AI requests on every move or page load.

## Feature flags, prerequisites and operations
All default to OFF. QA-only configuration requires explicit owner authorization and separate review:
- POSITION_SEARCH_ENABLED must be on for QA backend (required: reuse its existing one-time index, no second index).
- AI_COACH_ENABLED must be on for QA backend route.
- VITE_AI_COACH_ENABLED must be on only for the QA frontend preview.
- GEMINI_API_KEY optional: server-side only, never send to the client, logs or GitHub.
- GEMINI_MODEL defaults to gemini-2.5-flash. Verify the provider supports the selected model and permitted data processing before enabling in QA.

Endpoint: POST /api/ai-coach/preparation with validated opening=najdorf, color=black and language among de/en/ru/az/tr/ua. Supabase access-token authentication, IP and account rate limits, bounded JSON body, no-store cache and standard error responses. Disabling the feature returns 404. Not-ready/failed index or failed privacy reads must fail closed (503), not fabricate content.

Existing position index checks opt-outs for both participants on each query. Client unmount aborts in-flight requests to avoid cross-account residual results. This PR performs no writes and retains no lesson history. It is a demonstrable baseline, not a self-learning system or an online secondant.

## Architecture for the next QA milestones (not implemented here)
1. Evidence layer: high-quality legally licensed games + provenance + versioned verified opening-position snapshots + the current privacy checks.
2. Analysis layer: legal-move checks with chess.js, bounded server-side Stockfish analysis outside the request hot path, engine version and search-depth traceability. Avoid equating a winning game with a best move.
3. Teaching layer: model explains the intentions of White and Black from evidence and the checked analysis; provides exercises with concrete positions, then tests the student's understanding.
4. Personal memory: only after explicit informed opt-in; store separate per-account profile, repertoire, difficult motifs and progress, with RLS, export/delete, retention and authorization checks. No joining users' private conversations to public training data.
5. Quality improvement: aggregate feedback without raw conversations by default. On a scheduled offline evaluation, compare method variants on curated chess test positions and human teacher rubrics: chess correctness, clarity, knowledge retention and false assertions. Version all method revisions; require review, zero regression and staged QA before promotion. Never promote arbitrary AI answers into shared verified knowledge.
6. Privacy and fairness: no engine help inside rated live games; verify consent and GDPR requirements, provider data terms, age restrictions and regional retention rules before production.

## Acceptance checklist
- CI: Server + Frontend + isolated PostgreSQL regression pass, no skipped tests.
- Najdorf exact ply, variant grouping, displayed Black response counts, quality ordering and duplicate handling tested.
- Anonymous access blocked; invalid token blocked; index warming/unavailable fails closed; provider failure falls back.
- All six languages, mobile wrapping, game-analysis navigation, changed account/logout and no Gemini key in frontend.
- Separately authorized QA: compare returned PGNs and board moves manually, verify opt-out exclusions and rate limits; monitor latency, cost and memory.
- Do not merge to main, modify production Vercel or Render, enable flags, or run database migrations in this milestone.
