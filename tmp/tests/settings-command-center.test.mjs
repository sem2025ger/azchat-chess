import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const logic = readFileSync(fileURLToPath(new URL('../src/components/settings/settingsLogic.ts', import.meta.url)), 'utf8');
const center = readFileSync(fileURLToPath(new URL('../src/components/settings/SettingsCommandCenter.tsx', import.meta.url)), 'utf8');
const screen = readFileSync(fileURLToPath(new URL('../src/screens/SettingsScreen.tsx', import.meta.url)), 'utf8');
const theme = readFileSync(fileURLToPath(new URL('../src/context/ThemeContext.tsx', import.meta.url)), 'utf8');

test('settings: keyword matcher requires every query token and limits results', () => {
  assert.match(logic, /tokens\.every\(token => value\.includes\(token\)\)/);
  assert.match(logic, /\.slice\(0, max\)/);
  assert.match(logic, /normalize\('NFKD'\)/);
});
test('settings: all three goal presets are available and wired to actual context setters', () => {
  for (const goal of ['blitz','study','focus']) assert.match(logic, new RegExp(goal + ': \\{ board:'));
  for (const setter of ['setBoardTheme','setPieceTheme','setSound','setBackground']) {
    assert.match(center, new RegExp(setter + '\\(selection\\.'));
  }
});
test('settings: changes can be undone and persisted by existing theme context', () => {
  assert.match(center, /setPrevious\(current\)/);
  assert.match(center, /onClick=\{undo\}/);
  for (const key of ['chess_boardTheme','chess_pieceTheme','chess_background','chess_sound']) assert.ok(theme.includes(key));
});
test('settings: expanded panel remains scrollable and deep-link categories exist', () => {
  assert.match(screen, /overflow-y-auto/);
  for (const id of ['board','pieces','sound','background']) assert.ok(screen.includes('id="settings-section-' + id + '"'));
});
