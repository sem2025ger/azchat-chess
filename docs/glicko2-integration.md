# Glicko-2 — calculation core and integration gate

`server/glicko2.js` implements pure Glicko-2 rating-period calculations using Mark Glickman's revised Illinois procedure: https://glicko.net/glicko/glicko2.pdf.

The calculation core is implemented and tested. Platform rating is **not active**: no game handler imports this module, no rating field is written, and no migration or feature flag is introduced here. Private/invite games and Schach-Treff challenges stay unrated. The paper's suggested initial values are exported as mathematical defaults, not applied to existing profiles or displayed to users.

Before wiring live ratings:

1. Establish explicit, server-owned rated-game eligibility and distinct bullet/blitz/rapid pools. Never infer that all completed historical games were rated, and never backfill placeholder profile ratings as genuine Glicko states.
2. Persist rating, deviation, volatility, game count, version and period per player/pool in server-write-only storage. Use immutable pre-period snapshots for both players.
3. Record every counted match in a unique ledger. Apply both players and the ledger atomically; a result retry/reconnect or duplicate completion must have no second effect. Lock accounts in stable identity order and validate their expected versions.
4. Calculate only from a verified server-completed match; browser clients cannot submit scores, rated flags or new rating values. Keep RLS enabled, revoke browser writes, and verify RPC grants on QA.
5. Test concurrent results, double delivery, process death after commit, pool isolation, cancelled/abandoned games, inactivity and rollback. Run a full QA game through UI → server → completed match → atomic rating update → UI.
6. Migrations, production activation and changes to game metadata require their own reviewed implementation/rollout. This core alone is not evidence of end-to-end rating readiness.

Period length, initial/provisional-display policy and inactivity schedule are product parameters. `ratePeriod` supports simultaneous period results; a caller must define and persist the period rather than silently treating every game as a new period. The core throws on invalid/non-finite inputs or non-convergence and never mutates inputs.
