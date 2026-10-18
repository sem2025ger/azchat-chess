import test from 'node:test';
import assert from 'node:assert/strict';
import { squareAtPoint } from '../src/utils/boardCoordinates.ts';

test('all 64 square centres map correctly for both orientations on an offset, scaled board', () => {
  const rect = { left: 125.5, top: 73.25, width: 504, height: 632 };
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = rect.left + (col + 0.5) * rect.width / 8;
      const y = rect.top + (row + 0.5) * rect.height / 8;
      assert.equal(squareAtPoint(x, y, rect, 'w'), `${'abcdefgh'[col]}${8 - row}`);
      assert.equal(squareAtPoint(x, y, rect, 'b'), `${'hgfedcba'[col]}${row + 1}`);
    }
  }
});

test('dropping outside the board is rejected rather than clamped to a legal edge square', () => {
  const rect = { left: 100, top: 200, width: 400, height: 400 };
  for (const [x, y] of [[99, 250], [150, 199], [500, 300], [300, 600], [-100, -100]]) {
    assert.equal(squareAtPoint(x, y, rect, 'w'), null);
    assert.equal(squareAtPoint(x, y, rect, 'b'), null);
  }
  assert.equal(squareAtPoint(100, 200, rect, 'w'), 'a8');
  assert.equal(squareAtPoint(499.999, 599.999, rect, 'w'), 'h1');
});

test('a hidden or zero-size board cannot produce a move', () => {
  assert.equal(squareAtPoint(0, 0, { left: 0, top: 0, width: 0, height: 400 }, 'w'), null);
  assert.equal(squareAtPoint(0, 0, { left: 0, top: 0, width: 400, height: 0 }, 'w'), null);
});
