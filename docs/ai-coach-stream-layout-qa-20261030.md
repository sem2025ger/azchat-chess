# Coach speech streaming and Players layout — isolated QA, 2026-10-30

## Findings and changes

The owner reported read-aloud failing after a long Russian answer and confusing scroll/expanded-section behaviour. The previous adapter buffered the entire answer, capped output at 2 MiB of 24 kHz mono PCM (about 44 seconds), used 2,048 output tokens and a 25-second total deadline. This is a reproducible limit in the code; the precise upstream reason for the photographed hosted failure was not available in existing logs. Do not treat the diagnosis as an independently reproduced real-provider failure.

- The existing authenticated `/speech` route now negotiates progressive NDJSON audio when requested. Older clients still receive WAV. PCM reaches Web Audio before generation finishes; a verified complete WAV remains available for native controls/replay. Autoplay-blocked browsers retain manual controls. Stop, context change, navigation and disconnect cancel/release the operation.
- Output is bounded to 6 MiB PCM (about 131 seconds), 90 seconds total generation, 20 seconds without an event, 4,000 provider events and 256 KiB per provider frame. The provider-supported `max_output_tokens: "inf"` removes the earlier artificial token cut-off while these application caps remain finite. Microphone upload limits, auth, verified-account budgets, concurrency and default-OFF flags are unchanged.
- The client validates frame size, byte totals, sample format and explicit completion. Truncated/incomplete audio is never marked ready or cached. Up to two completed WAVs are cached in component memory only; replay avoids a second provider request. No audio, credentials or new personal data are persisted.
- Audio errors have localized speech-specific messages, preserving the answer and game links. Minimal server diagnostics record only an allowlisted reason code, with no prompt, audio, bearer token or raw provider error.
- Public archive game links are grouped under an accessible disclosure. Preparation results have their own collapsible summary. Expanded state remains account/tab scoped. Long names wrap; history has a bounded readable viewport; composer/audio/status sit below history in normal layout flow.
- Players wheel routing lets a scrollable descendant consume movement before scrolling the page. At a history edge, scrolling continues into the page. Expanded preparation, chat, filters and results remain in normal flow.
- Model evidence now includes the verified public PGN's next six SAN half-moves at the exact indexed ply. Instructions avoid falsely claiming supplied records are missing and avoid repeating every player's name/date/result unless requested. This does not add engine analysis or establish super-grandmaster accuracy.

No model, voice, dependency, architecture, board size, piece art, engine, authentication, database schema or production configuration was replaced.

## Verification

- TypeScript project build, production build and lint pass (0 errors / 62 existing warnings); changed TypeScript/TSX files lint without warnings.
- Full local server suite: 257 total, 243 pass, 14 PostgreSQL-dependent skips, 0 failures. New tests cover long audio, byte caps, progressive delivery before completion, disconnect cleanup, idle/total deadlines, explicit completion/error framing and verified archive continuations. CI supplies isolated PostgreSQL for the skipped database scenarios.
- Full local frontend suite: 191 total, 190 pass, 1 failure in the unchanged D-Bus wrapper (`Failed to open socket: Operation not permitted`). The underlying global-position browser check is also run directly; CI's Ubuntu D-Bus environment is the release gate.
- Coach integration uses real Express HTTP, a loopback Realtime WebSocket, browser Web Audio/native WAV and Chromium MediaRecorder with a fake microphone. It covers first playback before provider completion, cached replay without another request, isolated speech failure while answers remain, cancellation, six locales, auth, account/token lifecycle and Analysis round-trip restoration. Provider content is explicitly synthetic.
- Real Players/Layout browser checks exercise preparation, long chat answers, long game names, archive disclosure and filters together at 1280×720, 1280×900 and 390×844. Geometry asserts no overlap or horizontal overflow; actual wheel input verifies inner-scroll priority and page chaining. Six-language initial layout checks remain intact.
- Opening preparation browser checks cover six languages, exact transposed analysis ply, back/forward/legal continuation, return restoration and independent sweeps of 15 interface palettes, 10 board themes and four piece sets. The test explicitly targets the continuation-group disclosure after adding the new outer result disclosure.

## Hosted acceptance and boundaries

Update only the existing isolated QA frontend/backend to the same green commit. Keep PR #154 Draft; do not merge or deploy production. No env-var changes, key retrieval, new credentials, account connections or migrations are needed.

The runner has no securely available QA bearer token or provider key. Automated voice checks are synthetic and do not prove real OpenAI entitlement, speech fidelity, network latency or a physical microphone. The owner should listen to one short answer and the long answer from the photos on the updated QA, then test stop/replay and Analysis → Players return. Native-speaker notation and chess-expert teaching review remain necessary. New safe failure reasons make any residual provider issue diagnosable without sharing the key.

Official API references checked for the streaming PCM format/event and supported output-token limit:

- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.openai.com/api/reference/resources/realtime/client-events

This report records local source validation. Exact remote CI and isolated deployment IDs are recorded in PR #154 after publication.
