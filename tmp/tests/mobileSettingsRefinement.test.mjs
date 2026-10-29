import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/SettingsScreen.tsx');
const css = read('../src/screens/SettingsTypography.css');
const layout = read('../src/components/Layout.tsx');
const theme = read('../src/context/ThemeContext.tsx');
const board = read('../src/components/ChessBoard.tsx');
const live = read('../src/screens/GameScreen.tsx');

test('mobile settings slate-blue surfaces remain settings-scoped and desktop-safe', () => {
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /\.settings-fixed-workspace \{/);
  assert.match(css, /#344253 0%, #293748 50%, #202d3d 100%/);
  assert.match(css, /\.settings-mobile-card/);
  assert.match(screen, /settings-mobile-card/);
});

test('mobile settings use desktop font families while retaining button legibility', () => {
  assert.match(css, /font-family: 'ChessAZ Settings UI'/);
  assert.match(css, /font-family: 'ChessAZ Settings Display'/);
  assert.match(css, /\.settings-mobile-view h2/);
  assert.match(css, /font-size: max\(0\.875rem, \.875rem\)/);
});

test('mobile settings translate labels without changing existing choices and clear scroll area', () => {
  assert.match(screen, /soundGame: 'Звук и игра'/);
  assert.match(screen, /presets: 'Готовые стили'/);
  assert.match(screen, /inPlay: 'Настроить в игре'/);
  assert.match(screen, /settings-mobile-view lg:hidden/);
  assert.match(css, /overscroll-behavior-y: contain/);
});

test('navigation highlights only active tab; Home inactive has no gold ring', () => {
  assert.match(layout, /premiumHome/);
  assert.match(layout, /: "text-neutral-500 hover:text-neutral-300"/);
  for (const accent of ['analysis', 'chat', 'profile', 'settings']) assert.match(layout, new RegExp(accent + ':'));
});

test('move confirmation is opt-in, persists, validates moves and never affects review', () => {
  assert.match(theme, /chess_confirmMobileMoves/);
  assert.match(theme, /confirmMobileMoves, setConfirmMobileMoves/);
  assert.match(screen, /role="switch" aria-checked=\{confirmMobileMoves\}/);
  assert.match(board, /confirmMovesMobile = false/);
  assert.match(board, /candidate\.move\(moveObj\)/);
  assert.match(board, /data-mobile-move-confirmation/);
  assert.match(live, /confirmMovesMobile=\{mode === 'live' && confirmMobileMoves\}/);
  assert.match(board, /Cancel pending move/);
  assert.match(board, /Confirm pending move/);
});
