# Schach-Treff phase 4 — implementation and QA gate

The branch implements unrated challenges from the composer, under messages and from player cards. It includes a server-only atomic challenge RPC, member-only reads, target validation, a serialized three-open-offer limit, ten-minute expiry, cancellation and a narrow last-games summary. Missing-schema controls hide with one warning; other errors render as errors.

The two private-game handlers were extracted with byte-identical bodies. New wiring calls those same functions; no second engine, time-control allowlist change, clock or durable-game logic was added. Existing private-game/server tests pass locally.

Local verification: production build and 134 frontend tests pass; lint 0 errors/57 existing warnings. The legacy mobile community and navigation tests are unchanged. Server tests include fake concurrency/offline/failure cases. The new isolated PostgreSQL test checks real concurrent acceptance, target-only membership, expiry, serialized limits, forged message denial and RPC/RLS grants; it must run without skips in CI before QA application.

Status: implementation prepared; not production-ready or merged. QA migration, real hosted server-to-Supabase integration and desktop screenshot coverage still need verification. No new migration in this branch has been applied. No production database/hosting changes.

Phases 5–7 (private club rooms, nearby players and position of the week) are not implemented in this commit. Live Glicko-2 integration remains a separate milestone; all of these challenges stay unrated.
