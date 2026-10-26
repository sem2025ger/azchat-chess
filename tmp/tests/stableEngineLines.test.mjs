import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

test('review PV positions remain present before evaluation and through new searches', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ru' } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Panel } = await server.ssrLoadModule('/src/components/AnalysisPanel.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const render = (lines, pvLines = 3) => renderToStaticMarkup(createElement(LanguageProvider, null,
      createElement(Panel, { score: 0, depth: 0, reviewLayout: true, pvLines, lines, loading: !lines?.length })));
    const absent = render(undefined);
    const initial = render([{ evaluation: .13, depth: 8, moves: ['1.', 'e4'] }]);
    const ready = render([
      { evaluation: .13, depth: 16, moves: ['e4', 'e5'] },
      { evaluation: -.25, depth: 16, moves: ['d4', 'd5'] },
      { evaluation: 0, mate: 3, depth: 16, moves: ['Nf3'] },
    ]);
    for (const html of [absent, initial, ready]) {
      assert.equal((html.match(/class="analysis-engine-line /g) || []).length, 3);
      assert.deepEqual([...html.matchAll(/data-engine-slot="(\d+)"/g)].map(x => x[1]), ['1', '2', '3']);
      assert.equal((html.match(/class="analysis-engine-score /g) || []).length, 3);
    }
    assert.equal((absent.match(/>—<\/div>/g) || []).length, 3, 'new position reserves three blank scores');
    assert.match(initial, /\+0\.13/);
    assert.match(ready, /-0\.25/);
    assert.match(ready, /M3/);
    assert.equal((render([], 5).match(/data-engine-slot=/g) || []).length, 5);
    assert.equal((render([], 1).match(/data-engine-slot=/g) || []).length, 1);
  } finally {
    await server.close();
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage;
  }
});

test('desktop and mobile score geometry is fixed without changing board layout', async () => {
  const [desktop, mobile] = await Promise.all([
    readFile('src/index.css', 'utf8'),
    readFile('src/components/analysis/mobileAnalysis.css', 'utf8'),
  ]);
  assert.match(desktop, /\.desktop-analysis-screen \.desktop-analysis-stockfish \{\s*height: clamp\(228px, 47%, 282px\) !important/);
  assert.match(desktop, /\.desktop-analysis-screen \.analysis-engine-score \{[\s\S]*?width: 70px !important/);
  assert.match(desktop, /\.desktop-analysis-screen \.analysis-engine-score \{[\s\S]*?background: linear-gradient\([^\n]+\) !important/);
  assert.match(mobile, /\.mobile-analysis-score \{[\s\S]*?width: 68px/);
  assert.match(mobile, /\.mobile-analysis-score \{[\s\S]*?font-variant-numeric: tabular-nums/);
});
