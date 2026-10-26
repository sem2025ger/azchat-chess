import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const header=readFileSync(new URL('../src/components/analysis/AnalysisWorkspaceHeader.tsx',import.meta.url),'utf8');
const screen=readFileSync(new URL('../src/screens/GameScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');

test('desktop review consolidates actions without duplicating New analysis',()=>{
  const desktop=header.slice(header.indexOf('  return (\n    <header className="analysis-redesign-header"'));
  assert.match(desktop,/className="analysis-redesign-menu"/);
  assert.match(desktop,/<summary aria-label={words.more}/);
  assert.match(desktop,/words.pgn/);
  assert.match(desktop,/words.fen/);
  assert.match(desktop,/words.editor/);
  assert.match(desktop,/words.share/);
  assert.doesNotMatch(desktop,/onClick={onNew}/);
  assert.match(screen,/desktop-analysis-new-button/);
});

test('desktop menu keeps keyboard escape, focus and existing callback wiring',()=>{
  assert.match(header,/event.key === 'Escape'/);
  assert.match(header,/aria-pressed={editing}/);
  assert.match(header,/onEdit\(\)/);
  assert.match(header,/exportPgn\(\)/);
  assert.match(header,/copy\('fen', currentFen\)/);
  assert.match(header,/void share\(\)/);
});

test('analysis graphite override is scoped to desktop',()=>{
  assert.match(css,/Desktop Analysis refinement: calm graphite palette/);
  assert.match(css,/\.desktop-analysis-screen \.analysis-redesign-menu-list/);
  assert.match(css,/overflow:visible!important/);
});
