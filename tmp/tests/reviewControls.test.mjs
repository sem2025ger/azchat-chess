import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('real review controls show exactly three lines and retain separate scores; depth never resets at the cap', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'ru' } });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AnalysisPanel } = await server.ssrLoadModule('/src/components/AnalysisPanel.tsx');
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const lines = Array.from({ length: 3 }, (_, n) => ({ evaluation: (n + 1) / 10, depth: 18, moves: ['e4', 'e5'] }));
    const render = (_pvLines, requestedDepth) => renderToStaticMarkup(createElement(LanguageProvider, null,
      createElement(AnalysisPanel, { score: 0.1, depth: 18, lines, reviewLayout: true, requestedDepth, onIncreaseDepth: () => {} })));
    const three = render(3, 30);
    assert.equal((three.match(/class="analysis-engine-line /g) || []).length, 3);
    assert.equal((three.match(/aria-label="Линий анализа:/g) || []).length, 0);
    for (let n = 1; n <= 3; n++) assert.ok(three.includes(`+0.${n}0`));
    assert.equal((render(1, 24).match(/class="analysis-engine-line /g) || []).length, 3);
    assert.match(render(5, 36), /disabled=""[^>]*title="Увеличить целевую глубину с 36 до 36"/);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else delete globalThis.localStorage;
  }
});

test('depth action and tooltip are localized in all six existing analysis languages',async()=>{
  const {createElement}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {createServer}=await import('vite');
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let selected='ru';
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>selected}});
  const vite=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
  const expected={
    en:['Deeper','Increase target depth from 24 to 30'],
    de:['Tiefer','Zieltiefe von 24 auf 30 erhöhen'],
    az:['Daha dərin','Hədəf dərinliyini 24-dən 30-yə artır'],
    tr:['Daha derin','Hedef derinliği 24 seviyesinden 30 seviyesine artır'],
    ua:['Глибше','Збільшити цільову глибину з 24 до 30'],
    ru:['Глубже','Увеличить целевую глубину с 24 до 30'],
  };
  try {
    const {default:AnalysisPanel}=await vite.ssrLoadModule('/src/components/AnalysisPanel.tsx');
    const {LanguageProvider}=await vite.ssrLoadModule('/src/context/LanguageContext.tsx');
    const props={score:0,depth:18,reviewLayout:true,requestedDepth:24,onIncreaseDepth:()=>{}};
    for(const [lang,[label,hint]] of Object.entries(expected)){
      selected=lang;
      const html=renderToStaticMarkup(createElement(LanguageProvider,null,createElement(AnalysisPanel,props)));
      assert.ok(html.includes('>'+label+'</button>'),lang+' button label');
      assert.ok(html.includes('title="'+hint+'"'),lang+' localized depth hint');
      assert.equal((html.match(/data-engine-slot=/g)||[]).length,3,'three PV slots unchanged');
    }
    selected='de';
    const max=renderToStaticMarkup(createElement(LanguageProvider,null,createElement(AnalysisPanel,{...props,requestedDepth:36})));
    assert.match(max,/disabled=""[^>]*title="Zieltiefe von 36 auf 36 erhöhen"/);
  } finally {
    await vite.close();
    if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;
  }
});

test('postgame analysis reserves three keyboard-readable PV slots while loading and changing line lengths', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{getItem:()=>'ru'} });
  const server = await createServer({ optimizeDeps:{noDiscovery:true,include:[]}, server:{middlewareMode:true,hmr:false}, appType:'custom' });
  try {
    const {default:AnalysisPanel} = await server.ssrLoadModule('/src/components/AnalysisPanel.tsx');
    const {LanguageProvider} = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    for (const lines of [undefined, [], [{evaluation:0.2,depth:8,moves:['1.','e4']}], Array.from({length:4},(_,index)=>({evaluation:index ? -0.3 : 0.2,depth:24,moves:Array(40).fill('Nf3')}))]) {
      const html = renderToStaticMarkup(createElement(LanguageProvider,null,createElement(AnalysisPanel,{score:0,depth:0,loading:true,stableLines:true,lines})));
      assert.equal((html.match(/data-engine-slot=/g)||[]).length,3);
      assert.equal((html.match(/tabindex="0"/g)||[]).length,3);
    }
  } finally {
    await server.close();
    if (original) Object.defineProperty(globalThis,'localStorage',original); else delete globalThis.localStorage;
  }
});
