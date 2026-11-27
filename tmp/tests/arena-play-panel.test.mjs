import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('desktop arena shows chosen clock and mode without quick presets, preserving opt-in readiness', async () => {
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
    assert.equal((html.match(/aria-pressed=/g) || []).length, 0);
    assert.match(html, /arena-time-value[^>]*>3 мин\./);
    assert.match(html, /<small>Blitz<\/small>/);
    assert.doesNotMatch(html, /arena-quick-times|КОНТРОЛЬ ВРЕМЕНИ/);
    assert.match(html, /role="switch" aria-checked="false"/);
    assert.match(html, /aria-checked="false"[^>]*disabled=""/);
    assert.ok(html.indexOf('Выбрать соперника') < html.indexOf('НАЧАТЬ ИГРУ'));
    assert.match(html, /ИГРА С ДРУГОМ/);
    assert.match(html, /disabled=""[^>]*>.*ТУРНИРЫ · СКОРО/);
    for (const [timeControl, category] of [['1 min.','Bullet'],['1 | 1','Bullet'],['2 | 1','Bullet'],['3 min.','Blitz'],['3 | 2','Blitz'],['5 min.','Blitz'],['10 min.','Rapid'],['15 | 10','Rapid'],['30 min.','Rapid']]) {
      const chosen = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(LanguageProvider, null,
        createElement(Panel, { timeControl, onTimeChange() {}, onStart() {}, onFriend() {} }))));
      assert.ok(chosen.includes(`<small>${category}</small>`));
      assert.ok(chosen.includes(timeControl.replace('min.', 'мин.')));
    }
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  }
});

test('mobile arena has four popular times, More and compact actions without native lists or desktop lobby controls', async () => {
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
      const popular = [...html.matchAll(/<button\b[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)];
      assert.deepEqual(popular.map(m => m[2]), ['1 мин.', '3 мин.', '5 мин.', '10 мин.']);
      assert.deepEqual(popular.filter(m => m[1] === 'true').map(m => m[2]), timeControl === '3 min.' ? ['3 мин.'] : []);
      const more = html.match(/<button\b[^>]*class="mobile-arena-more"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
      assert.match(more, /aria-haspopup="dialog"/);
      assert.match(more, /aria-expanded="false"/);
      assert.ok(more.includes('<span>' + (timeControl === '3 min.' ? 'Ещё' : timeControl.replace(' | ', ' + ')) + '</span>'));
      assert.equal(more.includes('data-selected="true"'), timeControl !== '3 min.');
      assert.equal((html.match(/<button /g) || []).length, 7);
      assert.match(html, /НАЧАТЬ ИГРУ/);
      assert.match(html, /Играть с другом/);
      assert.doesNotMatch(html, /Турниры · скоро/);
      assert.doesNotMatch(html, /role="switch"|Выбрать соперника|arena-quick-times|overflow-y/);
    }
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  }
});
