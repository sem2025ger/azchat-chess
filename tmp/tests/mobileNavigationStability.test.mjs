import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const layout = fs.readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
test('all five mobile tabs keep navigation targets and distinct active accents', () => {
  assert.match(layout, /<MobileNavItem to="\/home"[^\n]*premiumHome/);
  for (const [route, accent] of [['game','analysis'],['chat','chat'],['profile','profile'],['settings','settings']]) {
    assert.ok(layout.includes('to="/'+route+'"') && layout.includes('accent="'+accent+'"'), 'missing '+route);
    assert.match(layout, new RegExp('\\b'+accent+':'));
  }
  assert.match(layout, /accent \? mobileActiveAccent\[accent\]/);
});
test('mobile pages share a fixed viewport scroll owner and navigation resets before paint', () => {
  assert.match(layout, /useLayoutEffect\(\(\) => \{/);
  assert.match(layout, /routeScrollRef\.current\.scrollTop = 0/);
  assert.match(layout, /window\.scrollTo\(0, 0\)/);
  assert.match(layout, /max-md:h-\[100dvh\] max-md:min-h-0 max-md:overflow-hidden/);
  assert.match(layout, /max-md:min-h-0/);
  assert.match(layout, /<Suspense key=\{location\.pathname\}/);
});
