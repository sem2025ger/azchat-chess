import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('opponent search has readable mobile-only typography without altering matchmaking actions', () => {
  const source = readFileSync(new URL('../src/screens/PlayScreen.tsx', import.meta.url), 'utf8');
  const overlay = source.split('{/* Matchmaking Overlay */}')[1]?.split('className="play-lobby-board')[0];
  assert.ok(overlay, 'matchmaking overlay exists');
  assert.match(overlay, /isSearching && "max-md:w-full max-md:max-w-\[340px\] max-md:scale-100/);
  assert.match(overlay, /isSearching && "max-md:text-\[20px\].*max-md:font-sans.*max-md:text-\[#eee5d7\]"/);
  assert.match(overlay, /isSearching && "max-md:text-\[14px\].*max-md:opacity-100/);
  assert.match(overlay, /isSearching && "max-md:min-h-\[44px\].*max-md:text-\[15px\]/);
  assert.match(overlay, /t\('play.searching'\)/);
  assert.match(overlay, /t\('play.searchingDesc'\)/);
  assert.match(overlay, /formatTime\(searchTime\)/);
  assert.match(overlay, /socket\.emit\('cancel_matchmaking'\)/);
  assert.match(overlay, /setIsSearching\(false\)/);
});
