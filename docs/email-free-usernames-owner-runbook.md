# ChessAZ — standalone email-free username privacy fix

Status: **review-only PR; do not merge or apply to production until the owner explicitly authorizes each operation.** Base: `main` (`4af51e5`). PR #112 must depend on this fix.

## Review evidence
- Independent local PostgreSQL review by owner: chosen nicknames (even ones matching email local part), case-insensitive numbered collisions, anonymous/reserved `spieler_N`, signup trigger, denied access to private rollback log.
- GitHub isolated PostgreSQL tests verify the migration with disposable local Postgres. Never run CI tests against Supabase.
- Production read-only preflight as of 2026-10-25: **7** legacy profiles, **0** cases requiring `spieler_N`, **0** expected collision suffixes.
- Owner waived repeat QA reset; **do not change QA to restore the previous data**.
- No production changes made.

## Production procedure (OWNER ONLY, after separate approval)
The correct target is Supabase **AZTR Chess**, project ref `kmwfvvliundhuovoakoa`. The QA ref `iukmpcytsuofqhxsumbu` must never be mistaken for production.

Preconditions: Supabase Free has no automatic backups. The rollback source is private.username_backfill_log, written in the same transaction as the backfill, together with docs/email-free-usernames-revert.sql. Verify the exact production connection host/port from the Supabase dashboard, the TLS root CA file, and the existing DPAPI-stored Postgres credential identified on the **owner's Windows computer**. Do **not** paste passwords, decrypted DPAPI data, connection strings, usernames, or full logs into chat or GitHub. We know of a QA credential under `%LOCALAPPDATA%\\ChessAZ-QA`; it is **NOT** proof of a production credential. Do not reuse it for production.

In Windows PowerShell, the owner should configure the following variables **locally** using the verified existing production environment (the values below are placeholders, not discovered secrets). Import the existing DPAPI credential with `Import-Clixml` *only if it is an existing CLIXML `PSCredential` created under the same Windows account.* Otherwise use the established secure local credential workflow; do not generate or store new secrets in the repository.

```powershell
# OWNER: replace all placeholders locally only after verifying the Supabase target.
$credentialPath = '<EXISTING_PRODUCTION_DPAPI_CREDENTIAL_CLIXML_PATH>'
$pgHost = '<VERIFIED_PRODUCTION_DATABASE_HOST>'
$pgPort = '<VERIFIED_DATABASE_PORT>'
$pgDatabase = 'postgres'
$caPath = '<VERIFIED_POSTGRES_CA_PEM_PATH>'
$cred = Import-Clixml -LiteralPath $credentialPath
if ($cred -isnot [pscredential]) { throw 'Expected existing DPAPI-protected PSCredential' }
# Fail closed: the host, username AND port must identify the production
# database in exactly one of the approved connection modes.
# The QA project ref must not occur in either host or database username.
if ($pgHost -match 'iukmpcytsuofqhxsumbu' -or
    $cred.UserName -match 'iukmpcytsuofqhxsumbu') {
  throw 'QA project identified: never apply the production migration to QA'
}
$directHost = $pgHost -cmatch '^db\.kmwfvvliundhuovoakoa\.supabase\.co$'
$sessionHost = $pgHost -cmatch '^aws-[0-9]+-eu-west-1\.pooler\.supabase\.com$'
$directUser = $cred.UserName -ceq 'postgres'
$sessionUser = $cred.UserName -ceq 'postgres.kmwfvvliundhuovoakoa'
$portVerified = ([string]$pgPort) -ceq '5432'
if (-not ($portVerified -and (
    ($directHost -and $directUser) -or
    ($sessionHost -and $sessionUser)
  ))) {
  throw 'Unverified production target (host, user or port): stop'
}
if (-not (Test-Path -LiteralPath $caPath)) { throw 'Missing trusted CA: stop' }
$env:PGPASSWORD = $cred.GetNetworkCredential().Password
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = $caPath
try {
  $file = Resolve-Path '.\\supabase\\migrations\\20261025164000_schach_treff_private_usernames.sql'
  # UTF-8 no BOM. The migration has its own BEGIN and COMMIT.
  $temp = Join-Path $env:TEMP ('chessaz-privacy-' + [guid]::NewGuid().ToString('N') + '.sql')
  [System.IO.File]::WriteAllText($temp, [System.IO.File]::ReadAllText($file), [System.Text.UTF8Encoding]::new($false))
  try {
    # The target connection details MUST be independently verified before invoking.
    & psql -X -v ON_ERROR_STOP=1 -h $pgHost -p $pgPort -U $cred.UserName -d $pgDatabase -f $temp
    if ($LASTEXITCODE -ne 0) { throw "Production migration failed (psql exit code $LASTEXITCODE)" }
  } finally { Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
```

**Important:** This guard accepts only the direct production host with user `postgres` or the production Supavisor Session pooler in `eu-west-1` with user `postgres.kmwfvvliundhuovoakoa`, always on port `5432`. It explicitly rejects the QA project ref. Independently verify the actual host, TLS name/CA chain, database user, port and project ref before executing. Never disable or bypass the guard; if the verified connection differs, stop for review. Actual credentials and CA paths have not been verified in this chat.

Execute `docs/email-free-usernames-production-preflight.sql` read-only first, before authorization to apply the migration. After the owner authorizes and runs the migration, execute `docs/email-free-usernames-post-apply-check.sql` in the same verified connection with `ON_ERROR_STOP=1`. Expected after this 7-profile backfill:
- `legacy_remaining = 0`
- `rollback_log_rows = 7`
- `verified_changed_rows = 7`

If the counts or profile behavior differ, stop and use **only** the reviewed rollback SQL `docs/email-free-usernames-revert.sql`, with its guards and owner authorization. Do not silently retry the migration or delete the log.

## Owner-controlled rollback-log cleanup
After approval of the migration results and the expiry of the agreed rollback window, the privileged owner can run:

```sql
DELETE FROM private.username_backfill_log;
```

This is intentionally NOT part of the migration or PR deployment and must be explicitly approved.

## Security notes
The log includes previous potentially sensitive names: never emit rows. Revokes for `anon`, `authenticated`, and `service_role` are explicitly checked. SQL migration and test changes in this branch must remain restricted to the privacy fix. Full Schach-Treff functionality stays in PR #112.
