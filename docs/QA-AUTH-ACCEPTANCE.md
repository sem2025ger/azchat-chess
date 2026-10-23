# ChessAZ Deutsch authentication QA

> **Latest QA status (23 October 2026):** Owner-completed Resend SMTP integration is functioning. Registration, email confirmation, password recovery and subsequent sign-in were successfully exercised by the owner. The 30/hour email quota is recorded in QA Auth logs. See the final verification at the end of this document. Earlier "SMTP not configured" paragraphs below are historical and superseded; do not interpret them as current status.

Scope: preview branch based on club dashboard commit 674a23c. No changes to main,
production services, database policies, email confirmation or passwords of existing users.

## Implemented

- Guests can open sign-in directly from the club, with a safe return to /chat on
  desktop and mobile. Existing mobile game return destinations remain supported.
- Google uses Supabase OAuth. Its button is shown only when the public Auth
  settings explicitly report external.google=true. This flag does not prove
  the Google client credentials/consent screen are correct: live OAuth still needs QA.
- Trim pasted email addresses, validate recovery/link input, prevent concurrent
  auth submissions, and apply a 60-second local minimum pause after accepted
  email requests within each form. This pause does not predict server quota reset.
- Reset requests use account-neutral messaging: HTTP 200 does not prove an
  account exists, that a message was dispatched, or that it reached an inbox.
- Email link login cannot silently create another account.
- Password reset waits for a valid session and rejects error callbacks; reset and
  signup callbacks preserve an allowlisted return destination.
- Form labels/autocomplete and status/alert roles support keyboard, password
  managers and assistive technology. No new runtime dependencies.

## Recovery redirect regression (22 October 2026)

QA Auth logs showed recovery verification redirecting to the QA Site URL root instead
of the requested `/update-password` route. The startup recovery callback guard now
normalizes valid implicit recovery fragments from `/`, `/home` or `/profile` to
`/update-password` before rendering; it leaves ordinary sign-in/confirmation links
untouched and forwards expired-link errors to the reset error screen.
A successful password change now ends the local recovery session and sends the user
back to sign-in. This is not a substitute for configuring the exact allowed
`/update-password` redirect URL in the QA Supabase project; keep that as a release
requirement, and verify the actual email click from a clean browser.

## Remaining configuration and release gates

### Recovery follow-up, 23 October 2026

- Confirmed with the actual Supabase JavaScript SDK and a mocked Auth transport:
  a successful implicit recovery consumes the URL and emits PASSWORD_RECOVERY
  once. A React subscriber mounted later sees INITIAL_SESSION, not that earlier
  recovery event. This can leave the former UI unable to unlock the form.
- Register a memory-only observer immediately after createClient, and normalize
  fallback routes before creating that client. React reads only SDK-verified
  recovery proof; a normal signed-in session or URL flag cannot unlock reset.
  Logout, normal sign-in, a different user and successful password update clear it.
- Error callbacks are checked in both query and hash, including error_code without
  an error field. The invalid/expired screen now requests a fresh email directly,
  with account-neutral feedback, validation, an in-flight guard and cooldown.
- QA logs on 22 October at 22:00:08 UTC contain /recover=200 and mail.send;
  /verify subsequently includes both a successful Login and invalid/expired-link
  errors. These logs do not prove the reason for expiry or delivery to every mailbox.
- Public QA settings inspected in this follow-up report email=true,
  mailer_autoconfirm=false, external.google=false. Google login remains unavailable
  until a real Google OAuth client is configured and tested; no credentials were
  fabricated and email confirmation was not disabled.
- Regression coverage includes the real SDK's early event, delayed UI mount,
  ordinary login isolation, expired callbacks, fresh email request destination,
  and rendering the actual password/retry screen. These isolated tests are not
  an end-to-end mailbox test and do not change any real user's password.

