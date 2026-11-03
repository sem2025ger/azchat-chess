import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync(new URL('../src/screens/GameScreen.tsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../src/routeLoaders.ts', import.meta.url), 'utf8');

test('review geometry is measured before browser paint', () => {
  assert.match(game, /useLayoutEffect\(\(\) => \{\s*if \(mode !== 'review'/);
  assert.match(game, /new ResizeObserver\(measure\)/);
  assert.match(game, /mode === 'review' \|\| typeof ResizeObserver/);
});

test('analysis mount does not animate board or panel', () => {
  assert.match(game, /mode === 'review' \? "desktop-analysis-screen" : "animate-fade-in transition-all"/);
  assert.match(game, /mode === 'review' \? "desktop-analysis-board-column" : "animate-scale-up"/);
  assert.match(game, /mode === 'review' \? "desktop-analysis-panel" : "animate-fade-in-right transition-all"/);
  assert.match(game, /mode !== 'review' && "transition-\[width\] duration-300"/);
  assert.match(game, /mode !== 'review' && "transition-all duration-1000 ease-in-out"/);
});

test('analysis bundle is cached and included in idle navigation prefetch', () => {
  assert.match(routes, /game: cacheImport\(\(\) => import\('\.\/screens\/GameRoute'\)\)/);
  assert.match(routes, /const queue = \['\/game', '\/play'/);
});

test('first desktop Home navigation prioritizes cached Analysis chunk with a bounded idle wait', () => {
  assert.match(routes, /const queue = \['\/game', '\/play'/);
  assert.match(routes, /queue\[0\] === '\/game' \? \{ timeout: 1600 \} : undefined/);
  assert.match(routes, /queue\[0\] === '\/game' \? 350 : 800/);
  assert.match(routes, /next === '\/game' && \(currentPath === '\/' \|\| currentPath === '\/home'\)/);
  assert.match(routes, /idleHandle = window\.requestIdleCallback\(warm, \{ timeout: 1800 \}\)/);
  assert.match(routes, /if \(!cancelled && !document\.hidden\) primeAnalysisEngine\(\)/);
  assert.match(routes, /if \(cancelled\) return;/);
});

test('Analysis navigation events do not start a cold UCI worker on the click path', () => {
  const layout = fs.readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /onPointerDown=\{\(\) => prefetchRoute\(to\)\}/);
  assert.doesNotMatch(layout, /onPointerDown=\{[^\n]*primeAnalysisEngine/);
  assert.match(routes, /connection\?\.saveData/);
  assert.match(routes, /currentPath === '\/game' \|\| currentPath === '\/play'/);
});
