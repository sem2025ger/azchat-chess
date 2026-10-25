import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('arena renders chosen clock, four quick presets and opt-in readiness before the primary action', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'app-language' ? 'ru' : null } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Panel } = await server.ssrLoadModule('/src/components/ArenaPlayPanel.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(LanguageProvider, null,
      createElement(Panel, { timeControl: '3 min.', onTimeChange() {}, onStart() {}, onFriend() {} }))));
    assert.doesNotMatch(html, /CHESSAZ · ИГРОВАЯ АРЕНА/);
    assert.doesNotMatch(html, /\/pieces\/classic\/bP\.svg/);
    assert.match(html, /class="arena-start-game"[^>]*><span>НАЧАТЬ ИГРУ<\/span>/);
    assert.equal((html.match(/aria-pressed=/g) || []).length, 4);
    assert.match(html, /aria-pressed="true">3 мин\./);
    assert.match(html, /role="switch" aria-checked="false"/);
    assert.match(html, /aria-checked="false"[^>]*disabled=""/);
    assert.ok(html.indexOf('Выбрать соперника') < html.indexOf('НАЧАТЬ ИГРУ'));
    assert.match(html, /ИГРА С ДРУГОМ/);
    assert.match(html, /disabled=""[^>]*>.*ТУРНИРЫ · СКОРО/);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  }
});

test('mobile arena has one dialog trigger and compact actions without native lists or desktop lobby controls', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'app-language' ? 'ru' : null } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Panel } = await server.ssrLoadModule('/src/components/MobileArenaPlayPanel.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    for (const timeControl of ['3 min.', '1 | 1', '15 | 10']) {
      const html = renderToStaticMarkup(createElement(LanguageProvider, null,
        createElement(Panel, { timeControl, onTimeChange() {}, onStart() {}, onFriend() {} })));
      assert.equal((html.match(/<select |<option /g) || []).length, 0);
      assert.match(html, /aria-expanded="false"/);
      assert.ok(html.includes(timeControl.replace('min.', 'мин.')));
      assert.equal((html.match(/<button /g) || []).length, 4);
      assert.match(html, /НАЧАТЬ ИГРУ/);
      assert.match(html, /aria-haspopup="dialog"/);
      assert.match(html, /Турниры · скоро/);
      assert.doesNotMatch(html, /role="switch"|Выбрать соперника|arena-quick-times|overflow-y/);
    }
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  }
});
