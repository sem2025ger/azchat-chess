import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

test('settings preview: legal move, capture, check, illegal move and reset', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { trySettingsPreviewMove } = await server.ssrLoadModule('/src/utils/settingsPreviewMove.ts');
    const start = new Chess();
    const normal = trySettingsPreviewMove(start, 'e2', 'e4');
    assert.equal(normal.sound, 'move');
    assert.equal(normal.game.get('e4')?.type, 'p');
    assert.equal(start.get('e2')?.type, 'p', 'original chessboard is unchanged');
    assert.equal(trySettingsPreviewMove(start, 'e2', 'e5'), null);

    const capture = trySettingsPreviewMove(new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'), 'e4', 'd5');
    assert.equal(capture?.sound, 'capture');
    const check = trySettingsPreviewMove(new Chess('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'), 'e2', 'e7');
    assert.equal(check?.sound, 'check');
    assert.equal(new Chess().fen(), start.fen(), 'reset restores the initial board');
  } finally {
    await server.close();
  }
});

test('settings preview sound stays scoped to actual legal preview moves', () => {
  const screen = readFileSync(new URL('../src/screens/SettingsScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /trySettingsPreviewMove\(previewGame, from, to, promotion\)/);
  assert.match(screen, /playChessSound\(result\.sound, soundTheme\)/);
  assert.match(screen, /<ChessBoard game=\{previewGame\} onMove=\{handlePreviewMove\}/);
  assert.match(screen, /setPreviewGame\(new Chess\(\)\)/);
  assert.doesNotMatch(screen, /key=\{previewVersion\}/);
});
