import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/OnlineLobby.tsx', import.meta.url), 'utf8');
test('lobby hides connection notices while retaining the reserved spacing and connection guards', () => {
  assert.match(source, /<div className="online-lobby-connection-status" aria-hidden="true" \/>/);
  assert.doesNotMatch(source, /Game server connection unavailable|Server unavailable|Нет подключения к игровому серверу|Нет соединения с сервером/);
  assert.match(source, /disabled=\{isLoading \|\| \(!!session && !isConnected\)\}/);
});