1. Google: configure a web OAuth client in Google Cloud and the QA Supabase
   Google provider. Keep the secret in provider settings, never frontend source.
   Callback: https://iukmpcytsuofqhxsumbu.supabase.co/auth/v1/callback .
   Request only openid, email and profile. Verify provider cancellation, first
   login/profile creation and subsequent login with an existing account.
2. Add the exact QA preview /profile and /update-password callback URLs (including
   the safe returnTo query variant) to QA Auth redirect configuration. Prefer
   one stable QA hostname when setup is complete; do not broadly allow arbitrary
   Vercel projects or point QA callbacks at production.
3. Email: inspect QA SMTP configuration and provider delivery logs. Configure a
   verified sender and appropriate DNS at a transactional email provider before
   public release. Do not disable confirmation as a workaround. No paid service
   or new credentials were provisioned by this change.
4. Verify real delivery to a controlled mailbox, signup confirmation, login,
   logout, recovery, password change and login with the new password. Also test
   an unknown email, invalid credentials, expired/used links, request limits,
   offline state, Google cancellation, desktop/mobile and return to club.

## Investigation evidence

QA /recover returned HTTP 200 at 2026-10-22 12:40:07 UTC, not a 429.
The subsequent read of auth.users showed no recovery_sent_at later than
10:56:06 UTC. These observations do not establish the submitted email address
or delivery status; do not conclude that the current email was sent.

Full end-to-end acceptance remains open until the configuration and real
mailbox/OAuth tests above pass. Unit/CI success is not a delivery guarantee.

## Email limit follow-up

- QA Auth logs inspected on 22 October 2026 (the preceding 24 hours) contain
  11 `over_email_send_rate_limit` responses with status 429: /recover=8,
  /signup=2, /otp=1. These are actual sending limits, not wrong-password errors.
- Only the explicit email-send error is labelled as an email limit. Client/IP
  rate limits and unclassified 429 responses have a separate request-limit message.
  The error code alone does not establish whether the active restriction is
  project-wide or per-address, nor the exact reset time.
- Failed requests no longer start an invented 60-second server-limit countdown.
  Successful/accepted email requests retain the local anti-repeat pause, now
  explicitly labelled as a minimum; service restrictions may last longer.
  Confirmed users can still attempt password sign-in while email actions cool down.
  No automatic retry or raw server-detail disclosure is introduced.
- Updated feedback in all six supported languages. Regression coverage distinguishes
  email, IP/client, SMS and generic 429 errors and rejects classification by raw text.
- SMTP configuration is still UNCONFIRMED: the connector has no Auth-config read
  operation, and the QA dashboard redirects this browser to sign-in. No SMTP,
  provider, sender, quota or DNS configuration was changed. A supported authenticated
  management session is required to inspect the actual configuration.
- Supabase documents a 2-email/hour project limit for its built-in sender; custom
  SMTP has its own configured limits. This documentation is not proof that the
  built-in sender is the active QA configuration. Inspect before choosing a remedy.

References: https://supabase.com/docs/guides/auth/rate-limits ,
https://supabase.com/docs/guides/auth/auth-smtp ,
https://supabase.com/docs/guides/auth/debugging/error-codes .

## Resend SMTP implementation handoff (23 October 2026, QA ONLY)

### Verified domain — DNS configured independently by the owner

- Resend domain: `auth.chessaz.de` — screenshot confirms **Verified / ready to send**.
- DNS zone is hosted at IONOS. User created and IONOS acknowledged:
  - `TXT resend._domainkey.auth.chessaz.de`: the full Resend-provided DKIM value
    (not stored in the repository).
  - `MX send.auth.chessaz.de`: `feedback-smtp.eu-west-1.amazonses.com`, priority 10.
  - `TXT send.auth.chessaz.de`: `v=spf1 include:amazonses.com ~all`.
- Existing root-domain MX/SPF, application A/CNAME, nameservers and production
  resources were not intentionally modified by this procedure. The external
  DNS verification is an email-domain milestone, not an SMTP-in-Supabase test.

