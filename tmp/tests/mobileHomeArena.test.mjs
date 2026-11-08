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

test('unified desktop Arena is default-off, preserves the mobile layout and keeps the play action intact', () => {
  assert.match(home, /import\.meta\.env\.VITE_HOME_UNIFIED_CARD === 'true'/);
  assert.match(home, /homeUnifiedCard \? " xl:hidden" : ""/);
  assert.match(home, /homeUnifiedCard \? " home-unified-card" : ""/);
  assert.match(home, /homeUnifiedCard && \(\s*<span className="desktop-home-slogan-text hidden">\{t\('home\.slogan'\)\}<\/span>/);
  assert.match(home, /@media \(min-width: 1280px\) \{[\s\S]*?\.desktop-home-arena\.home-unified-card \{\s*background: linear-gradient\(145deg, #111419 0%, #16181f 54%, #1B1B22 100%\);\s*\}/);
  assert.match(home, /className="hidden md:flex mobile-home-play desktop-home-play/);
  assert.match(home, /\{t\('home\.playChessNow'\)\}/);
});
