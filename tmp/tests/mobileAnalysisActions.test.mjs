import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('mobile export actions stay in a closed accessible dialog and desktop keeps its original toolbar', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ru' } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Header } = await server.ssrLoadModule('/src/components/analysis/AnalysisWorkspaceHeader.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const render = compact => renderToStaticMarkup(createElement(LanguageProvider, null, createElement(Header, {
      compact, title: '', initialFen: '', currentFen: '', moveHistory: [], evaluations: {}, onNew() {}, onEdit() {}, editing: false,
    })));
    const mobile = render(true);
    assert.match(mobile, /aria-label="Действия анализа" aria-haspopup="dialog"/);
    assert.match(mobile, /<dialog[^>]*aria-label="Действия анализа"/);
    assert.doesNotMatch(mobile, /<dialog[^>]*\sopen[\s=>]/);
    assert.match(mobile, /disabled=""[^>]*>[\s\S]*?PGN с оценками/);
    for (const label of ['FEN', 'Поделиться', 'Новый анализ']) assert.ok(mobile.includes(label));
    assert.doesNotMatch(mobile, /Редактор доски/);
    const desktop = render(false);
    assert.match(desktop, /analysis-redesign-header/);
    assert.match(desktop, /Редактор доски/);
    assert.doesNotMatch(desktop, /<dialog/);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
});
