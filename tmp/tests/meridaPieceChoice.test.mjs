import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('settings presents exactly Merida Flat and Merida Classic, including presets', () => {
  const themes = read('../src/lib/chessThemes.ts');
  const context = read('../src/context/ThemeContext.tsx');
  const settings = read('../src/screens/SettingsScreen.tsx');
  const center = read('../src/components/settings/SettingsCommandCenter.tsx');
  const logic = read('../src/components/settings/settingsLogic.ts');
  const options = themes.split('export const PIECE_STYLES')[1]?.split('export const BOARD_THEME_DETAILS')[0] ?? '';
  const libraryIds = [...options.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(libraryIds, ['classic', 'cburnett-classic', 'neo', 'tournament'], 'retain existing assets for non-settings boards');
  const ids = ['neo', 'tournament'];
  assert.match(options, /Merida Flat/);
  assert.match(options, /Merida Classic/);
  assert.match(context, /DEFAULT_PIECE_THEME: PieceTheme = 'neo'/);
  assert.match(context, /VALID_PIECE_THEMES = new Set<string>\(PIECE_STYLES\.filter\(/);
  assert.match(settings, /const pieceStyles = PIECE_STYLES\.filter\(\(style\) => style\.id === 'neo' \|\| style\.id === 'tournament'\)/);
  assert.match(center, /\.\.\.PIECE_STYLES\.filter\(x => x\.id === 'neo' \|\| x\.id === 'tournament'\)\.map/);
  assert.match(settings, /mobilePiecePreviewSrc\(pieceTheme, 'wK'\)/);
  for (const source of [
    settings.split('const presets = [')[1]?.split('];')[0] ?? '',
    logic.split('export const STYLE_PRESETS = {')[1]?.split('} as const;')[0] ?? '',
  ]) {
    const presetIds = [...source.matchAll(/pieces: '([^']+)'/g)].map(match => match[1]);
    assert.equal(presetIds.length, 3);
    assert.ok(presetIds.every(id => ids.includes(id)), 'all settings presets should select an available Merida theme');
  }
});

test('both desktop Merida black-pawn palettes retain their shadows but reduce the highlights by 10%', () => {
  const originals = {
    neo: { R: [0.11848, 0.15554, 0.68319], G: [0.09949, 0.13762, 0.68059], B: [0.08772, 0.12666, 0.67883] },
    tournament: { R: [0.11848, 0.17164, 0.84319], G: [0.09949, 0.15318, 0.84059], B: [0.08772, 0.14141, 0.83883] },
  };
  for (const [style, channels] of Object.entries(originals)) {
    const svg = read('../public/pieces/desktop/neo-pawns/bP-' + style + '.svg');
    assert.match(svg, /<image width="300" height="300" href="data:image\/png;base64,/);
    assert.match(svg, /filter="url\(#palette\)"/);
    assert.equal((svg.match(/<feFunc[RGB] type="table"/g) ?? []).length, 3);
    for (const [channel, [shadow, nearHighlight, brightest]] of Object.entries(channels)) {
      const found = svg.match(new RegExp('<feFunc' + channel + ' type="table" tableValues="([^"]+)"'));
      assert.ok(found);
      const values = found[1].split(' ').map(Number);
      assert.equal(values.length, 65);
      assert.equal(values[21], shadow, 'original dark pixels stay unchanged');
      for (const [index, original] of [[22, nearHighlight], [64, brightest]]) {
        assert.ok(Math.abs(values[index] - (shadow + 0.9 * (original - shadow))) <= 0.0000051,
          style + ' ' + channel + ' sheen at index ' + index + ' must be reduced by 10%');
      }
    }
  }
});
