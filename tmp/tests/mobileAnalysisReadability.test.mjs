import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/components/analysis/mobileAnalysis.css', import.meta.url), 'utf8');

test('mobile review alone enlarges piece content without changing square hitboxes', () => {
  assert.match(css, /\.desktop-analysis-screen \.desktop-analysis-main-board \[data-piece-square\] > div\s*\{\s*padding: 1% !important;/);
  assert.match(css, /\.desktop-analysis-screen \.desktop-analysis-board-frame/);
});

test('evaluation lines are compact, legible and horizontally scrollable', () => {
  assert.match(css, /\.mobile-analysis-line \{ display: flex; align-items: center; gap: 8px; padding: 6px 10px;/);
  assert.match(css, /\.mobile-analysis-line p \{[\s\S]*?white-space: nowrap;[\s\S]*?touch-action: pan-x;/);
  assert.match(css, /color: #edf2ed; font-size: 13px; font-weight: 700; line-height: 1\.4/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});
