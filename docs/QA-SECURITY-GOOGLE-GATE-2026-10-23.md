# ChessAZ Deutsch QA — Security and Google OAuth gate (2026-10-23)

## Scope and hard boundaries

- **QA only:** Supabase `iukmpcytsuofqhxsumbu` (ChessAZ Deutsch QA);
  Vercel `chessaz-preview-workspace`;
  GitHub draft PR #74, branch `fix/chessaz-deutsch-auth-flow`.
- **Do not modify** production Supabase AZTR Chess, `main`, `chessaz.de`,
  production Render, production DNS, active users' passwords, or unrelated PRs.
- No billing upgrade, OAuth credential fabrication, permissive RLS policy, user
  creation, outbound email, or production deployment is authorized by this record.
- Evidence below uses authenticated read-only Supabase advisors/SQL, Vercel
  deployment metadata, GitHub CI, prior screenshot-verified Resend setup,
  and repository code inspection. The user separately accepted live QA
  registration, confirmation, recovery, and sign-in.

## Security findings and decisions

### SEC-01: Compromised-password screening

- QA Supabase Security Advisor: **WARN: Leaked Password Protection Disabled**
  (`auth_leaked_password_protection`).
- Supabase officially documents HaveIBeenPwned screening as available on
  **Supabase Pro plan and above**. The QA project's observed organization
  tier is Free; no cost-bearing upgrade is to be initiated implicitly.
- **Disposition: feature gated by tier, not repaired.** Keep this release
  consideration **OPEN**. Until resolved, use existing Supabase password
  confirmation, strength checks, rate limiting and secure recovery; do not
  claim that the application detects breached passwords.
- If owner later approves Pro and confirms billing scope, enable only on QA
  in Authentication > Sign In / Providers > Email password security, verify
  that known-compromised passwords are rejected in a controlled non-production
  test without sharing test passwords, then re-run Security Advisor.
- Reference: https://supabase.com/docs/guides/auth/password-security

### SEC-02/03/04: RLS enabled without policies on three tables

Affected tables:
`public.chat_messages`, `public.chess_club_tournament_templates`,
`public.matchmaking_queue`.

- Supabase Security Advisor marks these as **INFO**, not RLS-disabled tables.
- Direct read-only QA database inspection confirmed each table has RLS
  **enabled**, **zero policies**, and **zero direct grants to `anon` or
  `authenticated` roles**.
- Browser access is thus **default denied** under the inspected policy/grant
  configuration. This is not proof that every server-side path is correct,
  but is not a demonstrated public data exposure.
- **Disposition: ACCEPT AS RESTRICTIVE DEFAULT / NOT A SECURITY BLOCKER.**
  Never introduce permissive SELECT/INSERT/UPDATE/DELETE policies simply to
  silence the linter. Any future need for browser access must be designed
  separately from the data ownership contract and tested against hostile
  cross-account access.
- Reference: https://supabase.com/docs/guides/database/database-linter

### SEC-05: Performance notices

- Two foreign-key covering-index notices in
  `chess_club_events.created_by` and `chess_club_messages.author_id`.
- Nine "unused index" informational findings in a young QA database.
- No authentication failure / data leak follows from these notices.
  Record for workload-based optimization; do not drop indexes or run schema
  migrations as part of the authentication release gate.

### SEC-06: Email safeguards verified

- The owner configured custom SMTP in Supabase QA via Resend; the verified
  sender is `noreply@auth.chessaz.de`. Secrets were never put in GitHub,
  chat, or `VITE_*` browser variables.
- QA auth logs verify email project rate limit rose from 2/hour to
  30/hour at 2026-10-23 01:02:29 UTC.
- User-observed SMTP delivery, confirmed signup, successful recovery,
  password-based login/logout are recorded separately in
  `docs/QA-AUTH-ACCEPTANCE.md`.
- Failed pre-confirmation sign-ins produced `email_not_confirmed`;
  confirmation was not bypassed.

## Google OAuth: technical readiness vs provider activation

### Verified from repository and connected services

- PR #74 uses `supabase.auth.signInWithOAuth({provider: 'google'})`
  and sends the return to the current origin's **allowlisted** `/profile`
  route via `authRedirect()`.
- `googleProviderEnabled()` reads Supabase's **public** Auth settings
  and displays Google sign-in **only if** `external.google === true`.
  It fails closed for false, unexpected values, HTTP failures, and offline
  errors. This behavior is covered by existing unit tests.
