import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url),'utf8');
test('desktop inactive home and settings cannot retain active-looking theme', () => {
  assert.equal((source.match(/alwaysGlow=\{!desktop\}/g) || []).length, 2);
  assert.match(source, /isActive\s*\? `sidebar-item-active/);
});
test('Schach-Treff labels are desktop only and mobile chat retains translation', () => {
  assert.match(source, /label=\{desktop \? 'Schach-Treff' : t\('nav.chat'\)\}/);
  assert.match(source, /<MobileNavItem to="\/chat"[^\n]*label=\{t\('nav.chat'\)\}/);
});
