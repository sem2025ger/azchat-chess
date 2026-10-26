# C1: backend error monitoring (not activated)

No DSN or Production service setting is configured by this milestone.
Keep maintenance mode enabled. No merge, deployment, database change or
automatic activation is authorized by this PR.

## Configuration after separate owner approval

- `SENTRY_DSN`: optional Node project DSN. Missing/empty/whitespace:
  the SDK is not required/initialized and no monitoring listeners are added.
- `SENTRY_ENVIRONMENT`: optional lower-case label; invalid values become
  `unspecified`.
- `RENDER_GIT_COMMIT`: optional trusted Render full 40-character SHA; invalid
  values are omitted. No Render environment setting is added or changed.

Initialization follows dotenv loading, before framework imports.
Sentry Node 11.8.0 uses explicit all-disabled `dataCollection` controls; the
requested legacy `sendDefaultPii: false` marker alone is NOT a v11 privacy control.
See `../tmp/SENTRY.md` for the data policy, baseline audit debt and owner rollout
requirements. Runtime policy is local to `server/`; it has no frontend dependency.
`monitoringPrivacy.js` is a CommonJS/types-erased copy of the frontend policy.
The fixture tests exercise both copies with identical adversarial payloads.

## Error paths and preservation of existing behavior

Default SDK integrations are disabled. Only process uncaught exception and
unhandled rejection error integrations are installed when a DSN is configured;
rejections use Node's default strict policy. HTTP/Express/Supabase/console/source
context/local variables/session/performance instrumentation are not enabled.
Runtime module injection and OpenTelemetry setup are explicitly disabled.

A passive four-argument Express error middleware calls capture then forwards
the **same Error** with `next(error)`. It does not write a response, modify status,
headers or body, attach request data, or replace the default final handler.
A WeakSet prevents recapturing the same Error through this observer.
SDK failures are swallowed only inside monitoring; original error reporting and
responses continue. Tests compare default AND custom Express error responses.

At the existing terminal branch of `persistRoomCompletedMatch`, call the reporter
once. The existing single-flight promise guards concurrent/repeated callers and
the retry loop emits no intermediate events. Successful/recovered saves emit no
failure event. Different terminal failures with identical codes remain distinct:
no backend Dedupe or console capture integration is installed.

The SDK receives ONLY:
- fixed error code `MATCH_PERSIST_FAILED`;
- error class `transient` / `permanent` / `unknown`;
- attempt count (bounded to 1..3);
- allowlisted last database/transport error code.

Do not pass the original Error, cause, record, PGN, names, emails, player IDs,
matchId or roomId. matchId has linkability to stored game/player records, so it
is omitted entirely rather than creating a persistent pseudonym. Existing local
logging (including its matchId field), retry schedules, acknowledgements and
return values remain unchanged. No local log is automatically forwarded to Sentry.

The final transport boundary again sanitizes error envelopes and rejects every
other item type. No request payload, auth data, private game or session context is
sent. No Replay, feedback, tracing, sessions, logs, metrics or attachments.
All production environment values remain untouched.

## Verification and limits

`npm test`; production security gate: `npm audit --omit=dev`.
Full backend audit is also checked. No vulnerabilities were found after SDK install.
The package has no backend compiler/build/lint script; Node syntax checks and
the complete existing HTTP/Socket.IO/game/persistence tests validate runtime code.
Tests use only local fake adapters and in-memory Sentry transports. They never
connect to Supabase or Sentry. Existing caught Socket.IO errors that are only
logged locally are not automatically captured. Delivery is best effort; a killed
process/network failure can prevent arrival. Live Sentry ingestion is intentionally
not exercised before owner privacy review and activation.
