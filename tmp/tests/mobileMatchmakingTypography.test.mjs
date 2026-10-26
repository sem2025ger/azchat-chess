import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const play = readFileSync(new URL('../src/screens/PlayScreen.tsx', import.meta.url), 'utf8');
const overlay = readFileSync(new URL('../src/components/MobileOpponentSearchOverlay.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/components/MobileOpponentSearchOverlay.css', import.meta.url), 'utf8');

test('mobile search uses dedicated accessible panel with premium typography and neutral cancellation', () => {
  assert.match(play, /<MobileOpponentSearchOverlay/);
  assert.match(play, /hidden md:flex/);
  assert.match(overlay, /role="dialog" aria-modal="true"/);
  assert.match(overlay, /chessaz-search-mobile__title/);
  assert.match(overlay, /chessaz-search-mobile__clock/);
  assert.match(overlay, /onClick={onCancel}/);
  assert.match(styles, /@media \(max-width:767px\)/);
  assert.match(styles, /montserrat-cyrillic\.woff2/);
  assert.match(styles, /font-size:clamp\(19px,5\.4vw,23px\)/);
  assert.match(styles, /chessaz-search-mobile__cancel[\s\S]*?min-height:49px/);
  assert.doesNotMatch(styles, /red-500|#ef4444/);
});
test('matchmaking waits for websocket, joins once and supports cancellation', () => {
  assert.match(play, /if \(!waitingForSocket \|\| !isConnected \|\| !socket\) return;/);
  assert.match(play, /socket\.emit\('join_queue', \{ timeControl: toServerTimeControl\(timeControl\) \}\);/);
  assert.match(play, /setTimeout\(\(\) => \{[\s\S]*?setWaitingForSocket\(false\);[\s\S]*?\}, 65000\)/);
  assert.match(play, /const cancelMatchmaking = \(\) => \{/);
  assert.match(play, /socket\.emit\('cancel_matchmaking'\)/);
  assert.match(play, /setIsSearching\(false\)/);
  assert.match(play, /if \(authError === 'unauthorized'\)/);
});
