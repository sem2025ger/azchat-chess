import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../src/screens/GameScreen.tsx', import.meta.url), 'utf8');

test('position-map UI stays out of the initial Analysis route chunk', () => {
  assert.doesNotMatch(screen, /^import PositionMap(?:Variations)? from /m);
  assert.match(screen, /const PositionMap = lazy\(\(\) => import\('\.\.\/components\/analysis\/PositionMap'\)\)/);
  assert.match(screen, /const PositionMapVariations = lazy\(\(\) => import\('\.\.\/components\/analysis\/PositionMapVariations'\)\)/);
  assert.match(screen, /mobileTool === 'map' && \(/);
  assert.match(screen, /workspaceTab === 'map' && /);
  assert.match(screen, /<Suspense fallback=/);
});

test('existing analysis view and move handling remain in GameScreen', () => {
  assert.match(screen, /<ChessBoard/);
  assert.match(screen, /acquireAnalysisEngine\(\)/);
  assert.match(screen, /playAnalysisMoveAtView\(/);
  assert.match(screen, /mode === 'review'/);
});
