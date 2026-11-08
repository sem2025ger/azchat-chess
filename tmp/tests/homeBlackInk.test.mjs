import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/ChessBoard.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
const ink = name => readFileSync(new URL(`../public/pieces/home-cburnett-ink/${name}.svg`, import.meta.url), 'utf8');

test('Home dark-ink variant is desktop-only and limited to black CBURNETT pieces', () => {
  assert.match(home, /overrideBoardTheme="Classic Wood" homeBlackInk/);
  assert.match(source, /homeBlackInk && !homeChessComPalette && piece.color === 'b'/);
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

test('Chess.com reference palette is opt-in, desktop Home only, and keeps the approved frame', () => {
  assert.match(home, /VITE_HOME_CHESSCOM_PIECES === 'true'/);
  assert.match(home, /homeBlackInk homeChessComPalette=\{homeChessComPieces\}/);
  assert.match(home, /xl:p-3 overflow-hidden/);
  assert.match(home, /xl:ring-0/);
  assert.match(home, /xl:max-w-\[min\(630px,calc\(100dvh-120px\)\)\]/);
  assert.match(home, /@media \(min-width: 1280px\) \{\s*\.home-screen-root \.home-board img\[data-home-chesscom-piece="w"\]/);
  assert.match(home, /data-home-chesscom-piece="b"/);
  assert.match(home, /img\[data-home-chesscom-piece="b"\]:not\(\[alt="bP"\]\) \{\s*filter: none !important/);
  assert.match(source, /piece.color === 'b' && \['K', 'Q', 'R', 'B', 'N'\]/);
  assert.ok(source.includes('homeSolidBlackSource && <source media="(min-width: 1280px)"'));
  assert.match(source, /homeBlackInk && !homeChessComPalette && piece.color === 'b'/);
  assert.match(source, /data-home-chesscom-piece=\{homeChessComPalette && pieceSetName === 'cburnett-classic' \? piece.color : undefined\}/);
  assert.match(source, /homeChessComPalette=\{homeChessComPalette\}/);
});

test('solid black Home major pieces use native dark SVG with no edge effects; pawns unchanged', () => {
  for (const kind of ['K', 'Q', 'R', 'B', 'N']) {
    const piece = readFileSync(new URL(`../public/pieces/home-solid-black/b${kind}.svg`, import.meta.url), 'utf8');
    assert.match(piece, /fill="#232323"/);
    assert.doesNotMatch(piece, /<filter|filter=|drop-shadow|#000(?:000)?\b|stroke="#ececec"/i);
  }
  assert.doesNotMatch(source, /homeSolidBlackSource[^\n]*piece.type === 'p'/);
  assert.doesNotMatch(home, /img\[data-home-chesscom-piece="b"\]:not\(\[alt="bP"\]\) \{\s*filter: (?!none)/);
  assert.match(home, /img\[data-home-chesscom-piece="b"\]\[alt="bP"\] \{\s*filter: grayscale\(1\) contrast\(.42\) brightness\(.61\)/);
});
