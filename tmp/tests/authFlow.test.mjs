import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthReturn, authRedirect, normalizedEmail, validEmail, authErrorKey, googleProviderEnabled, canUpdatePassword, accountNotFoundError, recoveryCallbackDestination, requestRecoveryEmail } from '../src/utils/authFlow.ts';

test('requesting a fresh recovery link validates email and targets the reset form, never an external return', async () => {
  const calls = [];
  const auth = { resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null }; } };
  await assert.rejects(requestRecoveryEmail(auth, 'invalid', 'https://qa.example', '/chat'), { code: 'invalid_email' });
  assert.equal(calls.length, 0);
  await requestRecoveryEmail(auth, ' Player@example.com ', 'https://qa.example', '/chat');
  assert.deepEqual(calls[0], ['Player@example.com', { redirectTo: 'https://qa.example/update-password?returnTo=%2Fchat' }]);
  await requestRecoveryEmail(auth, 'Player@example.com', 'https://qa.example', 'https://evil.example');
  assert.equal(calls[1][1].redirectTo, 'https://qa.example/update-password');
  await assert.rejects(requestRecoveryEmail({ resetPasswordForEmail: async () => ({ error: { status: 429 } }) }, 'p@example.com', 'https://qa.example', null), { status: 429 });
});

test('auth return accepts club and existing game routes, rejects external redirects', () => {
  for (const path of ['/chat', '/play', '/play?room=abc', '/play?invite=1&tc=5%2B0']) assert.equal(safeAuthReturn(path), path);
  for (const path of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/chat?next=evil', '/play?room=abc\n', '/play?room=a#evil']) assert.equal(safeAuthReturn(path), null);
});

test('email callbacks stay on current deployment and preserve safe club return', () => {
  assert.equal(authRedirect('https://qa.example', '/update-password', '/chat'), 'https://qa.example/update-password?returnTo=%2Fchat');
  assert.equal(authRedirect('https://qa.example', '/profile', '//evil.example'), 'https://qa.example/profile');
});

test('pasted emails are trimmed, malformed input is rejected without email request', () => {
  assert.equal(normalizedEmail('  Player@example.com  '), 'Player@example.com');
  assert.equal(validEmail(' Player@example.com '), true);
  for (const email of ['', 'player', 'player@', 'player@example', 'a b@example.com']) assert.equal(validEmail(email), false);
});

test('auth failures have actionable messages and never echo raw server details', () => {
  assert.equal(authErrorKey({code: 'invalid_credentials'}), 'auth.invalidCredentials');
  assert.equal(authErrorKey({code: 'email_not_confirmed'}), 'auth.confirmEmail');
  assert.equal(authErrorKey({code: 'over_email_send_rate_limit'}), 'auth.emailRateLimit');
  assert.equal(authErrorKey({status: 429}), 'auth.emailRateLimit');
  assert.equal(authErrorKey(new TypeError('Failed to fetch')), 'auth.networkError');
  assert.equal(authErrorKey({message: 'private server information'}), 'auth.recoveryError');
});

test('password changes wait for session and reject expired callback even when another session exists', () => {
  assert.equal(canUpdatePassword(false, false, '', ''), false);
  assert.equal(canUpdatePassword(true, true, '', ''), false);
  assert.equal(canUpdatePassword(true, false, '', '#error=access_denied&error_code=otp_expired'), false);
  assert.equal(canUpdatePassword(true, false, 'error=access_denied', ''), false);
  assert.equal(canUpdatePassword(true, false, 'returnTo=%2Fchat', ''), true);
  assert.equal(canUpdatePassword(true, false, 'error_code=otp_expired', ''), false);
  assert.equal(canUpdatePassword(true, false, '', '#error_description=Invalid+link'), false);
});

test('email-link account status is not exposed to the user', () => {
  assert.equal(accountNotFoundError({code:'user_not_found'}), true);
  assert.equal(accountNotFoundError({code:'otp_disabled'}), true);
  assert.equal(accountNotFoundError({code:'user_already_exists'}), true);
  assert.equal(accountNotFoundError({code:'invalid_credentials'}), false);
});

test('Google availability requires explicit enabled flag, hides unavailable provider', async () => {
  const response = settings => async () => new Response(JSON.stringify(settings));
  assert.equal(await googleProviderEnabled('https://qa.example', 'public-test-key', response({external:{google:true}})), true);
  assert.equal(await googleProviderEnabled('https://qa.example', 'public-test-key', response({external:{google:false}})), false);
  assert.equal(await googleProviderEnabled('https://qa.example', 'public-test-key', response({external:{google:'true'}})), false);
  assert.equal(await googleProviderEnabled('https://qa.example', 'public-test-key', async () => { throw new Error('offline'); }), false);
  assert.equal(await googleProviderEnabled('https://qa.example', 'public-test-key', async () => new Response('', {status:403})), false);
  assert.equal(await googleProviderEnabled('', '', response({external:{google:true}})), false);
});


test('Supabase recovery Site URL fallback enters password form without exposing tokens', () => {
  const link = 'https://chessaz-preview-workspace.vercel.app/#access_token=test-access&refresh_token=test-refresh&type=recovery';
  assert.equal(recoveryCallbackDestination(link), '/update-password#access_token=test-access&refresh_token=test-refresh&type=recovery');
  const profileCallback = 'https://qa.example/profile?returnTo=%2Fchat#access_token=a&refresh_token=b&type=recovery';
  assert.equal(recoveryCallbackDestination(profileCallback),
    '/update-password?returnTo=%2Fchat#access_token=a&refresh_token=b&type=recovery');
});

test('normal login/signup callbacks never route into password reset', () => {
  for (const href of [
    'https://qa.example/#access_token=a&refresh_token=b&type=signup',
    'https://qa.example/#access_token=a&refresh_token=b&type=magiclink',
    'https://qa.example/#type=recovery',
    'https://qa.example/chat#access_token=a&refresh_token=b&type=recovery',
    'https://qa.example/update-password#access_token=a&refresh_token=b&type=recovery',
    'https://qa.example/profile?returnTo=%2Fchat'
  ]) assert.equal(recoveryCallbackDestination(href), null);
  assert.equal(recoveryCallbackDestination('https://qa.example/#error=access_denied&error_code=otp_expired'),
    '/update-password#error=access_denied&error_code=otp_expired');
  assert.equal(recoveryCallbackDestination('https://qa.example/?error_code=otp_expired'),
    '/update-password?error_code=otp_expired');
  assert.equal(recoveryCallbackDestination('https://qa.example/#error_code=otp_expired'),
    '/update-password#error_code=otp_expired');
});
