import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');

test('mobile Chess Arena retains its approved title and board dimensions', () => {
  assert.match(home, /className="chess-arena-reference-title md:hidden/);
  assert.match(home, /Chess Arena\s*<\/h1>/);
  assert.match(home, /data-mobile-home-stack/);
  assert.match(home, /padding-top: 12px/);
  assert.match(home, /@media \(max-width: 767px\) \{\s*\.home-screen-root \[data-mobile-home-stack\]/);
  assert.match(home, /\.home-screen-root \.mobile-home-arena::before/);
  assert.match(home, /\.home-screen-root \.mobile-home-arena::after/);
  assert.match(home, /max-w-\[320px\]/);
  assert.match(home, /<MobileHomeBoard \/>/);
  assert.match(home, /<HomeMoveControls review=\{review\} goTo=\{goTo\} className="grid" compactMobile \/>/);
});
