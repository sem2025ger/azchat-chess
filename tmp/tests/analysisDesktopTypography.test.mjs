import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const scope = css.slice(css.indexOf('/* Chess.com-inspired readable desktop analysis notation.'));

test('desktop review uses consistent regular Inter typography for score, PV and move notation', () => {
  assert.ok(scope.startsWith('/* Chess.com-inspired'));
  assert.match(scope, /@media \(min-width: 1024px\)/);
  for (const selector of ['.analysis-engine-score', '.analysis-engine-moves', '.desktop-analysis-move-table tbody']) {
    assert.ok(scope.includes(selector), selector);
  }
  assert.match(scope, /font-family: Inter, system-ui/);
  assert.match(scope, /font-weight: 500 !important/);
  assert.match(scope, /font-variant-numeric: tabular-nums/);
  assert.match(scope, /transform: none !important/);
});
