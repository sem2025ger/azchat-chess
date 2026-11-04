# ChessAZ Intelligence V1 — architecture and guarded implementation plan
Status: **Proposal / QA only** · 2026-10-29 · **No application code, schema, data, flags or infrastructure changes in this milestone**

## 1. Goal and precise meaning of learning

Build two distinct feedback loops without replacing existing chess infrastructure.

- **Adaptive AI Coach (player learning):** improve lesson selection using a player's explicitly opted-in practice outcomes, recurring position themes and demonstrated mastery. This is a versioned learning policy with measurable outcomes, **not automatic fine-tuning of Gemini**.
- **ChessAZ Engineering Intelligence (platform improvement):** compare bounded experiments to a frozen baseline, propose fixes through an Alpha agent, require independent Omega validation, owner approval and standard GitHub PR/CI/QA. **No self-editing production runtime, auto-merge, auto-deploy, silent prompt changes or autonomous database migrations.**

The system is *evidence-grounded*, not an autonomous authority on chess positions.

## 2. Verified starting points and constraints

- Main platform baseline at review: `main` SHA `5345c9586a98b4926f1f92399b8b6664bc76d77a` (squash merge of #126–#137).
- AI Coach V1 lives separately in Draft PR #139, SHA `a470cfd74bd1db712e3b8b73d6a65f4640049110`; Frontend and Server CI report success at this SHA, but **hosted acceptance is blocked**: the QA Render service is on an older branch and its Coach route returns 404. No Vercel Preview for the PR branch was found. Do not describe V1 as production-ready.
- Reuse `server/aiCoachCore.js`, `server/positionIndex.js`, `chess.js`, existing Stockfish Web Worker/WASM/UCI analysis, React/TypeScript UI, Node/Express, Supabase authorization, existing i18n and theme systems. The Stage 2 Stockfish design in `docs/ai-coach-stage2-design.md` (PR #139) is **design only**.
- Support de/en/az/tr/ru and the current Ukrainian stored-language compatibility: the existing app uses `ua`; parts of Coach normalize to `uk`. Do not globally rename a stored language key without an explicit compatible migration.
- Feature flags remain default OFF. All changes are isolated in QA until reviewed; do not access Render accounts or modify environments without separate authorization.

## 3. Target architecture: boundaries, not a second platform

```text
Player's explicit lesson request
  -> existing auth / input and feature gates
  -> chess.js validation of history, FEN, PGN and side to move
  -> position / archive retrieval with opt-out recheck
  -> bounded Stockfish worker evidence + reproducible position features
  -> schema-validated explanation (optional Gemini, evidence IDs only)
  -> server-authoritative lesson facts + client rendering in existing UI
  -> explicit opt-in practice feedback (separate, private)
  -> versioned player profile -> next practice selection

Non-personal, approved and anonymized quality signals
  -> metrics / fixed evaluation corpus -> Alpha change proposal
  -> independent Omega chess/privacy/security/performance review
  -> isolated branch + PR -> CI -> Vercel QA -> owner approval
  -> manual release decision (never an autonomous deploy)
```

Archive searches and engine analysis are **not** interchangeable. The public PositionIndex can collapse transpositions to a normalized four-field position key; Stockfish evidence must also preserve full FEN, move history, relevant draw-rule context and engine version.

## 4. First milestone: finish V1 hosted acceptance, do not expand its scope

**Blocking gate before implementing V2 or memory:**

1. Confirm the isolated QA backend uses the QA Supabase project, **not** production. Confirm reviewed PR #139 SHA, matching frontend Preview SHA and existing QA flags. Do not overwrite the shared QA service or its keys as part of this RFC.
2. Run the already committed read-only `server/scripts/verifyOpeningPrepQa.js` against the reviewed deployed QA build using a short-lived QA-only token supplied securely by the owner; keep provider limits and no token exposure.
3. Independently validate representative legal/illegal lines, transpositions (including different indexed plies), opt-outs, stale request cancellation, fallback when Gemini is unavailable, actual analysis-board handoff, six languages, desktop/mobile, all active themes and real Gemini quality when authorized.
4. Measure warm and cold request latency, errors and resource consumption; establish the baseline and owner QA sign-off. No hosted-pass claim from synthetic Chromium tests alone.

**Exit criterion:** documented evidence with SHA + environment + test type, no blocking regression, and owner acceptance. Existing `main` release readiness/schema reconciliation remains a separate gate.

## 5. Second milestone: engine-grounded teaching (reuse existing Stage 2 RFC)

- Use a bounded server worker or pool for any hosted engine workload, isolated from Express/Socket.IO live chess; never block the event loop. Pin Stockfish + NNUE versions and checksums. MultiPV 3 and depth 18–20 are trial targets only, subordinate to wall-time, CPU, memory and queue limits.
- Validate all UCI principal variations by replay against the correct root/history and convert to SAN server-side. Preserve actual depth/nodes, cp/mate score, perspective, incomplete/bound indicators and uncertainty.
- Derive provable chess features separately from heuristic coaching concepts. Do not promote sampled archive move frequencies or current FIDE ratings into proven best moves or historical rating cohorts.
- Gemini is an optional narrator: pass bounded evidence and allowed variation IDs; schema-validate its output, resolve references against server facts and omit unsupported statements. Fallback gives legal moves and sourced facts without fabricated advice.
- Build a reviewed multilingual corpus with tactical, strategic, quiet, defensive, endgame, transposition, underpromotion, repetition and fifty-move scenarios. Expert scoring for **factual grounding** and **teaching clarity** is separate from API test success.

**Exit criterion:** a previously agreed set of expert-reviewed examples, no invalid PV, privacy regression or unsupported chess claim, measured latency/resource budgets, good fallbacks, and real QA UI acceptance.

## 6. Third milestone: private, consent-based player learning

Implement **only after a separate schema/RLS and privacy proposal**. Minimum conceptual objects:

- `practice_attempt`: user-scoped exercise reference, versioned problem position ID, anonymous outcome category, time bucket and optional explicit feedback. Never store private PGN or raw conversation merely because an API request was made.
- `skill_state`: user-scoped, explainable estimates per versioned skill taxonomy (e.g. tactics, pawn structures, calculation, openings, endings), evidence counts, last practiced time, confidence and algorithm version.
- `lesson_policy_version`: immutable versioned parameters for spacing, difficulty and remediation; never silently rewrite history when a policy changes.

Initial adaptation: deterministic spaced repetition and mastery thresholds, with cold-start defaults and confidence limits. Do not claim the LLM's own weights change. Compare outcomes against a fixed non-personal baseline before enabling any smarter policy.

**Privacy gates:** explicit, revocable opt-in; user authentication and row-level access; data minimization, retention and deletion; export/reset mechanism; access test from two distinct users; no training of third-party foundation models on a user's games without a separate explicit legal/consent basis. Define GDPR roles, lawful basis and deletion/export processes before storing personal learning data. Keep disabled by default.

**Exit criterion:** per-user isolation and deletion/revocation pass actual PostgreSQL tests, a complete versioned session loop works on isolated QA, and measured practice quality does not regress.

## 7. Fourth milestone: safe engineering self-improvement (Alpha → Omega)

Alpha can produce a bounded, reviewable proposal from:
- CI failures, QA bug reports, opt-in anonymized coaching error classes, latency percentiles, cost/worker usage, measured chess explanation mistakes;
- explicit before/after hypothesis and affected modules, with links to evidence.

Omega must be independent of Alpha's answer, with deterministic tests and chess-expert review:
- chess legality/FEN/PGN, engine provenance and perspective, private vs public games, injection resistance, user opt-outs, i18n (6 languages), themes, responsiveness, accessibility;
- error rate, p50/p95, compute cost, worker memory and cancellation; unchanged baselines with reproducible measurements;
- permission/consent, database RLS, migrations, feature flags, API compatibility.

**Promotion rule:** `proposal -> review -> feature branch -> PR -> CI -> isolated Preview -> human approval -> separately authorized release`. Any failed check blocks promotion. No autonomous writing to `main`, release environment, provider key, production database, migration history, deployed prompt, or PR merge. Self-improvement of coaching policy may be automatic **within approved, versioned bounds**, with rollback and documented user-facing effect; changing those bounds requires approval.

## 8. Release-independent observability and acceptance metrics

All metrics must be environment-labeled, consented when user-specific and documented with sample size and methodology.

| Dimension | Metric / acceptance method |
| --- | --- |
| Chess correctness | Invalid SAN/PV/position handoffs = 0 across fixed and randomized replay suites |
| Evidence quality | Expert-reviewed unsupported-claim rate + grounded explanation score for each of six languages |
| Personal learning | Same-skill delayed re-test success; compare against prior policy, report uncertainty |
| Security | Cross-user data access, opt-out leak and unauthorized private-game inclusion = 0 in QA tests |
| Reliability | Recorded p50/p95 for cold/warm separately, timeout/cancel/fallback rates and worker queue limits |
| Compatibility | CI tests plus hosted desktop/mobile/theme/language QA; no game/sockets regressions |
| Operating cost | CPU seconds, memory, LLM tokens and cost per successful lesson; provider-outage fallback |
| Engineering loop | Percent of Alpha proposals rejected by Omega; regression escaped to QA; rollback success |

Do not set numeric marketing targets or performance claims without a measured baseline. No claim of continuously training a foundation model.

## 9. Proposed implementation PR order

- **PR-A (this RFC, documentation only):** current baseline, architecture/constraints, acceptance gates. No runtime changes.
- **PR-B (after V1 hosted sign-off):** engine-evidence contract and pure validation tests, no new UI or DB migration; default OFF. Verify deterministic PV replay, score orientation, timeouts, fallbacks and prompt injection.
- **PR-C:** isolated bounded analysis worker and existing Coach response integration; versioned additive contract; QA-only.
- **PR-D:** explicit private learning data specification, GDPR review and separate isolated Supabase migrations with RLS, consent, revocation, export and delete tests.
- **PR-E:** deterministic personalization policy and accessible UI in the existing six-language i18n/theme architecture; QA opt-in.
- **PR-F:** read-only aggregated quality dashboards and proposal-only Alpha/Omega evaluator; no autonomous code mutations.

Each PR must declare exact branch/base SHA, changed files, test commands/results, the Preview URL if deployed, risks, owner actions and whether the capability is implemented versus planned.

## 10. Non-goals and hard stops

No voice agent, new model fine-tuning, multi-agent production scheduler, generalized autonomous coding, new translation provider, alternate theme manager, duplicate game/position index, production migrations, feature activation, Render changes or live game engine on every move in V1.

**Stop if:** the exact source SHA does not match Preview; QA references production; RLS or opt-out fails; worker memory/time is unbounded; chess legality cannot be validated; explanation source IDs mismatch; CI is failing; or owner approval has not been obtained for a release-impacting action.
