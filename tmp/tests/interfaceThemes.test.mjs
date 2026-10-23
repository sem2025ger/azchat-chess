import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import postcss from 'postcss';

const legacy = ['Void Black', 'Deep Space', 'Velvet Gold', 'Champagne Light', 'Coffee Brown', 'Walnut Dark', 'Emerald Night', 'Royal Blue', 'Royal Violet', 'Obsidian Gold'];
const added = ['Slate Blue', 'Sage Stone', 'Warm Taupe', 'Amethyst Mist'];
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
          assert.ok(luminance(color) > .055 && luminance(color) < .22, 'palette stays between very dark and light');
          assert.ok(1.05 / (luminance(color) + .05) >= 4.5, 'white text contrast');
        }
        assert.equal(findSettings([{ kind: 'background', label: name, value: name }], name, { background: 'Интерфейс' })[0]?.value, name);
      } else assert.ok(!html.includes('data-premium-theme='), 'old themes retain approved mobile Settings palette');
    }
    for (const [old, expected] of [['Standard', 'Void Black'], ['Game Room', 'Deep Space'], ['Velvet Gold Background', 'Velvet Gold'], ['unknown', 'Void Black'], [null, 'Void Black']]) {
      saved = old; render(Layout); assert.equal(observed, expected);
    }
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
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
