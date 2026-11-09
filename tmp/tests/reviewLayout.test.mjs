import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REVIEW_BOARD_GUTTER, reviewLayout } from '../src/utils/reviewLayout.ts';

const inset = REVIEW_BOARD_GUTTER + 1;

test('desktop review matches Home field size and top when space permits', () => {
  for (const [width, height, homeField, homeTop] of [
    [1020, 720, 534, 61.5],
    [1194, 800, 572.5, 22.25],
    [1106, 768, 584.47, 60.27],
    [1180, 900, 606.5, 115.25],
    [1660, 1080, 606.5, 205.25],
  ]) {
    const layout = reviewLayout(width, height, homeField, homeTop);
    assert.equal(layout.boardSize - 2 * inset, homeField);
    assert.equal(layout.topInset + inset, homeTop);
    assert.ok(layout.boardColumn + layout.columnGap + layout.panelWidth + 95 * layout.scale <= width + 1e-9);
  }
});

test('compact review preserves a usable side panel and both labels', () => {
  for (const [width, height, homeField] of [[939, 768, 809.5], [1106, 470, 590]]) {
    const layout = reviewLayout(width, height, homeField, 22.25);
    assert.ok(layout.boardSize > 0 && layout.boardSize - 2 * inset < homeField);
    assert.ok(layout.panelWidth >= 335 - 1e-9);
    assert.ok(layout.topLabel >= 18);
    assert.ok(layout.topInset + layout.boardSize + 36 * layout.scale + 12 <= height + 1e-9);
  }
});

test('desktop panel shares the board height while the top label is outside the layout flow', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const geometry = css.slice(css.indexOf('/* Desktop review geometry:'));
  // Responsive utility classes are emitted later in the production stylesheet.
  // The approved geometry must win over lg:gap-3 and xl:px-6 / lg:pb-1.
  const workspace = geometry.match(/\.desktop-analysis-screen\s*\{([^}]+)\}/)[1];
  assert.match(workspace, /column-gap:\s*var\(--review-column-gap,\s*51px\)\s*!important/);
  assert.match(workspace, /padding:[^;]+calc\(40px\s*\*\s*var\(--review-scale,\s*1\)\)\s*!important/);
  assert.match(workspace, /max-width:\s*none\s*!important/);
  assert.match(geometry, /\.desktop-analysis-player-top\s*\{[^}]*position:\s*absolute;/);
  const panel = geometry.match(/\.desktop-analysis-screen > \.desktop-analysis-panel\s*\{([^}]+)\}/)[1];
  assert.match(panel, /height:\s*var\(--review-board-size,\s*580px\)\s*!important/);
  assert.match(panel, /min-height:\s*0\s*!important/);
  assert.match(panel, /max-height:\s*none\s*!important/);
});

test('desktop Analysis places coordinates in the gutters outside the visible field border', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\)\s*\{[^}]*padding:\s*var\(--analysis-board-gutter\)/);
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\) \.aspect-square\.border\s*\{\s*border-color:\s*#[\da-f]{6};/i);
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\) > \[data-coordinate-axis="rank"\]\s*\{\s*inset-block:\s*calc\(var\(--analysis-board-gutter\) \+ 1px\);\s*width:\s*var\(--analysis-board-gutter\);/);
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\) > \[data-coordinate-axis="file"\]\s*\{\s*inset-inline:\s*calc\(var\(--analysis-board-gutter\) \+ 1px\);\s*height:\s*var\(--analysis-board-gutter\);/);
});
