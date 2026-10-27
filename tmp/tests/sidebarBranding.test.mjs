import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('sidebar wordmark keeps Chessaz.de spelling and subtly enlarges only Ch', () => {
  assert.match(layout, /aria-label="Chessaz\.de"/);
  assert.match(layout, /className="text-glow-cycle"><span className="xl:text-\[1\.08em\]">Ch<\/span>essaz\.<\/span>/);
});

test('original king artwork is preserved, an additional 5% smaller, and closer to de on desktop', () => {
  assert.match(layout, /xl:gap-0/);
  assert.match(layout, /src="\/brand\/sidebar-king\.svg"[^\n]*width="28" height="55"[^\n]*h-\[55px\] w-\[27\.5px\]/);
});

test('de has metallic sheen and respects reduced-motion preferences', () => {
  assert.match(layout, /className="sidebar-de-metallic inline-block not-italic xl:text-\[1\.06em\]">de<\/span>/);
  assert.match(css, /\.sidebar-de-metallic\s*\{[^}]*linear-gradient\(112deg,/s);
  assert.match(css, /animation: sidebarDeSheen 7s ease-in-out infinite alternate;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sidebar-de-metallic\s*\{\s*animation: none;/);
});
