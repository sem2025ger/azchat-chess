import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewLayout } from '../src/utils/reviewLayout.ts';
import { playLobbyBoardSize } from '../src/utils/playLobbyBoardSize.ts';

test('lobby and analysis have equal square sizes across desktop workspaces', () => {
  for (const [width, height] of [[736, 650], [1075, 936], [1312, 900], [1560, 880], [2200, 1280]]) {
    const review = reviewLayout(width, height);
    const analysisField = review.boardSize - 44 * review.scale;
    const lobbyField = playLobbyBoardSize(width, height) - 36;
    assert.ok(Math.abs(lobbyField / 8 - analysisField / 8) < 1e-9);
    assert.ok(lobbyField > 0 && playLobbyBoardSize(width, height) <= height);
  }
});

test('large lobby board grows to the approved 692px playing field and stops there', () => {
  assert.equal(playLobbyBoardSize(1560, 880), 728);
  assert.equal(playLobbyBoardSize(2200, 1280), 728);
});