### Target QA configuration (not yet applied)

Project: **ChessAZ Deutsch QA**, Supabase ref `iukmpcytsuofqhxsumbu`.
DO NOT use `AZTR Chess` (`kmwfvvliundhuovoakoa`) or production.

- Dashboard: `https://supabase.com/dashboard/project/iukmpcytsuofqhxsumbu/auth/smtp`
  (Authentication > Email > SMTP Settings).
- **Enable Custom SMTP** only for QA.
- Sender email: `noreply@auth.chessaz.de`.
- Sender name: `ChessAZ Deutsch QA` (deliberate QA identification).
- SMTP host: `smtp.resend.com`; port `465` (implicit SSL/TLS).
- SMTP username: `resend`.
- SMTP password: a *new, Resend Sending-access API key restricted to
  auth.chessaz.de*, entered directly into Supabase settings by the owner.
  NEVER send a key by chat, put it in source control or Vercel VITE_ variables.
- Keep **Confirm email** enabled; do not loosen user/RLS permissions.
- Under Auth > Rate Limits, configure **Emails sent** to at most
  **30/hour** for QA, subject to account/provider limits; keep the provider
  minimum interval and local form pause distinct. Resend Free currently
  documents 100/day and 3,000/month, so throttle tests to avoid unnecessary sends.
- Verify Site URL and exact Redirect URL allowlist for stable QA Preview
  `https://chessaz-preview-workspace.vercel.app` including
  `/profile` and `/update-password`. Do not whitelist arbitrary
  Preview deployments or point QA URLs at production.

### Acceptance after authenticated SMTP configuration

1. Verify QA Auth settings show the expected sender/host, sender still matches
   the verified domain, and Resend provides a successful delivery event.
2. Create a *new test user* through stable QA Preview in a controlled mailbox:
   confirmation email, link, authenticated profile/club access, logout.
3. Request recovery for this test user: email delivered to mailbox, link opens
   /update-password, reset password, local recovery session ends, login with new
   password succeeds; old password fails.
4. Reused/expired recovery links and unauthenticated attempts must never expose
   the password form. Validate unknown-email feedback, wrong credentials, 
   desktop/mobile and club-return. Do not test with a production user/account.
5. Check Supabase auth logs and Resend Emails dashboard for delivery/errors,
   confirm no rate-limit 429 under a low-volume sequence. CI 79 unit tests and
   Vercel READY are **not** a replacement for this end-to-end test.

### Access limitations

The authenticated Supabase integration currently exposes project/SQL/log/DB
tools, **not** Auth SMTP configuration read/write. No Resend account/API-key
management integration is connected. Therefore these credentials/configuration
cannot be applied or certified from this chat toolset. An authenticated owner
action in the Resend and Supabase dashboards, or a separately authorized
management API client with appropriate scopes, is required. No SMTP change,
rate-limit change, email send, PR merge or production modification was performed
by the model during this handoff.

References:
- https://resend.com/docs/send-with-supabase-smtp
- https://resend.com/docs/send-with-smtp
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/rate-limits
- https://resend.com/pricing

## Final QA verification: 23 October 2026

**Scope:** Supabase `ChessAZ Deutsch QA` (`iukmpcytsuofqhxsumbu`),
Vercel project `chessaz-preview-workspace`, GitHub draft PR #74
(`fix/chessaz-deutsch-auth-flow`). The production Supabase
`AZTR Chess`, production Render, `main`, production site, and
other PRs remain out of scope and unchanged by this verification.

### Confirmed evidence

- The owner entered Resend SMTP credentials directly into the QA Supabase
  dashboard without sharing them in chat. Screenshot showed
  "Successfully updated settings" for sender `noreply@auth.chessaz.de`,
  sender name "ChessAZ Deutsch QA", `smtp.resend.com:465`,
  username `resend`, and a hidden SMTP password. Key value
  **was never recorded** in this repository.
