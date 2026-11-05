import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const helper = readFileSync(new URL('../src/lib/authCallbackUrl.ts', import.meta.url), 'utf8');
const club = readFileSync(new URL('../src/screens/ChessAZCommunityScreen.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/screens/ProfileScreen.tsx', import.meta.url), 'utf8');
const password = readFileSync(new URL('../src/screens/UpdatePasswordScreen.tsx', import.meta.url), 'utf8');

test('club sign-in preserves /chat destination', () => {
  assert.match(club, /\/profile\?returnTo=%2Fchat/);
  assert.match(profile, /clubReturnTarget\(requestedReturn\)/);
  assert.match(profile, /navigate\(clubReturnTo, \{ replace: true \}\)/);
});
test('password and OTP callbacks keep club return on the stable QA origin', () => {
  assert.match(helper, /stableQaBranchHost/);
  assert.match(helper, /safeQaBranchOrigin/);
  assert.match(helper, /current\.origin/);
  assert.match(helper, /value === '\/chat'/);
  assert.match(profile, /authCallbackUrl\(window\.location\.origin, '\/update-password', Boolean\(clubReturnTo\), mobileReturnTo === '\/play'\)/);
  assert.match(profile, /authCallbackUrl\(window\.location\.origin, '\/profile', Boolean\(clubReturnTo\), mobileReturnTo === '\/play'\)/);
  assert.match(password, /clubReturnTarget\(requestedReturn\)/);
  assert.match(password, /navigate\(backTo\)/);
});

test('play magic-link callbacks preserve /play and return after signing in', () => {
  assert.match(helper, /else if \(returnToPlay\) callback\.searchParams\.set\('returnTo', '\/play'\)/);
  assert.match(profile, /mobileReturnTo === '\/play'/);
  assert.match(profile, /navigate\(mobileReturnTo, \{ replace: true \}\)/);
  assert.match(password, /requestedReturn === '\/play' \? '\/play'/);
  assert.match(password, /clubReturnTarget\(requestedReturn\)/);
});

test('validated email return does not paint the profile before redirect', () => {
  assert.match(profile, /const redirectingAfterSignIn = Boolean\(session && !isLoading/);
  assert.match(profile, /clubReturnTo \|\| \(mobileReturnTo/);
  assert.match(profile, /if \(redirectingAfterSignIn\) \{/);
  const guard = profile.indexOf('if (redirectingAfterSignIn)');
  const passport = profile.indexOf('if (showMobilePassport || showDesktopPassport)');
  const login = profile.indexOf('if (!session)');
  assert.ok(guard >= 0 && guard < login && login < passport,
    'return overlay guard must precede both login and player passport rendering');
  assert.match(profile, /prefetchRoute\('\/chat'\)/);
  assert.match(profile, /navigate\(clubReturnTo, \{ replace: true \}\)/);
});
