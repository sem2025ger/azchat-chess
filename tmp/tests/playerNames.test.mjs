import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { displayPlayerName } from '../src/utils/displayPlayerName.ts';

test('display names omit only technical UUID suffixes and never expose bare identifiers', () => {
  assert.equal(displayPlayerName('sonya25_8fd192275ee149dbb0f0728689e4c568'), 'sonya25');
  assert.equal(displayPlayerName('bakin_2d117316fcc841579356deb8d9c1667d'), 'bakin');
  assert.equal(displayPlayerName('Chess_Player_8FD19227-5EE1-49DB-B0F0-728689E4C568'), 'Chess_Player');
  for (const value of ['8fd192275ee149dbb0f0728689e4c568','8fd19227-5ee1-49db-b0f0-728689e4c568', '', null, undefined]) {
    assert.equal(displayPlayerName(value, 'Игрок'), 'Игрок');
  }
  for (const value of ['Player_123','Соня','Chess_Master_2026','a_b_c','123456']) assert.equal(displayPlayerName(value), value);
});

test('live player names read public profile names only and keep identifiers out of results', async () => {
  const ids = { w:'11111111-1111-4111-8111-111111111111', b:'22222222-2222-4222-8222-222222222222' };
  let requestUrl, requests = 0;
  globalThis.playerNameFixtureFetch = async (url, options) => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    requestUrl = new URL(url); requests++;
    return new Response(JSON.stringify([{ id:ids.w, username:'Alice_11111111111141118111111111111111' },{ id:ids.b, username:'Bob' }]), { headers:{'Content-Type':'application/json'} });
  };
  const server = await createServer({ configFile:false, optimizeDeps:{ noDiscovery:true, include:[] }, plugins:[{
    name:'player-name-client-fixture', enforce:'pre',
    resolveId(source) { if (source === './supabase') return '\0player-name-client'; },
    load(id) { if (id === '\0player-name-client') return `import {createClient} from '@supabase/supabase-js';export const supabase=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:globalThis.playerNameFixtureFetch}});`; },
  }], server:{ middlewareMode:true, hmr:false }, appType:'custom' });
  try {
    const { fetchPlayerNames, readPlayerIds } = await server.ssrLoadModule('/src/services/playerNames.ts');
    assert.deepEqual(readPlayerIds(ids), ids);
    assert.equal(readPlayerIds({ w:'bad', b:ids.b }), null);
    assert.deepEqual(await fetchPlayerNames(ids, new AbortController().signal), { w:'Alice', b:'Bob' });
    assert.equal(requestUrl.pathname, '/rest/v1/profiles');
    assert.equal(requestUrl.searchParams.get('select'), 'id,username');
    assert.equal(requestUrl.searchParams.get('id'), `in.(${ids.w},${ids.b})`);
    await assert.rejects(() => fetchPlayerNames({ w:'bad', b:ids.b }, new AbortController().signal));
    assert.equal(requests, 1);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(() => fetchPlayerNames(ids, abort.signal));
  } finally { await server.close(); delete globalThis.playerNameFixtureFetch; }
});