- Resend screenshot shows `auth.chessaz.de` = **Verified**.
  The owner's controlled Gmail testing confirmed delivery of both
  registration confirmation and password recovery messages from the
  custom sender. This is user-reported real-world evidence, not an
  automated Resend API delivery-status inspection.
- QA Auth logs at **2026-10-23 01:02:29 UTC** confirmed a runtime
  change of `GOTRUE_RATE_LIMIT_EMAIL_SENT` **from 2/hour to 30/hour**.
  Do not confuse the 30/hour project allowance with a 60-second
  client-side minimum pause or Resend's separate account quotas.
- Read-only Auth logs during **2026-10-23 01:00–01:28 UTC** show:
  `/signup` HTTP 200 with `user_confirmation_requested`;
  `/verify` HTTP 303 with `user_signedup` at 01:25:08;
  `/recover` HTTP 200 with `user_recovery_requested` at 01:24:58;
  `/logout` HTTP 204; `/token` HTTP 200 with login at 01:25:58.
  The `email_not_confirmed` rejection before confirmation was correctly
  returned, protecting unconfirmed accounts. No auth `429` was seen
  in that **bounded** post-SMTP time window; this is not proof of
  unlimited delivery or absence of all failures.
- Read-only aggregate Auth DB query returned **one** new registration
  since 01:00 UTC and **one** confirmed registration. No user email,
  password, recovery link, access token, or secret was exported.
- The owner explicitly reported finishing registration, password
  recovery, resetting credentials, and signing in successfully.
  This completes the owner's basic manual acceptance test; it
  does not independently establish the handling of used/expired
  links, two devices, accessibility, or high-volume email.
- Vercel Preview `dpl_AFCvsBb3nvUVc8zQHrjt2KHABNET` = READY,
  corresponding to PR head `c382d86ef58bedec55279f6349633921a0552d66`
  before this documentation update.
- GitHub Frontend CI `39880271612` passed at that code head.
  Earlier code regression run covered 79 tests; documentation-only
  changes do not claim new browser E2E tests.

### Security and remaining acceptance gates

- Supabase QA Security Advisor warns **Leaked Password Protection Disabled**
  (`auth_leaked_password_protection`, severity WARN). Consider enabling
  it in QA Authentication password-strength settings if available on
  the current plan; verify behavior before proposing production use:
  https://supabase.com/docs/guides/auth/password-security .
  No change was made to this setting by the assistant.
- QA Security Advisor also reports RLS-enabled tables without policies:
  `public.chat_messages`, `public.chess_club_tournament_templates`,
  `public.matchmaking_queue` (severity INFO). This can mean **intentional
  deny-by-default**; do **not** create permissive policies blindly.
  Confirm intended API access and server-side behavior against
  the product contract before making changes:
  https://supabase.com/docs/guides/database/database-linter .
- Performance Advisor reports two missing covering foreign-key indexes
  (`chess_club_events_created_by_fkey`,
  `chess_club_messages_author_id_fkey`) and nine unused-index notices.
  These are **not** auth release blockers based on available evidence;
  make no ad-hoc database migrations during the auth closeout.
- Google OAuth remains unconfigured/unverified in QA and is correctly
  hidden by the application when `external.google=false`.
  Do not describe Google login as ready.
- Separate fresh-browser end-to-end checks are still needed for
  reused/expired links, explicit account isolation with multiple tabs,
  wrong-password handling, cancellation, mobile layout, and club-return
  navigation; confirm any outstanding QA redirect allowlist entries
  against the actual Supabase dashboard. Keep all confirmation checks
  enabled and do not surface account existence in error messages.
- **Disposition:** QA email/password core journey = **manually accepted
  with supporting logs**; broader authentication security / production
  readiness = **OPEN** pending these explicit gates.
  Keep PR #74 **Draft / unmerged**, and do not change production or
  invoke paid services without owner approval.
