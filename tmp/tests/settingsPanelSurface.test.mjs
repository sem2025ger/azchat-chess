import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('desktop Settings option sections exactly match the Live Preview panel surface', () => {
  const screen = readFileSync(new URL('../src/screens/SettingsScreen.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/screens/SettingsTypography.css', import.meta.url), 'utf8');
  assert.equal((screen.match(/settings-preview-matched-surface/g) || []).length, 5);
  for (const id of ['settings-section-board', 'settings-section-pieces', 'settings-section-sound', 'settings-section-background']) {
    const panel = screen.split('id="' + id + '"')[1]?.split('</section>')[0] ?? '';
    assert.ok(panel.includes('settings-preview-matched-surface'), id + ' uses the shared panel surface');
  }
  assert.match(screen.split('settings-preview-column')[1], /settings-preview-matched-surface/);
  assert.ok(css.includes('background-color: #171717;') && css.includes('.settings-fixed-workspace .settings-preview-matched-surface'));
});
