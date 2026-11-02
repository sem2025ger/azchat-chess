import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url),'utf8');
const game=read('../src/screens/GameScreen.tsx');
const panel=read('../src/components/AnalysisPanel.tsx');
const css=read('../src/index.css');
const words=read('../src/components/analysis/copy.ts');
test('review fixes three desktop lines and preserves mobile two lines',()=>{
 assert.ok(panel.includes('Array.from({ length: 3 }'));
 assert.ok(game.includes("mode === 'review' && !isDesktop ? 2 : 3"));
 assert.ok(game.includes('Array.from({ length: 2 }'));
 assert.ok(!panel.includes('onPvLinesChange'));
});
test('engine indicator reuses bronze palette and supports reduced motion',()=>{
 assert.ok(panel.includes('analysis-engine-indicator--working'));
 assert.ok(panel.includes('words.engineCalculating : words.engineReady'));
 assert.ok(css.includes('width:18px;height:18px;min-width:18px'));
 assert.ok(css.includes('analysis-engine-indicator--working::before {animation:none;display:none'));
});
test('badge sides and row spacing are explicit',()=>{
 assert.ok(panel.includes('data-score-side={!line'));
 assert.ok(css.includes('analysis-engine-variations {gap:8px!important'));
 for (const side of ['white','black']) assert.ok(css.includes('data-score-side="'+side+'"'));
 assert.ok(css.includes('align-self:center'));
});
test('navigation is four equal controls and new/save actions below',()=>{
 const nav=game.split('const desktopTransportControls = (')[1].split('const desktopAnalysisTransport =')[0];
 assert.equal(nav.split('<button type="button"').length-1,4);
 assert.ok(css.includes('desktop-analysis-transport > button {flex:1 1 0!important'));
 assert.ok(game.includes('desktop-analysis-bottom-actions'));
 assert.ok(game.includes('onClick={startNewAnalysis}'));
 assert.ok(!game.includes('desktop-analysis-review-controls flex'));
});
test('PGN copy and download use existing exporter and six-language copy',()=>{
 for(const token of ['annotatedPgn(initialFen, moveHistory, evaluations)','navigator.clipboard.writeText(pgn)','application/x-chess-pgn','chessaz-analysis-${day}.pgn','link.download']) assert.ok(game.includes(token),token);
 for(const lang of ['en','de','az','tr','ua','ru'])assert.ok(words.includes(lang==='en'?'const en = {':lang+': {'));
});
