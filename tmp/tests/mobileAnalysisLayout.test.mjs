import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('mobile analysis keeps scores, move indices and export actions in their dedicated controls', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ru' } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { MobileAnalysisHeader, MobileAnalysisDetails } = await server.ssrLoadModule('/src/components/analysis/MobileAnalysis.tsx');
    const { default: Header } = await server.ssrLoadModule('/src/components/analysis/AnalysisWorkspaceHeader.tsx');
    const render = child => renderToStaticMarkup(createElement(LanguageProvider, null, child));
    const noop = () => {};
    const header = render(createElement(MobileAnalysisHeader, {
      activeTab:'analysis', onTab:noop,
      actions:createElement(Header, { mobile:true, onMobileTool:noop, mobileDepth:18, onMobileDepth:noop, title:'', initialFen:'', moveHistory:['e4'], currentFen:'', onNew:noop, onEdit:noop, editing:false, evaluations:{} }),
    }));
    assert.equal((header.match(/data-mobile-tool=/g) || []).length, 3);
    assert.doesNotMatch(header.split('<dialog')[0], /data-mobile-tool=|mobile-analysis-tools|<svg[^>]*lucide-cpu/);
    assert.match(header, /mobile-analysis-engine">Stockfish 18<\/span>/);
    assert.match(header, /aria-haspopup="dialog"/);
    assert.match(header, /<dialog[^>]*mobile-analysis-actions-dialog/);
    assert.equal((header.match(/>Копировать FEN<\/button>/g) || []).length, 1);
    assert.doesNotMatch(header.split('<dialog')[0], /PGN|FEN|Новый анализ/);
    const props = { activeTab:'analysis', result:null, loading:true, failed:false, moves:[], currentIndex:0, onMove:noop, depth:18 };
    const waiting = render(createElement(MobileAnalysisDetails, props));
    assert.match(waiting, /mobile-analysis-score">—</);
    assert.match(waiting, /id="mobile-engine-lines"/);
    assert.equal((waiting.match(/data-mobile-engine-line/g) || []).length, 2);
    assert.doesNotMatch(waiting, /hidden=|aria-expanded=|mobile-analysis-engine-controls/);
    assert.doesNotMatch(waiting, /mobile-analysis-score">0\.00/);
    const lines = [{evaluation:1.2, moves:['1.','e4']}, {evaluation:-2.1, moves:['1.','d4']},
      {evaluation:3.4, moves:['1.','Nf3']}, {evaluation:4.5, moves:['1.','c4']}, {evaluation:5.6, moves:['1.','g3']}];
    const ready = render(createElement(MobileAnalysisDetails, { ...props, result:{ evaluation:1.2, depth:12 }, lines }));
    assert.match(ready, /\+1\.20/);
    assert.match(ready, /-2\.10/);
    assert.equal((ready.match(/data-mobile-engine-line/g) || []).length, 2);
    assert.doesNotMatch(ready, /\+3\.40|\+4\.50|\+5\.60|Nf3|aria-pressed=/);
    const failed = render(createElement(MobileAnalysisDetails, { ...props, failed:true, loading:false }));
    assert.equal((failed.match(/mobile-analysis-score">—</g) || []).length, 2);
    assert.doesNotMatch(failed, /0\.00/);
    const moves = render(createElement(MobileAnalysisDetails, { ...props, activeTab:'moves', currentIndex:1, moves:[{n:17,w:'',b:'Kf7',wIndex:0,bIndex:1}] }));
    assert.match(moves, /17\.<\/th>/);
    assert.match(moves, /aria-current="step">Kf7<\/button>/);
    assert.equal((moves.match(/<button/g) || []).length, 1);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
});
