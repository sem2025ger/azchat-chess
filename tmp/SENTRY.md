# C1: frontend error monitoring (disabled until owner approval)

No DSN is configured by this change. Keep Production maintenance mode enabled.
Do not merge/deploy/activate this feature without separate owner approval.

## Configuration after privacy review

- `VITE_SENTRY_DSN`: optional frontend project DSN. Absent/empty/whitespace:
  no SDK loading, no initialization, no root error hooks, no monitoring traffic.
- `VITE_SENTRY_ENVIRONMENT`: optional lower-case environment label; invalid
  labels become `unspecified`.
- `VITE_SENTRY_RELEASE_SHA`: optional full 40-character Git SHA, supplied only
  from a trusted build environment. Invalid/missing values are omitted.
  This milestone does not add a Vercel variable or modify build configuration.

A frontend DSN is a public ingestion identifier, never an auth/service-role key.
Do not configure it until the owner has reviewed the Sentry organization,
project/region, DPA, legal basis, retention and applicable international transfers.

## Collection and privacy boundary

Sentry React 11.8.0 supports React 19. The normal no-DSN rendering path stays
synchronous. With a DSN, initialization completes before rendering; optional SDK
load/init failures fall back to rendering. React caught, uncaught and recoverable
errors retain local reporting even if capture fails. Global browser errors and
unhandled rejections are observed. Default integrations are disabled; only
GlobalHandlers and Dedupe are explicitly installed.

SDK 11 removed the legacy `sendDefaultPii` setting and introduced more permissive
defaults. The requested `sendDefaultPii: false` is retained as a legacy opt-out
marker; the **effective v11 enforcement** is explicit `dataCollection`: no user
info, cookies, HTTP headers/bodies, URL query params, GraphQL documents/variables,
AI inputs/outputs, database payloads, queue arguments, stack variables or source
context lines. Tests verify the actual resolved SDK configuration.

No Replay, Feedback, Profiler, session tracking, console/DOM/network breadcrumb
collection or performance integrations are installed. Replay sample rates and
trace sample rate are zero; no propagation targets. Log/metric/transaction hooks
drop their payloads. A final transport allowlist drops **every non-error envelope
item**, including attachments, sessions, replay, feedback, spans and client reports.

Both `beforeSend` and `beforeBreadcrumb` project a small allowed schema.
The transport reapplies the boundary after SDK envelope construction:
- Keep known error classes, line/column and safe static filenames, severity,
  timestamp, random Sentry event ID, validated release/environment.
- Replace arbitrary error messages entirely: messages can contain names, PGN,
  chat, JWTs or opaque tokens that cannot safely be recognized with regex alone.
- Omit user, tags, arbitrary extra/contexts, request headers/cookies/body,
  error causes/mechanism data, function names, source text and frame locals.
- Strip URL credentials, query and fragment; redact private/unknown paths and
  external hosts (including Supabase project hosts). Team preview hostnames are
  canonicalized, removing branch/deployment identifiers.
- Discard console/DOM/navigation/application breadcrumbs. Only manually added
  HTTP breadcrumbs may retain safe URL/method/status/time.

Sanitization is bounded, non-mutating and fails closed on unexpected getters.
Raw player/match IDs are not used as tags, fingerprints or pseudonyms.
The independently deployable backend has a types-erased copy of this boundary;
both packages run the same adversarial fixtures. Keep copies aligned.

## Verification and limits

`npm test`, `npx tsc -b`, `npm run build`, `npm run lint`.
Owner-approved production gate: `npm audit --omit=dev --audit-level=high`.
Full audit remains separately documented technical debt; do not suppress it.

Tests use fake DSNs ending in `.invalid` and in-memory transports, never Sentry's
network. No live organization, dashboard ingestion or source-map upload is tested.
No source-map/auth-token/build plugin is added. Redacted messages/contexts reduce
diagnostic detail; minified file/line data remains. Dropped sessions mean no
crash-free user/session metrics. Monitoring delivery is best effort.

