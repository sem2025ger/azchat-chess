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
  assert.match(helper, /chessaz-preview-workspace\.vercel\.app/);
  assert.match(helper, /current\.origin/);
  assert.match(helper, /value === '\/chat'/);
  assert.match(profile, /authCallbackUrl\(window\.location\.origin, '\/update-password', Boolean\(clubReturnTo\)\)/);
  assert.match(profile, /authCallbackUrl\(window\.location\.origin, '\/profile', Boolean\(clubReturnTo\), mobileReturnTo === '\/play'\)/);
  assert.match(password, /clubReturnTarget\(searchParams\.get\('returnTo'\)\)/);
  assert.match(password, /navigate\(backTo\)/);
});

test('play magic-link callbacks preserve /play and return after signing in', () => {
  assert.match(helper, /else if \(returnToPlay\) callback\.searchParams\.set\('returnTo', '\/play'\)/);
  assert.match(profile, /mobileReturnTo === '\/play'/);
  assert.match(profile, /navigate\(mobileReturnTo, \{ replace: true \}\)/);
});
