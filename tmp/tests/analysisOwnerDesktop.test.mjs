import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const game=source('../src/screens/GameScreen.tsx');
const panel=source('../src/components/AnalysisPanel.tsx');
const css=source('../src/index.css');
const copy=source('../src/components/analysis/copy.ts');
test('review engine has three fixed desktop slots while mobile keeps two',()=>{
  assert.match(panel,/Array\\.from\\(\\{ length: 3 \\}/);
  assert.doesNotMatch(panel,/onPvLinesChange|visiblePvLines|\\[1, 2, 3, 4, 5\\]/);
  assert.match(game,/mode === 'review' && !isDesktop \\? 2 : 3/);
  assert.match(game,/Array\\.from\\(\\{ length: 2 \\}/);
});
test('desktop review status ring and dot are identically sized with reduced motion support',()=>{
  assert.match(panel,/analysis-engine-indicator--working/);
  assert.match(panel,/words\\.engineCalculating : words\\.engineReady/);
  assert.match(css,/analysis-engine-indicator \\{width:18px;height:18px;min-width:18px/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/analysis-engine-indicator--working::before \\{animation:none;display:none/);
});
test('three scores have side-specific compact badges with spacing',()=>{
  assert.match(panel,/data-score-side=\\{!line/);
  assert.match(css,/analysis-engine-variations \\{gap:8px!important/);
  assert.match(css,/analysis-engine-score\\[data-score-side="white"\\]/);
  assert.match(css,/analysis-engine-score\\[data-score-side="black"\\]/);
  assert.match(css,/align-self:center/);
});
test('transport has four buttons and bottom actions preserve New analysis',()=>{
  const nav=game.split('const desktopTransportControls = (')[1].split('const desktopAnalysisTransport =')[0];
  assert.equal((nav.match(/<button type="button"/g)||[]).length,4);
  assert.match(css,/desktop-analysis-transport > button \\{flex:1 1 0!important/);
  assert.match(game,/desktop-analysis-bottom-actions/);
  assert.match(game,/onClick=\\{startNewAnalysis\\}/);
  assert.doesNotMatch(game,/desktop-analysis-review-controls flex/);
});
test('desktop save uses validated game PGN without changing mobile menu',()=>{
  assert.match(game,/annotatedPgn\\(initialFen, moveHistory, evaluations\\)/);
  assert.match(game,/navigator\\.clipboard\\.writeText\\(pgn\\)/);
  assert.match(game,/application\\/x-chess-pgn/);
  assert.match(game,/chessaz-analysis-\\$\\{day\\}\\.pgn/);
  assert.match(game,/link\\.download/);
  for(const lang of ['en','de','az','tr','ua','ru'])assert.match(copy,new RegExp('(?:'+lang+': \\{|const '+lang+' = \\{)'));
});
