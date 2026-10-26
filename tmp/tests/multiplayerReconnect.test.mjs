import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const socket = readFileSync(new URL('../src/context/SocketContext.tsx', import.meta.url), 'utf8');
const play = readFileSync(new URL('../src/screens/PlayScreen.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/ArenaPlayPanel.css', import.meta.url), 'utf8');

test('unauthorized game socket refreshes credentials at most once, retaining server-side verification', () => {
  assert.match(socket, /let recoveryAttempted = false/);
  assert.match(socket, /!recoveryAttempted && sessionRef\.current/);
  assert.match(socket, /await supabase\.auth\.refreshSession\(\)/);
  assert.match(socket, /newSocket\.connect\(\)/);
  assert.match(socket, /setAuthError\('unauthorized'\)/);
});

test('desktop friend game waits for socket connectivity with bounded cancellation rather than instant failure', () => {
  assert.match(play, /waitingForFriendSocket/);
  assert.match(play, /if \(!waitingForFriendSocket \|\| !socket \|\| !isConnected\) return/);
  assert.match(play, /socket\.emit\('create_private_room'/);
  assert.doesNotMatch(play, /if \(!socket \|\| !isConnected\) \{ setJoinError\('Connection not ready/);
  assert.match(play, /65000/);
});

test('warm sidebar palette remains limited to desktop arena panel styling', () => {
  assert.match(css, /background:linear-gradient\(#11110f,#11110f\) padding-box/);
  assert.match(css, /background:linear-gradient\(160deg,#24231f,#191916\)/);
  assert.match(css, /background:linear-gradient\(155deg,#24231f,#191916\)/);
  assert.match(css, /#424b4d 52%/);
});
