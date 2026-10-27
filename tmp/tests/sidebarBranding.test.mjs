import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('Chessaz.de wordmark retains enlarged Ch and unanimated de', () => {
  assert.match(layout, /aria-label="Chessaz\.de"/);
  assert.match(layout, /xl:text-\[1\.08em\]">Ch<\/span>essaz\./);
  assert.match(layout, /text-\[#C5CAD1\]">de<\/span>/);
  assert.doesNotMatch(layout, /sidebar-de-metallic/);
});

test('king keeps original artwork, 55px height, roughly 12% wider', () => {
  assert.match(layout, /src="\/brand\/sidebar-king\.svg"[^\n]*width="31" height="55"/);
  assert.match(layout, /h-\[55px\] w-\[31px\]/);
  assert.match(layout, /sidebar-king-metallic absolute inset-0/);
});

test('metallic sheen uses original king silhouette and respects reduced motion', () => {
  assert.match(css, /\.sidebar-king-metallic\s*\{[^}]*linear-gradient\(112deg,/s);
  assert.match(css, /mask: url\('\/brand\/sidebar-king\.svg'\)/);
  assert.match(css, /animation: sidebarKingSheen 7s ease-in-out infinite alternate/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.sidebar-king-metallic \{ animation: none;/);
  assert.doesNotMatch(css, /sidebarDeSheen/);
});
