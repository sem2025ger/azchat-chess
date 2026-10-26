import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import postcss from 'postcss';

// Render the real settings screen, including its board and theme context.
test('settings preview renders all squares, pieces and outside coordinate rails', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => key === 'app-language' ? 'ru' : null },
  });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: SettingsScreen } = await server.ssrLoadModule('/src/screens/SettingsScreen.tsx');
    const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const html = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(LanguageProvider, null, createElement(ThemeProvider, null,
        createElement(SettingsScreen)))));
    const preview = html.slice(html.indexOf('class="settings-preview-board'));
    assert.ok(preview.startsWith('class="settings-preview-board'));
    assert.equal((preview.match(/data-square="[a-h][1-8]"/g) || []).length, 96); // 64 squares + 32 pieces
    assert.equal((preview.match(/data-piece-square=/g) || []).length, 32);
    for (const [axis, labels] of [
      ['rank', ['8', '7', '6', '5', '4', '3', '2', '1']],
      ['file', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']],
    ]) {
      const rail = preview.match(new RegExp(`<div data-coordinate-axis="${axis}"[^>]*>(.*?)</div>`));
      assert.ok(rail, `missing outside ${axis} coordinates`);
      assert.deepEqual([...rail[1].matchAll(/<span[^>]*>(.*?)<\/span>/g)].map(m => m[1]), labels);
    }
    assert.equal((preview.match(/<span class="[^"]*lg:hidden/g) || []).length, 16);
    assert.doesNotMatch(preview, /!p-0/); // preserve the coordinate gutters
    assert.ok(html.includes('Тема интерфейса'));
    assert.doesNotMatch(html, /class="settings-quick-links/);
    const reset = html.match(/<button[^>]*aria-controls="settings-preview-board"[^>]*>(.*?)<\/button>/);
    assert.ok(reset, 'preview needs its own reset control');
    assert.match(reset[1], /Обновить/);
    assert.doesNotMatch(html, /Active Render/);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  }
});

test('settings preview has a non-collapsing width at every desktop height', () => {
  const css = postcss.parse(readFileSync(new URL('../src/index.css', import.meta.url), 'utf8'));
  const widths = [];
  css.walkRules('.settings-preview-board', rule => {
    rule.walkDecls('width', decl => widths.push(decl.value));
  });
  assert.ok(widths.length > 0, 'preview must define its width rather than relying on intrinsic contents');
  for (const width of widths) assert.doesNotMatch(width, /auto|^0(?:px|%)?$/);
});
