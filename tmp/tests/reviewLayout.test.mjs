import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('approved desktop reference keeps the 716px field, 760px frame, 574px panel and 51px gap', () => {
  const layout = reviewLayout(1560, 880);
  assert.equal(layout.scale, 1);
  assert.equal(layout.boardSize, 760);
  assert.equal(layout.boardSize - 2 * (6 + 16), 716);
  assert.equal(layout.panelWidth, 574);
  assert.equal(layout.columnGap, 51);
  assert.equal(66 + layout.boardColumn + layout.columnGap, 931);
});

test('smaller workspaces scale the approved composition without horizontal or vertical overflow', () => {
  for (const [width, height] of [[1248,704],[1028,912],[912,744],[800,1000],[1560,600]]) {
    const layout = reviewLayout(width,height);
    const s = layout.scale;
    assert.ok(66*s + layout.boardColumn + layout.columnGap + layout.panelWidth <= width);
    assert.ok(10*s + 36*s + layout.boardSize + 36*s <= height);
    assert.ok(Math.abs(layout.boardColumn - layout.boardSize - 54*s) < 1e-9);
    assert.ok(Math.abs(layout.panelWidth / layout.boardSize - 574/760) < 1e-12);
  }
});

test('larger workspaces preserve the approved size instead of growing the board again', () => {
  assert.deepEqual(reviewLayout(2200,1280), reviewLayout(1560,880));
});

test('desktop panel shares the board height and the top player-row offset', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const geometry = css.slice(css.indexOf('/* Desktop review geometry:'));
  assert.match(geometry, /:has\(\.desktop-analysis-player-top\)\s*>\s*\.desktop-analysis-panel\s*\{\s*margin-top:\s*calc\(36px\s*\*\s*var\(--review-scale,\s*1\)\)\s*!important;/);
  const panel = geometry.match(/\.desktop-analysis-screen > \.desktop-analysis-panel\s*\{([^}]+)\}/)[1];
  assert.match(panel, /height:\s*var\(--review-board-size,\s*580px\)\s*!important/);
  assert.match(panel, /min-height:\s*0\s*!important/);
  assert.match(panel, /max-height:\s*none\s*!important/);
});
