import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REVIEW_BOARD_GUTTER, REVIEW_TOP_CLEARANCE, reviewLayout } from '../src/utils/reviewLayout.ts';

const inset = REVIEW_BOARD_GUTTER + 1;

test('desktop review matches Home field size and top when space permits', () => {
  for (const [width, height, homeField, homeTop] of [
    [1020, 720, 534, 61.5],
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

test('compact review places its upper label in the panel and keeps the Home field top', () => {
  for (const [width, height, homeField, homeTop] of [[939, 768, 809.5, 22.25], [1194, 800, 572.5, 22.25], [1106, 470, 590, 22.25]]) {
    const layout = reviewLayout(width, height, homeField, homeTop, true);
    assert.ok(layout.boardSize > 0 && layout.boardSize - 2 * inset <= homeField);
    assert.ok(Math.abs(layout.topInset + inset - homeTop) < 1e-9);
    assert.ok(layout.panelWidth >= 335 - 1e-9);
    assert.ok(layout.topInset + layout.boardSize + 36 * layout.scale + 12 <= height + 1e-9);
  }
});

test('Home anchor is clamped to leave room for the analysis panel', () => {
  const reference = reviewLayout(1660, 880, 588, 118, false, false, 260);
  assert.ok(reference.leftInset > 40);
  assert.ok(Math.abs(reference.leftInset + 54 * reference.scale + REVIEW_BOARD_GUTTER - 260) < 0.1);
  const constrained = reviewLayout(1106, 768, 584, 60, true, false, 900);
  assert.ok(constrained.leftInset >= 0);
  assert.ok(constrained.leftInset + constrained.boardColumn + constrained.columnGap +
    constrained.panelWidth + 20 * constrained.scale <= 1106 + 0.01);
});

test('player names reserve space only for loaded games', () => {
  const plain = reviewLayout(1366, 768, 584.47, 60.27);
  const named = reviewLayout(1366, 768, 584.47, 60.27, false, true);
  assert.equal(plain.topInset + inset, 60.27);
  assert.ok(named.topInset >= plain.topInset);
  assert.ok(named.topInset - named.topLabel >= REVIEW_TOP_CLEARANCE);
  const compactPlain = reviewLayout(1194, 800, 572.5, 22.25, true);
  const compactNamed = reviewLayout(1194, 800, 572.5, 22.25, true, true);
  assert.equal(compactPlain.topInset + inset, 22.25);
  assert.ok(compactNamed.topInset > compactPlain.topInset);
});

test('wide review preserves upper player label clearance', () => {
  const layout = reviewLayout(1660, 1080, 606.5, 205.25);
  assert.ok(layout.topInset - layout.topLabel >= REVIEW_TOP_CLEARANCE);
});

test('desktop panel shares the board height while the top label is outside the layout flow', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const geometry = css.slice(css.indexOf('/* Desktop review geometry:'));
  // Responsive utility classes are emitted later in the production stylesheet.
  // The approved geometry must win over lg:gap-3 and xl:px-6 / lg:pb-1.
  const workspace = geometry.match(/\.desktop-analysis-screen\s*\{([^}]+)\}/)[1];
  assert.match(workspace, /column-gap:\s*var\(--review-column-gap,\s*51px\)\s*!important/);
  assert.match(workspace, /padding:[^;]+var\(--review-left-inset,\s*calc\(40px\s*\*\s*var\(--review-scale,\s*1\)\)\)\s*!important/);
  assert.match(workspace, /max-width:\s*none\s*!important/);
  assert.match(geometry, /\.desktop-analysis-player-top\s*\{[^}]*position:\s*absolute;/);
  const panel = geometry.match(/\.desktop-analysis-screen > \.desktop-analysis-panel\s*\{([^}]+)\}/)[1];
  assert.match(panel, /height:\s*var\(--review-board-size,\s*580px\)\s*!important/);
  assert.match(panel, /min-height:\s*0\s*!important/);
  assert.match(panel, /max-height:\s*none\s*!important/);
  assert.match(css, /\.desktop-analysis-screen > \.desktop-analysis-panel\s*\{\s*margin-top:var\(--review-board-gutter, 16px\)!important;\s*height:calc\(var\(--review-board-size, 580px\) - 2 \* var\(--review-board-gutter, 16px\)\)!important;/);
  assert.match(css, /\.desktop-analysis-screen \.desktop-analysis-evaluation\s*\{[^}]*margin-top:\s*calc\(var\(--review-board-gutter, 16px\) \+ 1px\);[^}]*height:\s*calc\(var\(--review-board-size, 580px\) - 2 \* \(var\(--review-board-gutter, 16px\) \+ 1px\)\);/);
  assert.match(css, /\.desktop-analysis-screen \.desktop-analysis-compact-opponent\s*\{\s*display:flex;/);
});

test('desktop Analysis places coordinates in the gutters outside the visible field border', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\)\s*\{[^}]*padding:\s*var\(--analysis-board-gutter\)/);
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\) \.aspect-square\.border\s*\{\s*border-color:\s*#[\da-f]{6};/i);
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\) > \[data-coordinate-axis="rank"\]\s*\{\s*inset-block:\s*calc\(var\(--analysis-board-gutter\) \+ 1px\);\s*width:\s*calc\(var\(--analysis-board-gutter\) - 4px\);/);
  assert.match(css, /\.desktop-analysis-main-board, \.desktop-editor-board\) > \[data-coordinate-axis="file"\]\s*\{\s*inset-inline:\s*calc\(var\(--analysis-board-gutter\) \+ 1px\);\s*bottom:\s*-2px;\s*height:\s*calc\(var\(--analysis-board-gutter\) - 3px\);/);
});
