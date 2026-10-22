# ChessAZ Deutsch authentication QA

Scope: preview branch based on club dashboard commit 674a23c. No changes to main,
production services, database policies, email confirmation or passwords of existing users.

## Implemented

- Guests can open sign-in directly from the club, with a safe return to /chat on
  desktop and mobile. Existing mobile game return destinations remain supported.
- Google uses Supabase OAuth. Its button is shown only when the public Auth
  settings explicitly report external.google=true. This flag does not prove
  the Google client credentials/consent screen are correct: live OAuth still needs QA.
- Trim pasted email addresses, validate recovery/link input, prevent concurrent
  auth submissions, and share a 60-second cooldown across email actions.
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
