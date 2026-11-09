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
  assert.match(home, /homeUnifiedCard && \(\s*<span className="desktop-home-slogan-text home-unified-slogan hidden">/);
  assert.ok(home.includes("t('home.slogan').split(/\\s*[•·]\\s*/u)"));
  assert.match(home, /className="home-unified-slogan-diamond" aria-hidden="true"/);
  assert.match(home, /font-family: 'Cormorant Garamond', Georgia, serif/);
  assert.match(home, /font-size: clamp\(28px, 2\.53vw, 36px\)/);
  assert.match(home, /letter-spacing: 0\.02em/);
  assert.match(home, /margin-bottom: 6px/);
  assert.match(home, /#f4f6f8 0%, #cfd5db 50%, #9aa3ac 100%/);
  assert.match(home, /filter: drop-shadow\(0 0 5px rgba\(220,228,235,0\.18\)\)/);
  assert.match(home, /width: 7px;\s*height: 7px;\s*flex: 0 0 7px/);
  assert.match(home, /linear-gradient\(135deg, #eef1f4, #8d969f\)/);
  assert.match(home, /@media \(min-width: 1280px\) \{[\s\S]*?\.desktop-home-arena\.home-unified-card \{\s*background:\s*radial-gradient\(120% 70% at 30% 0%, rgba\(205,215,230,0\.07\) 0%, rgba\(205,215,230,0\) 55%\),\s*linear-gradient\(150deg, #24272c 0%, #1d2023 32%, #16241f 68%, #0b1a15 100%\);\s*\}/);
  assert.match(home, /className="hidden md:flex mobile-home-play desktop-home-play/);
  assert.match(home, /\{t\('home\.playChessNow'\)\}/);
});
