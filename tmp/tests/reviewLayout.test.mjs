import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('desktop reference keeps a 692px field, 736px square frame and 630px panel', () => {
  const layout = reviewLayout(1560, 880);
  assert.equal(layout.scale, 1);
  assert.equal(layout.boardSize, 736);
  assert.equal(layout.boardSize - 2 * (6 + 16), 692);
  assert.equal(layout.panelWidth, 630);
  assert.equal(layout.columnGap, 51);
  assert.equal(40 + layout.boardColumn + layout.columnGap, 881);
});

test('smaller workspaces enlarge the board within the available height and keep the panel anchored', () => {
  for (const [width, height] of [[1248,704],[1028,912],[912,744],[800,1000],[1560,600]]) {
    const layout = reviewLayout(width,height);
    const s = layout.scale;
    const originalBoardSize = 736 * s;
    assert.ok(40*s + layout.boardColumn + layout.columnGap + layout.panelWidth + 45*s <= width);
    assert.ok(32 + (10 + 36 + 36)*s + layout.boardSize <= height);
    assert.ok(layout.boardSize > originalBoardSize && layout.boardSize <= 736);
    assert.ok(layout.columnGap >= 19*s - 1e-9);
    assert.ok(Math.abs(layout.boardColumn - layout.boardSize - 54*s) < 1e-9);
    assert.ok(Math.abs(layout.boardColumn + layout.columnGap - (736 + 54 + 51)*s) < 1e-9);
    assert.equal(layout.panelWidth, 630*s);
  }
});

test('a short desktop window can reclaim more gutter as height becomes available at the same scale', () => {
  const short = reviewLayout(800, 454);
  const taller = reviewLayout(800, 500);
  assert.equal(short.scale, taller.scale);
  assert.ok(short.boardSize < taller.boardSize);
});

test('larger workspaces preserve the approved size instead of growing the board again', () => {
  assert.deepEqual(reviewLayout(2200,1280), reviewLayout(1560,880));
});

test('desktop panel shares the board height and the top player-row offset', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const geometry = css.slice(css.indexOf('/* Desktop review geometry:'));
  // Responsive utility classes are emitted later in the production stylesheet.
  // The approved geometry must win over lg:gap-3 and xl:px-6 / lg:pb-1.
  const workspace = geometry.match(/\.desktop-analysis-screen\s*\{([^}]+)\}/)[1];
  assert.match(workspace, /column-gap:\s*var\(--review-column-gap,\s*51px\)\s*!important/);
  assert.match(workspace, /padding:[^;]+calc\(40px\s*\*\s*var\(--review-scale,\s*1\)\)\s*!important/);
  assert.match(workspace, /max-width:\s*none\s*!important/);
  assert.match(geometry, /:has\(\.desktop-analysis-player-top\)\s*>\s*\.desktop-analysis-panel\s*\{\s*margin-top:\s*calc\(36px\s*\*\s*var\(--review-scale,\s*1\)\)\s*!important;/);
  const panel = geometry.match(/\.desktop-analysis-screen > \.desktop-analysis-panel\s*\{([^}]+)\}/)[1];
  assert.match(panel, /height:\s*var\(--review-board-size,\s*580px\)\s*!important/);
  assert.match(panel, /min-height:\s*0\s*!important/);
  assert.match(panel, /max-height:\s*none\s*!important/);
});
