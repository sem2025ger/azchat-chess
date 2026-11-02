import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import postcss from 'postcss';

const legacy = ['Void Black', 'Deep Space', 'Velvet Gold', 'Champagne Light', 'Coffee Brown', 'Walnut Dark', 'Emerald Night', 'Royal Blue', 'Royal Violet', 'Obsidian Gold'];
const added = ['Soft Graphite', 'Slate Blue', 'Sage Stone', 'Warm Taupe', 'Amethyst Mist'];
const luminance = hex => {
  const rgb = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};

test('saved interface themes survive initialization and remain selectable with real rendered backgrounds', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'chess_background' ? saved : key === 'app-language' ? 'ru' : null } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ThemeProvider, useThemeContext } = await server.ssrLoadModule('/src/context/ThemeContext.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { default: Settings } = await server.ssrLoadModule('/src/screens/SettingsScreen.tsx');
    const { default: Layout } = await server.ssrLoadModule('/src/components/Layout.tsx');
    const { premiumInterfaceThemes } = await server.ssrLoadModule('/src/lib/interfaceThemes.ts');
    const { findSettings } = await server.ssrLoadModule('/src/components/settings/settingsLogic.ts');
    let observed;
    function Probe() { observed = useThemeContext().background; return null; }
    const render = component => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/settings'] }, createElement(LanguageProvider, null, createElement(ThemeProvider, null, createElement(Probe), createElement(component)))));
    for (const name of [...legacy, ...added]) {
      saved = name;
      const html = render(Settings);
      assert.equal(observed, name, 'must restore ' + name);
      assert.ok(html.includes('>' + name + '</button>'), 'desktop selector must retain ' + name);
      const layout = render(Layout);
      if (added.includes(name)) {
        assert.ok(html.includes('data-premium-theme="' + name + '"'));
        assert.match(html, /aria-pressed="true"/);
        const theme = premiumInterfaceThemes.find(x => x.id === name);
        assert.ok(layout.includes(theme.class), 'global background must match selected palette');
        for (const color of theme.gradient.match(/#[a-f0-9]{6}/g)) {
          assert.ok(luminance(color) > .01 && luminance(color) < .05, 'muted dark palette luminance');
          assert.ok(1.05 / (luminance(color) + .05) >= 4.5, 'white text contrast');
        }
        assert.equal(findSettings([{ kind: 'background', label: name, value: name }], name, { background: 'Интерфейс' })[0]?.value, name);
      } else assert.ok(!html.includes('data-premium-theme='), 'old themes retain approved mobile Settings palette');
    }
    for (const [old, expected] of [['Standard', 'Void Black'], ['Game Room', 'Deep Space'], ['Velvet Gold Background', 'Velvet Gold'], ['unknown', 'Soft Graphite'], [null, 'Soft Graphite']]) {
      saved = old; render(Layout); assert.equal(observed, expected);
    }
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
});

test('Restore Defaults uses the same Soft Graphite baseline as first visit', () => {
  const screen = readFileSync(new URL('../src/screens/SettingsScreen.tsx', import.meta.url), 'utf8');
  const context = readFileSync(new URL('../src/context/ThemeContext.tsx', import.meta.url), 'utf8');
  const restore = screen.split('const handleRestoreDefaults = () => {')[1]?.split('\n  };')[0] || '';
  assert.match(restore, /setBackground\('Soft Graphite'\)/);
  assert.match(context, /return 'Soft Graphite';/);
  assert.match(context, /localStorage.getItem\('chess_background'\)/);
});

