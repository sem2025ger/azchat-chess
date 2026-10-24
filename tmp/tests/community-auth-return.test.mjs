import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const helper = read('../src/lib/authCallbackUrl.ts');
const club = read('../src/screens/ChessAZCommunityScreen.tsx');
const profile = read('../src/screens/ProfileScreen.tsx');
const reset = read('../src/screens/UpdatePasswordScreen.tsx');

test('club sign-in carries an explicit same-app /chat return target', () => {
  assert.match(club, /to="\/profile\?returnTo=%2Fchat"/);
  assert.match(profile, /clubReturnTarget\(requestedReturn\)/);
  assert.match(profile, /navigate\(clubReturnTo, \{ replace: true \}\)/);
});
test('all email callbacks carry club intent to a stable QA host', () => {
  assert.match(helper, /chessaz-preview-workspace\.vercel\.app/);
  assert.match(helper, /callback\.searchParams\.set\('returnTo', '\/chat'\)/);
  assert.match(profile, /emailRedirectTo: authCallbackUrl\(window\.location\.origin, '\/profile', Boolean\(clubReturnTo\), mobileReturnTo === '\/play'\)/);
  assert.match(profile, /redirectTo: authCallbackUrl\(window\.location\.origin, '\/update-password', Boolean\(clubReturnTo\), mobileReturnTo === '\/play'\)/);
});
test('password recovery keeps /chat as an explicit post-update option', () => {
  assert.match(reset, /clubReturnTarget\(requestedReturn\)/);
  assert.match(reset, /navigate\(backTo\)/);
  assert.match(reset, /requestedReturn === '\/play' \? '\/play'/);
  assert.match(helper, /return value === '\/chat' \? '\/chat' : null/);
});
