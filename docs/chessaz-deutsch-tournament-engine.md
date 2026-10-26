# ChessAZ Deutsch — Automated tournament runner (QA / disabled by default)

## Deployment gate
This PR provides Swiss pairing, RLS SQL schema, transactional publication, and server integration with the pre-existing durable chess engine. It does NOT activate tournaments in production and does NOT install a scheduler. Server flag `TOURNAMENT_ENGINE_ENABLED=false` is required by default.

## Prerequisites
- Apply existing `20261019215514_durable_active_games.sql` to a disposable QA DB BEFORE applying this tournament migration.
- Review transaction policies, ensure role grants and indexes, run security advisors, and test with separate authenticated clients.
- Set `DURABLE_ACTIVE_GAMES=true` only in QA, with healthy service role access and valid durable store; `TOURNAMENT_ENGINE_ENABLED=true` only after testing.
- A server-side polling loop is not adequate for guaranteed calendar creation on a sleeping or unavailable server. Use a monitored external scheduler or database cron after approval. A repeatable scheduled execution must generate the calendar and drive tournament states.
- Test full 2/3/4/16-player live games, invalid moves, clocks, reconnects, timeouts, concurrent starts, result persistence, restarts and idempotence. Inspect behavior on Android, iOS and desktop. Do not advertise the feature before passing these gates.

## Fail-closed constraints
- No client grants for tournament writes; service-only transition validates membership, status, complete pairs and completed match rows.
- No rating changes, pairing substitutions, result forgery or dynamic result claims from client.
- No volatile matches in a live tournament. Tournament rooms reuse authoritative chess.js validation and durable snapshots.
- A partially created durable room must be reconciled before starting the same room. Publication is immutable.
- Enable gradual release only with manual recovery/runbook and observable metrics.

## Open issue
The implementation is a staged integration for QA, not a demonstrated production end-to-end tournament system. The QA Supabase project currently has no `durable_games` and no real tournament records. Final readiness requires a QA migration and realistic multi-user end-to-end suite before production activation.
