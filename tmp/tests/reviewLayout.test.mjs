import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('desktop board and panel use the available width with a fixed 24px gap', () => {
  for (const [width, height, header] of [[1584,1056,60],[1028,912,78],[912,744,96],[2200,1280,60]]) {
    const layout = reviewLayout(width,height,header);
    assert.equal(layout.boardColumn + layout.columnGap + layout.panelWidth, width);
    assert.equal(layout.columnGap, 24);
    assert.ok(layout.boardSize + header + 12 <= height);
    assert.ok(layout.panelWidth >= 335);
    assert.equal(layout.boardColumn - layout.boardSize, 44);
    // Either height or minimum panel width constrains the square: no arbitrary 630px cap.
    assert.ok(height - header - 12 - layout.boardSize < 1 || layout.panelWidth < (width >= 1300 ? 401 : 336));
  }
  assert.ok(reviewLayout(1584,1056,60).boardSize > 900);
});

test('a wrapped header reduces the square instead of pushing it below the viewport', () => {
  const short = reviewLayout(1584,1056,60);
  const wrapped = reviewLayout(1584,1056,120);
  assert.equal(short.boardSize - wrapped.boardSize, 60);
  assert.equal(short.columnGap, wrapped.columnGap);
});
