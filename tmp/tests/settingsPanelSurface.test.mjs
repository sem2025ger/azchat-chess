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

test('desktop four option surfaces use the same opaque neutral color as Live Preview', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const declaration = css.match(/#settings-section-board > section,[\s\S]*?#settings-section-background > section\s*\{([^}]+)\}/);
  assert.ok(declaration, 'all four desktop option panels share one rule');
  assert.match(declaration[1], /background:\s*#171717\s*;/);
  assert.doesNotMatch(declaration[1], /gradient|#20242D|#111827|#161C27/);
  const surfaces = readFileSync(new URL('../src/screens/SettingsTypography.css', import.meta.url), 'utf8');
  assert.match(surfaces, /\.settings-preview-matched-surface\s*\{\s*background-color:\s*#171717;/);
});

test('minor font increase is confined to four desktop option cards, not headings or board', () => {
  const css = readFileSync(new URL('../src/screens/SettingsTypography.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* Desktop option labels only:');
  assert.ok(start >= 0);
  const rules = css.slice(start);
  assert.match(rules, /@media \(min-width: 1024px\)/);
  for (const [id, size] of [['board','12px'], ['pieces','11px'], ['sound','12px'], ['background','11.5px']]) {
    assert.match(rules, new RegExp('#settings-section-' + id + '[^\\{]*\\{\\s*font-size: ' + size.replace('.', '\\.') + ';'));
  }
  assert.doesNotMatch(rules, /h2|settings-preview-board|settings-preview-column|settings-preview-title/);
});
