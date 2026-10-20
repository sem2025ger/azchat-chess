import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('board fills available space independently of the toolbar inside the right panel', () => {
  for (const [width, height] of [[1584,1056],[1028,912],[912,744],[2200,1280]]) {
    const layout = reviewLayout(width,height);
    assert.ok(layout.boardColumn + layout.columnGap + layout.panelWidth <= width);
    assert.equal(layout.columnGap, 64);
    assert.ok(layout.boardSize + 72 <= height);
    assert.ok(layout.panelWidth >= 280);
    assert.ok(layout.panelWidth <= 440);
    assert.equal(layout.boardColumn - layout.boardSize, 44);
    assert.equal(layout.boardSize, Math.floor(Math.min(height-72, width-64-44-(width >= 1300 ? 360 : 280))));
  }
});

test('removing the toolbar row restores all available height to a height-limited board', () => {
  const layout = reviewLayout(1584,1056);
  assert.equal(layout.boardSize, 984);
});

test('narrow desktop layouts preserve the panel and spacing without horizontal overflow', () => {
  const layout = reviewLayout(800,1000);
  assert.equal(layout.boardSize, 412);
  assert.equal(layout.boardColumn + layout.columnGap + layout.panelWidth, 800);
});