When activated later, network transport necessarily exposes source IP/network
metadata to the receiving infrastructure even though event user/IP fields are
removed. The owner must review IP storage/server-side scrubbing, hosting region,
retention and legal basis. This implementation is not a claim of anonymity or
automatic GDPR compliance.

## Existing dependency debt at C1 base

Full frontend audit: 18 affected package findings: 12 high, 5 moderate, 1 low.
High: brace-expansion, braces, browserslist, chokidar, fast-glob, js-yaml,
micromatch, nanoid, postcss, source-map-js, tailwindcss, vite.
Other dev findings: @babel/core (low), @humanfs/node,
baseline-browser-mapping, postcss-selector-parser (moderate).
Production findings: react-router and react-router-dom (2 moderate).
No pre-existing lock entry is changed and Sentry introduces no new findings.
Vite/PostCSS/Tailwind and other unrelated dependencies remain untouched.

## C1 local verification record

Base: `0a686348d7298f038e902a579afb72eecbd7509b`.
All 34 frontend tests and all 71 backend tests pass. TypeScript/project build
passes. Lint: 0 errors, 50 existing warnings; no warnings in C1 files.
Backend has no separate build/lint task; Node syntax checks pass.

A fresh full audit of the base lockfile was compared to the candidate by package,
severity and advisory source IDs: findings are identical. Frontend production
gate exits 0 (two existing moderate Router findings); full audit exits 1 with
18 existing findings. Backend full and production audits both exit 0 with zero
findings. No audit failure is suppressed and no unrelated package is upgraded.

Gzip measured using Node zlib.gzipSync with default settings, summing individual
emitted JS/CSS files. Base source was rebuilt from git archive with the same
installed base dependency versions. These values replace the earlier preliminary
measurement taken with an older local node_modules state.

| Measurement (bytes gzip) | Base | C1 | Delta |
| --- | ---: | ---: | ---: |
| All emitted JS + CSS | 273450 | 307360 | +33910 |
| Entry JS | 112734 | 112906 | +172 |
| Assets referenced by initial HTML (JS + CSS) | 190035 | 190428 | +393 |

Sentry wrapper + SDK chunks: 33323 bytes gzip combined. They are lazy, absent
from HTML preload links, and not imported without a DSN. The SDK adapter exports
only the error APIs, leaving Replay/Feedback/Profiler APIs out of the lazy entry.
Measurements use a normal local production build with no DSN, not the separately
configured live maintenance build. No real Sentry DSN was used.

## Draft privacy notice (German; for owner review, not publication)

Sentry ist derzeit nicht aktiviert. Nach gesonderter Freigabe möchten wir Sentry
zur Erkennung technischer Fehler einsetzen. Vorgesehen sind bereinigte
Fehlerdaten ohne Zugangsdaten, Nutzerkennungen, Chats oder private Partieinhalte.
Replay, Performance-Tracing und Feedback bleiben deaktiviert. Beim
Verbindungsaufbau können Netzwerkdaten einschließlich der IP-Adresse anfallen.
Anbieter, Rechtsgrundlage, Region, Löschfrist, Betroffenenrechte/Kontakt und
gegebenenfalls Drittlandgarantien werden vor Aktivierung konkret ergänzt.

Russian translation: Sentry сейчас не активирован. После отдельного разрешения
планируется использовать Sentry для обнаружения технических ошибок. Предусмотрены
очищенные данные ошибок без учётных данных, идентификаторов пользователей, чатов
и содержимого приватных партий. Replay, performance tracing и feedback останутся
выключенными. При установлении соединения могут обрабатываться сетевые данные,
включая IP-адрес. До активации будут конкретно указаны поставщик, правовое
основание, регион, срок удаления, права субъектов/контакт и при необходимости
гарантии трансграничной передачи.

References for the owner's review:
- https://sentry.io/trust/
- https://eur-lex.europa.eu/eli/reg/2016/679/oj
