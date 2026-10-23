import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync(new URL('../src/components/analysis/EditorBoard.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/components/analysis/mobileAnalysis.css', import.meta.url), 'utf8');
const tools = fs.readFileSync(new URL('../src/components/analysis/PositionTools.tsx', import.meta.url), 'utf8');

test('mobile editor coordinates live outside all 64 editable squares', () => {
  assert.match(editor, /data-coordinate-axis="rank-mobile"/);
  assert.match(editor, /data-coordinate-axis="file-mobile"/);
  assert.match(editor, /hidden md:block lg:hidden/);
  assert.match(editor, /data-main-position-editor/);
  assert.match(editor, /draft\.squares\.map/);
});

test('editor-only touch board and palette sizes grow without altering review board', () => {
  assert.match(css, /\.mobile-position-board \{ width: min\(100%, 54dvh, 480px\)/);
  assert.match(css, /\.mobile-position-tools \.mobile-position-palette img \{ width: 38px; height: 38px/);
  assert.match(tools, /mobile-position-palette/);
  assert.match(tools, /mobile \? 'h-\[38px\] w-\[38px\]'/);
});

test('mobile editor has accessible in-panel navigation and large lower controls', () => {
  assert.match(tools, /data-scroll-to-pieces/);
  assert.match(tools, /data-scroll-to-board/);
  assert.match(tools, /scrollRef\.current/);
  assert.match(tools, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.mobile-editor-turn select \{ min-height: 44px/);
  assert.match(css, /\.mobile-editor-castling input\[type='checkbox'\] \{ width: 21px; height: 21px/);
  assert.match(css, /\.mobile-editor-advanced summary \{[^}]*min-height: 44px/);
});