- The last public QA settings review in PR #74 showed
  `external.google=false`. The Supabase connector here has no
  Auth-provider-config read/write operation, so its latest dashboard
  toggle state cannot be independently asserted in this report.
- Auth database aggregate on 2026-10-23 found **email: 3** identities
  and **no Google identities** in QA. This does not by itself prove that
  the provider is disabled, but proves **no completed Google signup/login
  identity** can be cited as evidence.
- Vercel Preview environment variable *names* are limited to the existing
  public Supabase URL/key and server URL; no Google Client Secret is
  exposed as a browser-side `VITE_*` variable.
- **Status: GOOGLE OAUTH LIVE FLOW NOT TESTED / NOT ACTIVATED.** Keep
  the conditional button hidden. Do not claim success or enable a dummy
  client.

### Exact owner-side credential setup necessary before live test

1. In Google Cloud's **Google Auth Platform** prepare a dedicated
   `ChessAZ Deutsch QA` OAuth app/project (do not reuse production credentials
   without a documented separation and explicit permission).
2. Set branding and audience. If Google app is in Testing, add designated
   test Google accounts; request only standard `openid`, `email`,
   `profile` scopes. Avoid Drive, Gmail or any sensitive scopes.
3. Create a **Web application** OAuth client. Authorize this callback,
   **exactly**:
   `https://iukmpcytsuofqhxsumbu.supabase.co/auth/v1/callback`.
   QA website origin: `https://chessaz-preview-workspace.vercel.app`.
   Never use `chessaz.de` or the production Supabase callback for this test.
4. In Supabase **ChessAZ Deutsch QA → Authentication → Sign In / Providers
   → Google**, enter the OAuth Client ID and Client Secret directly in
   the dashboard, enable and save. Do **not** send the secret in chat,
   commit it, or place it in Vercel public environment variables.
5. In QA Authentication → URL Configuration ensure the stable Preview
   origin and the **exact** intended callback/redirect paths are approved,
   notably `/profile` (and `/update-password` for email recovery).
   Avoid wildcards permitting arbitrary hosts.
6. Only after a valid provider is configured, verify its public
   `external.google === true` flag, UI visibility, consent-screen owner,
   redirected callback origin, profile creation, and subsequent sign-in.

### Live Google acceptance matrix (not yet passed)

- New Google test identity: first successful OAuth returns to QA
  `/profile`, creates one account/profile, and does not touch production.
- Existing Google test identity: repeat login returns to the same identity,
  no duplicate account.
- Cancel/deny Google consent, malformed callback, wrong audience,
  and unavailable provider: no login, no unsafe redirect, no leaked
  token/secret in URL logs or UI, understandable neutral error feedback.
- Desktop and mobile: return-to-club navigation and session lifecycle
  work correctly; explicit sign-out prevents residual session reuse.
- Existing password/email address linking: test with dedicated accounts
  and inspect Supabase identities before treating automatic linking as safe.
- Confirm that public App never advertises Google when provider is disabled.
- Leave Google feature OFF and gate OPEN if any row fails.

Google docs: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

## Build and isolation evidence

- Verified code head before this audit:
  `35b308eb41539d001466bf4d6acc3d3813ebbc43`;
  GitHub Frontend CI `39885875375` **SUCCESS**.
- Matching Vercel Preview deployment
  `dpl_958baqBHgxNNBbDG7hBHSKSoEu6Z` **READY**.
- Project `ChessAZ Deutsch QA` **ACTIVE_HEALTHY**.
- No migration, changed Auth setting, Google credential, paid
  subscription, production action, or PR merge was initiated by this audit.

## Disposition and change-control gates

**SECURITY TRIAGE COMPLETE for this QA auth pass:**
three RLS informational findings are restrictive deny-by-default;
performance notices deferred; leaked-password prevention is a
**Pro-tier-only pending improvement**. Core email/password workflow
passed the owner's manual trial and is supported by Auth logs.

**GOOGLE ACTIVATION = BLOCKED on third-party credentials and
authenticated provider settings; live Google E2E NOT PASSED.**
No rollout/production promotion is approved or scheduled.

After the owner-side Google setup, repeat the exact acceptance matrix,
rerun QA Security Advisor and CI, verify Vercel deployment/route and
account isolation, then prepare a separate owner-reviewed
deployment plan. The Google dependency and leaked-password tier gate
must not be hidden by a generic "all green" status.
