import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout } from '../src/utils/reviewLayout.ts';

test('desktop review maximizes the board while reserving labels and a 64px panel gap', () => {
  for (const [width, height, header] of [[1584,1056,60],[1028,912,78],[912,744,96],[2200,1280,60]]) {
    const layout = reviewLayout(width,height,header);
    assert.ok(layout.boardColumn + layout.columnGap + layout.panelWidth <= width);
    assert.equal(layout.columnGap, 64);
    assert.ok(layout.boardSize + header + 12 + 72 - 24 <= height);
    assert.ok(layout.panelWidth >= 280);
    assert.ok(layout.panelWidth <= 440);
    assert.equal(layout.boardColumn - layout.boardSize, 44);
    const previous = Math.floor(Math.min(height-header-12-72, width-48-44-(width >= 1300 ? 400 : 335)));
    assert.ok(layout.boardSize >= previous);
    assert.ok(layout.boardSize <= Math.floor(previous * 1.1) + 1);
  }
  assert.ok(reviewLayout(1584,1056,60).boardSize > 888);
});

test('a wrapped header keeps both colour rows within the viewport', () => {
  const short = reviewLayout(1584,1056,60);
  const wrapped = reviewLayout(1584,1056,120);
  assert.equal(short.boardSize - wrapped.boardSize, 60);
  assert.equal(short.columnGap, wrapped.columnGap);
});

test('width-limited boards gain ten percent when the viewport has enough vertical room', () => {
  const layout = reviewLayout(800, 1000, 60);
  assert.equal(layout.boardSize, Math.floor((800 - 48 - 44 - 335) * 1.1));
});