test('restore defaults uses a bold high-contrast label and a visible keyboard focus indicator', () => {
  const css = postcss.parse(readFileSync(new URL('../src/screens/SettingsTypography.css', import.meta.url), 'utf8'));
  const style = {};
  css.walkRules('.settings-fixed-workspace .settings-restore-defaults', rule => rule.walkDecls(d => { style[d.prop] = d.value; }));
  assert.ok(Number(style['font-weight']) >= 700);
  for (const color of style.background.match(/#[a-f0-9]{6}/g)) assert.ok((luminance(style.color) + .05) / (luminance(color) + .05) >= 4.5);
  assert.match(style.border, /1px solid/);
  let focus = false;
  css.walkRules('.settings-fixed-workspace button:focus-visible', rule => rule.walkDecls('outline', d => { focus = !/none|^0/.test(d.value); }));
  assert.ok(focus);
});

test('extra desktop palettes remain reachable inside a bounded scroll section', () => {
  const css = postcss.parse(readFileSync(new URL('../src/screens/SettingsTypography.css', import.meta.url), 'utf8'));
  let bounded = false;
  css.walkRules('.settings-fixed-workspace .settings-background-options', rule => {
    const properties = Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(d => [d.prop, d.value]));
    bounded = rule.parent.params === '(min-width: 1024px)' && properties['overflow-y'] === 'auto' && /clamp/.test(properties['max-height']);
  });
  assert.ok(bounded, 'new options must not grow beyond short desktop screens');
});

// Owner requested the same four hues with roughly half their original lightness.
test('the four optional palettes retain their hues at half the original lightness', async () => {
  const original = {
    'Slate Blue': ['#53677c', '#465a70', '#3b4d62'],
    'Sage Stone': ['#5e716a', '#4e625c', '#40554f'],
    'Warm Taupe': ['#7a6b5e', '#6b5c51', '#594d45'],
    'Amethyst Mist': ['#70657f', '#60556f', '#50475f'],
  };
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { premiumInterfaceThemes } = await server.ssrLoadModule('/src/lib/interfaceThemes.ts');
    const originalThemes = premiumInterfaceThemes.filter(theme => theme.id in original);
    assert.deepEqual(originalThemes.map(theme => theme.id), Object.keys(original));
    for (const theme of originalThemes) {
      const colors = theme.gradient.match(/#[a-f0-9]{6}/g);
      assert.deepEqual(theme.class.match(/#[a-f0-9]{6}/g), colors, 'swatches and applied background agree');
      colors.forEach((color, stop) => {
        for (const channel of [1, 3, 5]) {
          const before = parseInt(original[theme.id][stop].slice(channel, channel + 2), 16);
          const after = parseInt(color.slice(channel, channel + 2), 16);
          assert.ok(Math.abs(after / before - .5) <= .015, theme.id + ' preserves relative color channels at half brightness');
        }
      });
    }
  } finally { await server.close(); }
});

// Static guard: protect the agreed sidebar sizing and unchanged video rotation behavior.
test('desktop sidebar and Chess Arena polish preserve the existing globe animation', () => {
  const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('xl:text-[1.72rem]'));
  assert.match(layout, /aria-label="Chessaz\.de"/);
  assert.match(layout, /src="\/brand\/sidebar-king\.svg"/);
  assert.ok(layout.includes('h-[54px] w-[54px]'));
  assert.ok(layout.includes('w-[46px] h-[31px]'));
  assert.match(layout, /autoPlay muted loop playsInline/);
  assert.doesNotMatch(layout, /playbackRate/);
  assert.match(home, /#D9D6CF 39%/);
  assert.match(home, /#947D5D 100%/);
});


test('desktop Settings polish preserves mobile decorative layers and existing interface palettes', () => {
  const settings = readFileSync(new URL('../src/screens/SettingsScreen.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/screens/SettingsTypography.css', import.meta.url), 'utf8');
  const profileCss = readFileSync(new URL('../src/components/profile/PlayerPassportDesktop.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(min-width: 1024px\)\s*\{\s*\.settings-fixed-workspace \.settings-command-center \{ display: none !important; \}/);
  assert.match(settings, /<SettingsCommandCenter language=\{language\} \/>/, 'mobile command center remains in original DOM position');
  assert.equal((settings.match(/className="settings-mobile-decor /g) || []).length, 2);
  assert.match(css, /\.settings-fixed-workspace \.settings-mobile-decor \{ display: none; \}/);
  assert.match(css, /max-height: clamp\(132px, 22dvh, 220px\)/);
  assert.match(css, /scroll-behavior: smooth/);
  assert.match(profileCss, /@media \(min-width: 1024px\)/);
  assert.match(profileCss, /\.desktop-player-passport \.passport-rating \.tabular-nums \{ font-size: 2\.75rem; \}/);
});


test('Settings rows stretch with fixed gaps and vertically centered content', () => {
  const site = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(site, /\.settings-fixed-workspace \.settings-options-column\s*\{[^}]*justify-content:flex-start/);
  assert.match(site, /\.settings-fixed-workspace \.settings-options-column > div\s*\{[^}]*flex:1 1 0/);
  assert.match(site, /\.settings-fixed-workspace \.settings-options-column > div:nth-child\(2\)\s*\{[^}]*display:grid/);
  assert.match(site, /\.settings-desktop-grid \{ --settings-card-gap:12px; \}/);
  assert.match(site, /\.settings-desktop-grid \{ --settings-card-gap:16px; \}/);
});

test('compact Passport applies only at desktop breakpoints and does not reduce text size below 11px', () => {
  const css = readFileSync(new URL('../src/components/profile/PlayerPassportDesktop.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(min-width:1024px\) \{\s*\.desktop-player-passport \{ gap:8px/);
  assert.match(css, /\.desktop-player-passport \.passport-identity \{ justify-content:flex-start; align-self:start; \}/);
  assert.match(css, /\.desktop-player-passport \.passport-achievements \{ gap:9px; \}/);
  assert.equal(/font-size:\s*(?:[0-9](?:\.[0-9]+)?)px/.test(css), false, 'do not introduce sub-11px font sizes');
});

test('Profile removes chess handwriting completely for all six languages on phone and desktop', () => {
  const source = readFileSync(new URL('../src/components/profile/MobilePlayerPassport.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/profile/PlayerPassportDesktop.css', import.meta.url), 'utf8');
  for (const lang of ['de', 'en', 'az', 'tr', 'ua', 'ru']) assert.match(source, new RegExp('  ' + lang + ': \\{'));
  assert.doesNotMatch(source, /passport-signature|words\.signature|signatureSub|signatureInfo|ШАХМАТНЫЙ ПОЧЕРК|CHESS SIGNATURE/);
  assert.doesNotMatch(css, /passport-signature/);
  assert.match(css, /\.passport-next \{\s*grid-column: 1;\s*grid-row: 3;/);
  assert.match(css, /\.passport-performance \{\s*grid-column: 2;\s*grid-row: 3;/);
  assert.match(css, /\.passport-recent \{\s*grid-column: 2;\s*grid-row: 4;/);
  assert.match(css, /\.passport-achievements \{\s*grid-column: 1;\s*grid-row: 4;/);
});

test('Settings desktop preview grows with the equal-height options column', () => {
  const site = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const scope = site.slice(site.indexOf('/* Settings desktop: one stable viewport'));
  assert.match(scope, /@media \(min-width:1024px\)/);
  assert.match(scope, /\.settings-desktop-grid \{[^}]*height:calc\(100% - 48px\)/);
  assert.match(scope, /\.settings-desktop-grid \{[^}]*margin-block:auto/);
  assert.match(scope, /\.settings-options-column > div \{[^}]*flex:1 1 0/);
  assert.match(scope, /\.settings-options-column section \{[^}]*height:100%/);
  assert.match(scope, /\.settings-options-column > div:nth-child\(2\) \{[^}]*align-items:stretch/);
  assert.match(scope, /\.settings-preview-column > div \{ position:absolute; inset:0;/);
  assert.match(scope, /\.settings-desktop-grid \{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});
