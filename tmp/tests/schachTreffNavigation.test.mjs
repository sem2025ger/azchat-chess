import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url),'utf8');
test('desktop inactive home and settings cannot retain active-looking theme', () => {
  assert.equal((source.match(/alwaysGlow=\{!desktop\}/g) || []).length, 2);
  assert.match(source, /isActive\s*\? `sidebar-item-active/);
});
test('Schach-Treff uses one label on desktop/mobile without a subtitle', () => {
  assert.match(source, /<NavItem to="\/chat"[^\n]*label="Schach-Treff"/);
  assert.doesNotMatch(source, /subtitle=\{t\('nav.germanSpeakers'\)\}|site-nav-subtitle/);
  assert.match(source, /<MobileNavItem to="\/chat"[^\n]*label="Schach-Treff"/);
});
