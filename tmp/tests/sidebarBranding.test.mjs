import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('wordmark spells Chessaz.de with subtly enlarged Ch', () => {
  assert.match(layout, /aria-label="Chessaz\.de"/);
  assert.match(layout, /sidebar-brand-silver"><span className="xl:text-\[1\.08em\]">Ch<\/span>essaz\.<\/span>/);
  assert.match(layout, /sidebar-brand-de inline-block xl:text-\[1\.06em\]">de<\/span>/);
  assert.match(css, /\.sidebar-brand-silver\s*\{/);
  assert.match(css, /\.sidebar-brand-de\s*\{/);
});

test('king dimensions and position remain unchanged with lightweight decorative sheen', () => {
  assert.match(layout, /h-\[62px\] w-\[31px\] shrink-0 -translate-x-\[2px\] -translate-y-\[6px\]/);
  assert.match(layout, /src="\/brand\/sidebar-king\.svg"[^\n]*width="31" height="62"/);
  assert.match(layout, /sidebar-king-sheen pointer-events-none absolute inset-0/);
  assert.match(css, /\.sidebar-king-sheen\s*\{/);
  assert.match(css, /mask: url\('\/brand\/sidebar-king\.svg'\)/);
  assert.match(css, /animation: sidebarKingSoftSheen 9s ease-in-out infinite;/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.sidebar-king-sheen \{ animation: none;/);
});
