import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// The same header serves desktop and mobile: protect the independent mobile actions.
test('desktop has four disclosure actions and no duplicate reset; mobile retains its reset', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{ getItem:() => 'ru' } });
  const server = await createServer({ optimizeDeps:{ noDiscovery:true, include:[] }, server:{ middlewareMode:true, hmr:false }, appType:'custom' });
  try {
    const { default:Header } = await server.ssrLoadModule('/src/components/analysis/AnalysisWorkspaceHeader.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const render = (mobile = false, moves = []) => renderToStaticMarkup(createElement(LanguageProvider, null,
      createElement(Header, { title:'', initialFen:'', currentFen:'', moveHistory:moves, evaluations:{},
        onNew:() => {}, onEdit:() => {}, editing:false, mobile, onMobileTool:() => {} })));
    const desktop = render();
    assert.match(desktop, /popoverTarget="[^"]+"/i);
    assert.match(desktop, /popover="auto"[^>]*role="group"/);
    assert.match(desktop, /aria-expanded="false"/);
    assert.equal((desktop.match(/<button/g) || []).length, 5, 'one trigger and four actions');
    for (const label of ['Копировать FEN','Редактор доски','Поделиться позицией','Копировать PGN с оценками']) assert.ok(desktop.includes(label));
    assert.doesNotMatch(desktop, /Новый анализ|New analysis|analysis-redesign-reset/);
    assert.match(desktop, /<button[^>]*disabled=""[^>]*><svg[^]*?Копировать PGN с оценками/);
    assert.doesNotMatch(render(false, ['e4']), /disabled=""/);
    assert.match(render(true), /data-mobile-new-analysis/);
    assert.match(render(true), /mobile-analysis-actions-dialog/);
  } finally {
    await server.close();
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage;
  }
});
