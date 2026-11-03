import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coachCss = readFileSync(new URL('../src/components/spieler/OpeningPrep.css', import.meta.url), 'utf8');
const sectionCss = readFileSync(new URL('../src/styles/sections.css', import.meta.url), 'utf8');
const coachTsx = readFileSync(new URL('../src/components/spieler/OpeningPrep.tsx', import.meta.url), 'utf8');

test('AI Coach retains its original card background and border', () => {
  assert.match(coachTsx, /className="section-card chessaz-ai-coach"/);
  assert.match(sectionCss, /\.section-card\s*\{[^}]*background:linear-gradient\(145deg,#202326,#16191c\)/);
  assert.doesNotMatch(coachCss, /#root \.spieler-page \.chessaz-ai-coach\s*\{/,
    'The wordmark stylesheet must not recolor the entire AI Coach card');
});

test('AI Coach metallic sheen applies to letters only and respects reduced motion', () => {
  const wordmark = coachCss.match(/#root \.spieler-page \.chessaz-ai-coach h2\.ai-coach-wordmark\s*\{([^}]*)\}/)?.[1];
  assert.ok(wordmark, 'Scoped AI Coach wordmark style is present');
  assert.match(wordmark, /#455363/); // Deep steel blue from the globe-inspired palette
  assert.match(wordmark, /#c8ccd0/); // Platinum reflection
  assert.match(wordmark, /#c1a478/); // Subtle antique-gold reflection
  assert.match(wordmark, /-webkit-background-clip:text/);
  assert.match(wordmark, /animation:chessazCoachDarkMetal 11s/);
  assert.match(coachCss, /@media\(prefers-reduced-motion:reduce\)/);
});
