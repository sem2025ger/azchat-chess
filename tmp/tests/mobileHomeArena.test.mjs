import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('mobile Home uses the desktop brand and compact layout without changing desktop Arena', () => {
  assert.match(home, /className="chess-arena-reference-title md:hidden" aria-label="Chessaz\.de"/);
  assert.match(home, /mobile-home-brand-name">Chessaz<\/span><span className="mobile-home-brand-domain">\.de<\/span>/);
  assert.match(home, /mobile-home-slogan md:hidden"><span>\{t\('home\.slogan'\)\}<\/span>/);
  assert.ok(home.includes("@fontsource/bodoni-moda/700.css"));
  assert.match(home, /src="\/brand\/sidebar-king\.svg"[^\n]*width="28" height="56"/);
  assert.ok(css.includes('justify-content: safe center;\n    gap: 22px;\n    padding: 0 2px;'));
  assert.ok(css.includes("font-family: 'Bodoni Moda', Georgia, serif;\n    font-size: 40px;\n    font-weight: 700;"));
  assert.ok(css.includes('linear-gradient(110deg, #EADBB8, #C8AE7E, #9E8459)'));
  assert.match(css, /\.home-screen-root \[data-mobile-home-stack\] \.mobile-home-arena\s*\{\s*border: 0 !important;\s*outline: none;\s*background: none;/);
  assert.ok(css.includes('width: min(100%, max(0px, calc(100cqh - 180px)));\n    max-width: 100% !important;'));
  assert.ok(home.includes('max-width: calc(100vw - 4px) !important;'));
  assert.ok(css.includes('.home-screen-root .mobile-home-arena > a[href="/region/nrw"] {\n    display: none;'));
  assert.ok(css.includes('.home-screen-root .home-board-column .home-board + nav {\n    margin-top: 14px;'));
  const navLabel = css.match(/\[data-mobile-app-nav\] \.site-nav-link \.site-nav-label\{([^}]+)\}/)?.[1] ?? '';
  assert.match(navLabel, /max-width:none/);
  assert.match(navLabel, /font-size:clamp\(9px,2\.65vw,\.75rem\)/);
  assert.match(navLabel, /white-space:nowrap;overflow:visible;text-overflow:clip/);
  assert.doesNotMatch(navLabel, /overflow-wrap:anywhere|text-overflow:ellipsis/);
  assert.match(css, /\[data-mobile-app-nav\] \.site-nav-link\[href="\/chat"\] \.site-nav-label\{width:4\.5em;white-space:normal\}/);
  assert.match(home, /sidebar-king-sheen pointer-events-none absolute inset-0/);
  assert.match(home, /Chess<span className="text-chess-active"> Arena<\/span>/);
  assert.match(home, /data-mobile-home-stack/);
  assert.match(css, /@media \(max-width: 767px\) \{\s*\.home-screen-root \{\s*height: 100%;\s*min-height: 0;\s*container-type: size;/);
  assert.doesNotMatch(home, /\.home-screen-root \.mobile-home-arena::(?:before|after)/);
  assert.match(css, /\.home-screen-root \.mobile-home-arena::before,\s*\.home-screen-root \.mobile-home-arena::after\s*\{\s*display: none;/);
  assert.match(css, /\[data-mobile-app-nav\] \.site-nav-link\{flex:1 1 0;min-width:44px/);
  assert.match(css, /\[data-mobile-app-nav\] \.site-nav-link\[href="\/chat"\]:not\(\[aria-current="page"\]\)\{color:#E7C47F;box-shadow:inset 0 0 0 1px rgba\(200,174,126,\.36\)\}/);
  assert.doesNotMatch(home, /mobile-home-chat|schachTreffSubtitle|<Link to="\/chat"/);
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
  assert.match(home, /width: 6px;\s*height: 6px;\s*flex: 0 0 6px/);
  assert.match(home, /linear-gradient\(135deg, #e9d1a1, rgb\(var\(--chessaz-bronze-frame\)\)\)/);
  assert.match(home, /@media \(min-width: 1280px\) \{[\s\S]*?\.desktop-home-arena\.home-unified-card \{\s*background:\s*radial-gradient\(120% 70% at 30% 0%, rgba\(205,215,230,0\.07\) 0%, rgba\(205,215,230,0\) 55%\),\s*linear-gradient\(150deg, #24272c 0%, #1d2023 32%, #16241f 68%, #0b1a15 100%\);\s*\}/);
  assert.match(home, /className="hidden md:flex mobile-home-play desktop-home-play/);
  assert.match(home, /\{t\('home\.playChessNow'\)\}/);
});

test('Chess Arena keeps its default surface and overrides it only for the unified desktop card', () => {
  assert.match(css, /\.mobile-home-arena\s*\{[^}]*background:\s*linear-gradient\(165deg, #222743 0%, #1a1f38 55%, #14182e 100%\);/);
  for (const rule of home.matchAll(/\.home-screen-root \.(?:mobile|desktop)-home-arena\s*\{([^}]+)\}/g)) {
    assert.doesNotMatch(rule[1], /background(?:-color|-image)?\s*:/);
  }
  const overrides = [...home.matchAll(/\.home-screen-root \.desktop-home-arena\.home-unified-card\s*\{[^}]+\}/g)];
  assert.equal(overrides.length, 1);
  assert.equal(overrides[0][0], `.home-screen-root .desktop-home-arena.home-unified-card {
            background:
              radial-gradient(120% 70% at 30% 0%, rgba(205,215,230,0.07) 0%, rgba(205,215,230,0) 55%),
              linear-gradient(150deg, #24272c 0%, #1d2023 32%, #16241f 68%, #0b1a15 100%);
          }`);
  const desktopStyles = home.lastIndexOf('@media (min-width: 1280px)', overrides[0].index);
  assert.ok(desktopStyles > home.lastIndexOf('@media (max-width:', overrides[0].index));
  assert.doesNotMatch(home.match(/className=\{`mobile-home-arena[^\n]+/)[0], /\bbg-/);
});
