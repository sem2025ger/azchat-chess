import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { Chess } from 'chess.js';

// Render the real board and theme provider; no browser geometry is simulated here.
test('outside coordinates preserve board squares and pieces in both orientations', async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null },
  });
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: ChessBoard } = await server.ssrLoadModule('/src/components/ChessBoard.tsx');
    const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.tsx');
    const game = new Chess();
    game.move('e4');
    game.move('c5');
    const fen = game.fen();
    const render = props => renderToStaticMarkup(createElement(ThemeProvider, null,
      createElement(ChessBoard, { game, ...props })));
    const axis = (html, name) => {
      const group = html.match(new RegExp(`<div data-coordinate-axis="${name}"[^>]*>(.*?)</div>`));
      assert.ok(group, `missing ${name} coordinates`);
      assert.match(group[0], /hidden lg:grid/); // desktop opt-in keeps the mobile labels in cells
      return [...group[1].matchAll(/<span[^>]*>(.*?)<\/span>/g)].map(match => match[1]);
    };
    const squares = html => [...html.matchAll(/data-square="([a-h][1-8])"/g)].map(match => match[1]);
    const pieces = html => [...html.matchAll(/data-piece-square="([a-h][1-8])"/g)].map(match => match[1]);

    for (const orientation of ['w', 'b']) {
      const inside = render({ orientation });
      const outside = render({ orientation, externalCoordinatesOnDesktop: true });
      assert.deepEqual(axis(outside, 'rank'), orientation === 'w'
        ? ['8', '7', '6', '5', '4', '3', '2', '1']
        : ['1', '2', '3', '4', '5', '6', '7', '8']);
      assert.deepEqual(axis(outside, 'file'), orientation === 'w'
        ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
      assert.deepEqual(squares(outside), squares(inside));
      assert.equal(new Set(squares(outside)).size, 64);
      assert.deepEqual(pieces(outside), pieces(inside));
      assert.equal(pieces(outside).length, 32);
      assert.doesNotMatch(inside, /data-coordinate-axis/); // Home/live defaults remain opt-out
      assert.equal((outside.match(/lg:hidden/g) || []).length, 16);
    }
    assert.doesNotMatch(render({ externalCoordinatesOnDesktop: true, showCoordinates: false }),
      /data-coordinate-axis/);
    assert.equal(game.fen(), fen);
  } finally {
    await server.close();
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
    else delete globalThis.localStorage;
  }
});
