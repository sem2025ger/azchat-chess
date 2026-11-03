import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../src/routeLoaders.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');

test('first Analysis route is prioritized without altering shared cacheImport and mobile routes', () => {
  assert.match(route, /game: cacheImport\(\(\) => import\('\.\/screens\/GameRoute'\)\)/);
  assert.match(route, /const queue = \['\/game', '\/play'/);
  assert.match(route, /queue\[0\] === '\/game' \? \{ timeout: 1600 \} : undefined/);
  assert.match(route, /queue\[0\] === '\/game' \? 350 : 800/);
  assert.match(route, /connection\?\.saveData/);
  assert.match(route, /currentPath === '\/game' \|\| currentPath === '\/play'/);
});

test('warm UCI starts only after route import finishes, on desktop Home, without immediate pointer startup', () => {
  assert.match(route, /void destinations\[next\]\(\)\.catch\(\(\) => \{\}\)\.then\(\(\) => \{/);
  assert.match(route, /next === '\/game' && \(currentPath === '\/' \|\| currentPath === '\/home'\)/);
  assert.match(route, /window\.matchMedia\('\(min-width: 1024px\)'\)\.matches/);
  assert.match(route, /if \(!cancelled && !document\.hidden\) primeAnalysisEngine\(\)/);
  assert.doesNotMatch(layout, /onPointerEnter=\{\(\) => \{ prefetchRoute\(to\); if \(to === '\/game'\) primeAnalysisEngine/);
  assert.match(layout, /onPointerEnter=\{\(\) => prefetchRoute\(to\)\}/);
});
