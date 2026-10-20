import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('board uses ninety percent of its previous size without the toolbar reserving space', () => {
  for (const [width, height] of [[1584,1056],[1028,912],[912,744],[2200,1280]]) {
    const layout = reviewLayout(width,height);
    assert.ok(layout.boardColumn + layout.columnGap + layout.panelWidth <= width);
    assert.equal(layout.columnGap, 64);
    assert.ok(layout.boardSize + 72 <= height);
    assert.ok(layout.panelWidth >= 300);
    assert.ok(layout.panelWidth <= 460);
    assert.equal(layout.boardColumn - layout.boardSize, 44);
    assert.equal(layout.boardSize, Math.floor(Math.floor(Math.min(height-72, width-64-44-(width >= 1300 ? 380 : 300))) * 0.9));
  }
});

test('scaling a height-limited board preserves the right panel width', () => {
  const layout = reviewLayout(1584,1056);
  assert.equal(layout.boardSize, 885);
  assert.equal(layout.panelWidth, 460);
});

test('narrow desktop layouts preserve the panel and spacing without horizontal overflow', () => {
  const layout = reviewLayout(800,1000);
  assert.equal(layout.boardSize, 352);
  assert.equal(layout.panelWidth, 300);
  assert.ok(layout.boardColumn + layout.columnGap + layout.panelWidth <= 800);
});
