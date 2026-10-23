import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync(new URL('../src/screens/GameScreen.tsx', import.meta.url), 'utf8');

test('mobile review provides map, saved games and position editing without resizing chessboard', () => {
  assert.match(game, /data-mobile-analysis-tools/);
  for (const tool of ["'map'", "'games'", "'position'"]) assert.ok(game.includes(tool));
  assert.match(game, /data-mobile-analysis-dialog/);
  assert.match(game, /showModal\(\)/);
  assert.match(game, /<SavedGamesPanel key=/);
  assert.match(game, /<PositionMap key=/);
  assert.match(game, /<PositionTools currentFen=/);
  assert.match(game, /data-mobile-position-editor/);
  assert.match(game, /<EditorBoard draft=\{positionDraftValue\}/);
});

test('mobile actions preserve existing desktop analysis and live game boundaries', () => {
  assert.match(game, /mode === 'review' && mobileTool &&/);
  assert.match(game, /className="lg:hidden mx-2 mb-1 mobile-analysis-tools/);
  assert.match(game, /className="desktop-analysis-workspace-tabs hidden lg:flex/);
  assert.match(game, /handleMobileMapHighlight/);
  assert.match(game, /setMobileTool\(null\)/);
  assert.match(game, /onCancel=\{\(\) => \{ setMobileTool\(null\); setEditingPosition\(false\); \}\}/);
});

test('review keeps its board square and orders details after move navigation', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(game.indexOf('className="mobile-analysis-details') > game.indexOf('aria-label="Move navigation"'));
  assert.match(game, /currentEngineResult \? analysisData\?\.lines/);
  assert.match(game, /mode === 'review' && analysisWorkspaceHeader\(true\)/);
  assert.match(css, /@media \(max-width: 767px\) \{[\s\S]*?\.desktop-analysis-screen\.desktop-analysis-screen \{[^}]*height:auto;[^}]*overflow:visible/);
  assert.match(css, /\.desktop-analysis-screen \.desktop-analysis-board-frame \{[^}]*aspect-ratio:1 \/ 1 !important;[^}]*flex-shrink:0/);
});
