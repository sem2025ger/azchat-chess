import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('reference-style ChessAZ.de logo has static silver letters and colorful de', () => {
  assert.match(layout, /aria-label="ChessAZ\.de"/);
  assert.match(layout, /sidebar-brand-silver">ChessAZ\.<\/span>/);
  assert.match(layout, /sidebar-brand-de inline-block xl:text-\[1\.06em\]">de<\/span>/);
  assert.match(css, /\.sidebar-brand-silver\s*\{/);
  assert.match(css, /\.sidebar-brand-de\s*\{/);
  assert.doesNotMatch(css, /sidebarKingSheen/);
});

test('original king is raised and close to de, with original image texture', () => {
  assert.match(layout, /src="\/brand\/sidebar-king\.svg"[^\n]*width="31" height="62"/);
  assert.match(layout, /-translate-x-\[2px\] -translate-y-\[6px\]/);
  assert.doesNotMatch(layout, /sidebar-king-metallic/);
});
