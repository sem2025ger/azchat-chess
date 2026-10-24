import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const panel=readFileSync(new URL('../src/components/AnalysisPanel.tsx',import.meta.url),'utf8');
const mobile=readFileSync(new URL('../src/components/analysis/MobileAnalysis.tsx',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/utils/StockfishEngine.ts',import.meta.url),'utf8');
test('desktop and mobile labels match the installed Stockfish 19 WASM worker', () => {
  assert.match(panel, />Stockfish 19<\/span>/);
  assert.match(mobile, />Stockfish 19<\/span>/);
  assert.match(engine, /new Worker\('\/stockfish-19-lite-single\.js'\)/);
});
