# Chessy illustrated strategy lesson — QA only (2026-11-16)

## Product contract

For **“Assess the position and suggest a plan for White / Black”** and comparable explicit plan questions, show exactly:

1. **Assessment and objective (brief):** the objective position evaluation, one concrete plan, its mechanism and intended goal, stated in understandable but professional chess language.
2. **Actual illustration (replayable):** one existing, **server-verified** Stockfish 19 line that really illustrates the explanation, shown with its original legal SAN and white-perspective evaluation. It is selected in Chessy and can be stepped through on the **existing board** using Previous/Next; original FEN is step zero.
3. **Result and defence:** what the selected line actually produces at its **last displayed position**, the measurable positional outcome and a relevant opposing defence or limitation. Do **not** call a strategic objective an already-achieved benefit.

Other Stockfish lines remain available under “Other engine lines”. Existing free chat, archive, recording, copy, speech and expanded reading layout stay available. Copy and read-aloud of an illustrated answer include the selected variation, within the current speech size limit.

## Proof and safety

- The server uses the structured JSON schema `intro + lineId + conclusion` only for explicit plan questions when `Stockfish 19` has independently computed at least one candidate variation for the **exact** FEN. The chosen ID is drawn from the server-provided line IDs (or `none` if no candidate line actually supports the proposed strategic idea). It does not permit fabricated moves or invented material gains.
- The browser only accepts `L1..L3` identifiers that also exist in **FEN-bound and validated** server lines, and treats unknown/invalid/legacy fields as the existing text answer.
- Resulting position facts are server-generated and provided to the model as evidence; they are **not sent** to the browser. Stockfish's numerical evaluation is not a proof of a verbal strategic explanation. Actual human review of output quality is still required.
- Existing candidate line depth/time, engine configuration, database, chessboard implementation and server response contract for unrelated questions remain unchanged.
- The current maximum replay is 10 plies; this may illustrate an intermediate improvement rather than a full long-term plan. If the engine lines do not actually demonstrate a suggested idea, the model must select `none` and say so rather than fabricate a convenient continuation.

## Activation

Two independent feature switches, both **false by default**:

- API QA: `AI_COACH_PLAN_DEMO_ENABLED=true`. Requires an available server Stockfish engine (`AI_COACH_SERVER_ENGINE_ENABLED=true`) for real linked illustrations.
- Vercel Preview: `VITE_CHESSY_PLAN_DEMO_ENABLED=true`. Builds a frontend capable of rendering the new structured lesson; old deployments ignore the optional data and remain backward compatible.

Do not activate these in production without real authenticated QA review, legal/actual-move regression, variation replay check, answer quality samples in all six locales and explicit owner approval. Stacked draft PR #235 targets #234, not `main`.

## Verification

- `server/coachPlanDemo.test.js` covers language triggers, strict structured schema, allowed IDs, impossible choices, opt-in behavior, engine absence and grounded payload identity.
- `tmp/tests/spielerDesign.browser.mjs` includes a **synthetic** illustrated-response regression proving the UI order (idea → chosen line → conclusion), board navigation, copy/listen and alternatives.
- Passing synthetic tests alone does **not** certify grandmaster-quality strategic explanations, that a given real Stockfish line illustrates a plan, real response latency or production-readiness.
