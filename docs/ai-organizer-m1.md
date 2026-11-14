# AI Organizer M1 — conversation creates a draft, never a tournament

**Environment:** isolated M3 QA, feature flags OFF by default. No production enablement.

## Data flow and boundaries

1. A signed-in organizer types or records a message in the M3 tournament area.
2. The existing JWT verifier authenticates the request. The Supabase service client checks `public.team_tournament_organizers` for the actor on **every route**.
3. `POST /api/ai-organizer/plan` receives at most 12 bounded conversation turns (1000 characters each), optionally explicitly corrected draft fields, and the UI language `de/en/az/tr/ua/ru`.
4. The service sends Gemini the organizer's message and prior conversation, the current Berlin-local time, corrected fields, and **at most five** of their previous M3 events: event name, boards, min/max teams and Berlin-local start time. The database IDs needed for the lookup stay on the server. No emails, names of players, user IDs, invitations or roster information are sent.
5. Gemini returns a JSON proposal. The Node server validates all fields independently, including strict Berlin wall times and DST, range checks, defaults and the registration deadline. Invalid fields are dropped; missing fields prompt one question.
6. The organizer reviews/edits fields in a chat bubble. The **Use this draft** button fills the existing M3 form. The **Create tournament** button in the chat bubble also fills that form and invokes the **same form submit handler**—the existing `POST /api/team-tournaments/self-service` is the only creation route. No Gemini tool/function calls or database writes are possible in the AI module.

A shared browser recorder is used for both AI Coach and AI Organizer. The optional `POST /api/ai-organizer/transcribe` delegates to `aiCoachOpenAI.transcribeAudio`, with its 2 MiB audio cap. It shows live microphone levels without retaining audio and releases tracks on stop/cancel/unmount. If OpenAI transcription is not configured, the microphone hides after a first attempted transcription; text remains available.

The assistant's reply is progressively revealed on the client after the validated server response (visual presentation, **not** network token streaming). The AI does not create a tournament without a direct user click.

## Flags and environment

Render **`chessaz-m3-qa-api`** (QA only):
- `TEAM_TOURNAMENTS_ENABLED=true` and `TEAM_TOURNAMENTS_M3_ENABLED=true` are existing dependencies.
- `AI_ORGANIZER_ENABLED=true` opts in to mounting the new route.
- `GEMINI_API_KEY` required for planning; existing `GEMINI_MODEL` optional (defaults to `gemini-2.5-flash`).
- `OPENAI_API_KEY` optional for voice transcription.
- Existing `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` are required to enforce organizer allowlist and read past tournaments.

Vercel **branch-scoped M3 QA Preview** (not production):
- Existing `VITE_TEAM_TOURNAMENTS_ENABLED=true` and `VITE_TEAM_TOURNAMENTS_M3_ENABLED=true`.
- `VITE_AI_ORGANIZER_ENABLED=true` opts in to displaying the chat.

Open creation pilot (QA only, **OFF when absent**): `TEAM_TOURNAMENTS_OPEN_CREATE=true` on the Render QA service lets any signed-in member (not only `team_tournament_organizers`) create M3 events through `public.team_tournament_m3_create_open` (migration `20261111030000_team_tournaments_open_create.sql`): at most **2 unfinished events** per creator, enforced in SQL under an advisory lock. Such members get **5 AI planning and 5 transcription requests per rolling 24 h** (in-process counters; reset on service restart). Allowlisted organizers keep the original unlimited path. `GET /api/ai-organizer/status` returns only booleans (`planning`, `voice`, `storage`, `open_create`); HTTP 404 there means the AI route is not mounted on the running branch.

All Organizer flags are **OFF when absent**. The public site and existing endpoints must remain unaffected. No migrations or new dependencies.

## Six-step manual owner QA (QA only)

1. With Organizer flags OFF, verify no AI Organizer card appears and `POST /api/ai-organizer/plan` is HTTP 404. Existing M3 creation remains unchanged.
2. Enable the two organizer flags **in QA only** with the existing M3 flags. Sign in as an allowlisted organizer and a non-organizer; confirm visibility only for the organizer and HTTP 403 for the non-organizer.
3. Enter “Mannschaftsturnier am Samstag um 10, vier Bretter, bis sechs Mannschaften”. Confirm the Berlin-local date, 4 boards, max 6 teams, one-hour-before deadline and gradual response appearance.
4. Use a phrase without a start time. Confirm one follow-up question and highlighted missing fields; answer via text, then edit all six fields directly and use **Use this draft**. Confirm values copy to the unchanged M3 form.
5. Record a short voice request; verify the microphone-level waveform reacts to sound, stop triggers transcription, voice text is editable before sending, and tracks are released on close. If the transcription provider is missing, verify text-only fallback. Ask for a tournament “like last time” and verify permitted settings from that organizer's own recent event.
6. Press **Create tournament** inside the draft bubble once; verify exactly one call to `/api/team-tournaments/self-service` and one new QA event. Check that simply receiving an AI draft creates nothing. Verify Chrome/Safari mobile and desktop, switching DE/EN/AZ/TR/UA/RU, dark theme, keyboard and screen reader. Remove the QA event only with explicit owner permission.

## Security, QA, privacy and release

- No migrations, production deployments, production key changes or merges are part of M1.
- Planner and transcribe routes both require valid JWT and a current organizer allowlist entry. Planning: 30 requests per user per 10 minutes, maximum 16 concurrent plan calls, 20 s server timeout. The raw provider error body is never returned.
- Gemini names and user-entered text are untrusted data. Errors must not log or disclose text, personal IDs or secrets.
- This is an AI-assisted draft, not a scheduling guarantee. Existing server validation and the SQL creation transaction remain authoritative.
- **Before production enablement**, the site owner must update the **Datenschutzerklärung** (privacy policy) to disclose Gemini processing, assess the legal basis and provider data handling, and separately approve deployment.
- Browser/M3/voice regression and live QA must pass before the milestone is marked accepted.
