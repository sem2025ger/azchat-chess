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
