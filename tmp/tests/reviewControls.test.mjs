import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('real review controls expose five lines and retain their separate scores; depth never resets at the cap', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ru' } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AnalysisPanel } = await server.ssrLoadModule('/src/components/AnalysisPanel.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const lines = Array.from({ length: 5 }, (_, n) => ({ evaluation: (n + 1) / 10, depth: 18, moves: ['e4', 'e5'] }));
    const render = (pvLines, requestedDepth) => renderToStaticMarkup(createElement(LanguageProvider, null,
      createElement(AnalysisPanel, { score: 0.1, depth: 18, lines, reviewLayout: true, pvLines, requestedDepth, onPvLinesChange: () => {}, onIncreaseDepth: () => {} })));
    const five = render(5, 30);
    assert.equal((five.match(/class="analysis-engine-line /g) || []).length, 5);
    assert.equal((five.match(/aria-label="Линий анализа:/g) || []).length, 5);
    for (let n = 1; n <= 5; n++) assert.ok(five.includes(`+0.${n}0`));
    assert.equal((render(1, 24).match(/class="analysis-engine-line /g) || []).length, 1);
    assert.match(render(5, 36), /disabled=""[^>]*title="Увеличить целевую глубину с 36 до 36"/);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
});
