import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/ChessBoard.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
const ink = name => readFileSync(new URL(`../public/pieces/home-cburnett-ink/${name}.svg`, import.meta.url), 'utf8');

test('Home dark-ink variant is desktop-only and limited to black CBURNETT pieces', () => {
  assert.match(home, /overrideBoardTheme="Classic Wood" homeBlackInk/);
  assert.match(source, /homeBlackInk && piece.color === 'b'/);
  assert.match(source, /pieceSetName === 'cburnett-classic'/);
  assert.match(source, /homeBlackSource && <source media="\(min-width: 1280px\)"/);
  assert.match(home, /\.home-screen-root \.home-board img\[data-home-black-ink\]/);
  assert.match(source, /grid grid-cols-8 grid-rows-8/);
  assert.match(home, /<ChessBoard game=\{game\} onMove=\{onMove\} overrideBoardTheme="Classic Wood" className="!border-none !p-0"/);
});

test('bishop keeps its light plus; all other black Home figures have no white details', () => {
  const bishop = ink('bB');
  assert.equal((bishop.match(/stroke="#ececec"/g) || []).length, 1);
  assert.match(bishop, /d="M22\.5 15\.5v5M20 18h5"/);
  assert.doesNotMatch(bishop, /M17\.5 26h10|M15 30h15/);
  for (const kind of ['bK', 'bN', 'bQ', 'bR']) {
    assert.doesNotMatch(ink(kind), /#ececec|#ffffff|#fff|white/i, kind + ' contains white');
  }
  assert.match(ink('bN'), /#55514d/);
  assert.match(ink('bN'), /#363431/);
});

test('Chess.com white and black pawn palette keeps original black major figures', () => {
  assert.match(home, /VITE_HOME_CHESSCOM_PIECES === 'true'/);
  assert.match(home, /homeBlackInk homeChessComPalette=\\{homeChessComPieces\\}/);
  assert.match(home, /xl:p-3 overflow-hidden/);
  assert.match(home, /xl:ring-0/);
  assert.match(home, /img\\[data-home-chesscom-piece="w"\\]/);
  assert.match(home, /img\\[data-home-chesscom-piece="b"\\]\\[alt="bP"\\] \\{\\s*filter: grayscale\\(1\\) contrast\\(.42\\) brightness\\(.61\\)/);
  assert.doesNotMatch(home, /img\\[data-home-chesscom-piece="b"\\]:not\\(\\[alt="bP"\\]\\)/);
  assert.match(source, /homeBlackInk && piece.color === 'b'/);
  assert.match(source, /homeBlackSource && <source media="\\(min-width: 1280px\\)"/);
  assert.doesNotMatch(source, /homeSolidBlackSource|home-solid-black/);
  for (const kind of ['bK', 'bQ', 'bR', 'bB', 'bN']) assert.match(ink(kind), /<svg/);
});
