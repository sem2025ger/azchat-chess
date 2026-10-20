import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('desktop review maximizes the board while reserving labels and a 48px panel gap', () => {
  for (const [width, height, header] of [[1584,1056,60],[1028,912,78],[912,744,96],[2200,1280,60]]) {
    const layout = reviewLayout(width,height,header);
    assert.equal(layout.boardColumn + layout.columnGap + layout.panelWidth, width);
    assert.equal(layout.columnGap, 48);
    assert.ok(layout.boardSize + header + 12 + 72 <= height);
    assert.ok(layout.panelWidth >= 335);
    assert.equal(layout.boardColumn - layout.boardSize, 44);
    assert.equal(layout.boardSize, Math.floor(Math.min(height-header-12-72, width-48-44-(width >= 1300 ? 400 : 335))));
  }
  assert.ok(reviewLayout(1584,1056,60).boardSize > 888);
});

test('a wrapped header keeps both colour rows within the viewport', () => {
  const short = reviewLayout(1584,1056,60);
  const wrapped = reviewLayout(1584,1056,120);
  assert.equal(short.boardSize - wrapped.boardSize, 60);
  assert.equal(short.columnGap, wrapped.columnGap);
});
