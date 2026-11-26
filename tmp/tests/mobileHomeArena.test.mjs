import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('mobile Home uses the desktop brand and compact layout without changing desktop Arena', () => {
  assert.match(home, /className="chess-arena-reference-title md:hidden" aria-label="Chessaz\.de"/);
  assert.match(home, /mobile-home-brand-name">Chessaz<\/span><span className="mobile-home-brand-domain"><span className="mobile-home-brand-dot">\.<\/span>de<\/span>/);
  assert.doesNotMatch(home, /mobile-home-slogan/);
  assert.doesNotMatch(css, /mobile-home-slogan/);
  assert.ok(home.includes("t('home.slogan')"));
  assert.ok(home.includes("@fontsource/bodoni-moda/700.css"));
  assert.match(home, /src="\/brand\/sidebar-king\.svg"[^\n]*width="38" height="76"/);
  assert.ok(css.includes('justify-content: safe center;\n    gap: 16px;\n    padding: 0 2px;'));
  assert.ok(css.includes("font-size: clamp(44px, 14.5vw, 56px);"));
  assert.match(css, /\.mobile-home-brand-domain\s*\{\s*color: #B2A79A;/);
  assert.ok(css.includes('linear-gradient(110deg, #8F8983, #B2A79A 48%, #938C85)'));
  assert.match(css, /\.home-screen-root \.mobile-home-king\s*\{\s*width: calc\(\.67857143em \+ 1\.5px\);\s*height: calc\(1\.35714286em \+ 3px\);\s*margin-left: -\.03em;\s*transform: translateY\(-\.11em\);/);
  assert.match(css, /\.home-screen-root \[data-mobile-home-stack\] \.mobile-home-arena\s*\{\s*border: 0 !important;\s*outline: none;\s*background: none;/);
  assert.ok(css.includes('width: min(100%, max(0px, calc(100cqh - 180px)));\n    max-width: 100% !important;'));
  assert.ok(home.includes('max-width: calc(100vw - 4px) !important;'));
  assert.ok(css.includes('.home-screen-root .mobile-home-arena > a[href="/region/nrw"] {\n    display: none;'));
  assert.ok(css.includes('.home-screen-root .home-board-column .home-board + nav {\n    margin-top: 14px;'));
  const navLabel = css.match(/\[data-mobile-app-nav\] \.site-nav-link \.site-nav-label\{([^}]+)\}/)?.[1] ?? '';
  assert.match(navLabel, /max-width:none/);
  assert.match(navLabel, /font-size:clamp\(9px,2\.5vw,\.8rem\)/);
  assert.match(navLabel, /white-space:nowrap;overflow:visible;text-overflow:clip/);
  assert.ok(css.includes('[data-mobile-app-nav] .site-nav-link:not([aria-current="page"]):not([href="/chat"]):not(:hover) { color: #969696; }'));
  assert.doesNotMatch(navLabel, /overflow-wrap:anywhere|text-overflow:ellipsis/);
  assert.match(css, /font-size: calc\(clamp\(9px, 2\.5vw, \.8rem\) \+ 1px\);\s*font-weight: 700;\s*color: #C6CDD5/);
  assert.match(css, /\.mobile-home-brand-dot\s*\{\s*font-size: \.75em;\s*margin-right: -\.045em;/);
  assert.doesNotMatch(home, /mobile-home-wordmark-sheen/);
  assert.match(home, /sidebar-king-sheen pointer-events-none absolute inset-0/);
  assert.match(home, /Chess<span className="text-chess-active"> Arena<\/span>/);
  assert.match(home, /data-mobile-home-stack/);
  assert.match(css, /@media \(max-width: 767px\) \{\s*\.home-screen-root \{\s*height: 100%;\s*min-height: 0;\s*container-type: size;/);
  assert.doesNotMatch(home, /\.home-screen-root \.mobile-home-arena::(?:before|after)/);
  assert.match(css, /\.home-screen-root \.mobile-home-arena::before,\s*\.home-screen-root \.mobile-home-arena::after\s*\{\s*display: none;/);
  assert.match(css, /\[data-mobile-app-nav\] \.site-nav-link\{flex:1 1 0;min-width:44px/);
  assert.ok(css.includes('linear-gradient(145deg, #23272B, #14171C 58%, #29343F)'));
  assert.ok(css.includes('inset 0 0 0 1px rgba(126,137,150,.48)'));
  assert.ok(css.includes('inset 0 -3px 0 #9BAABA'));
  assert.ok(css.includes('[data-mobile-app-nav] .site-nav-link>div>svg:first-child{width:17px;height:17px}'));
  assert.doesNotMatch(css, /chessazMobileBronzeWave|mobile-home-wordmark-sheen/);
  assert.match(css, /\.home-screen-root \.mobile-home-arena \.sidebar-king-sheen\s*\{[^}]*rgba\(29,33,40,\.44\)[^}]*animation: sidebarKingSoftSheen 9s ease-in-out infinite;/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.home-screen-root \.mobile-home-arena \.sidebar-king-sheen \{ animation: none; opacity: 0; \}/);
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

test('mobile Schach-Treff uses its own knight bubble, without a decorative dot', () => {
  const layout = fs.readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<MobileNavItem to="\/chat" icon=\{<MobileSchachTreffIcon \/>\} label="Schach-Treff"/);
  assert.match(layout, /<svg data-mobile-schach-treff-icon width="20" height="20"/);
  assert.match(layout, /to !== '\/chat' && <Circle/);
  assert.match(layout, /<NavItem to="\/chat" icon=\{<MessageSquare/);
  assert.match(layout, /id="mobile-chat-titanium"/);
  assert.match(css, /linear-gradient\(115deg, transparent 27%, #29343F 43%, #66717C 50%, #29343F 57%, transparent 73%\)/);
  assert.match(css, /animation: chessazMobileChatSheen 8s ease-in-out infinite/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\[data-mobile-app-nav\] \.site-nav-link\[href="\/chat"\]::before \{ animation: none; opacity: 0; \}/);
});
