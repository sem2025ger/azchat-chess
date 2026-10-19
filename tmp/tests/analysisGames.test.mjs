import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

test('game library uses participant filters, bounded pages and validates PGN before loading', async () => {
  let requestUrl;
  let payload = [];
  globalThis.analysisFixtureFetch = async (url, options) => {
    requestUrl = new URL(url);
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify(payload), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  const server = await createServer({ configFile:false, optimizeDeps:{noDiscovery:true,include:[]}, plugins:[{
    name:'analysis-client-fixture', enforce:'pre',
    resolveId(source) { if (source === './supabase') return '\0analysis-client'; },
    load(id) { if (id === '\0analysis-client') return `import {createClient} from '@supabase/supabase-js';
      export const supabase=createClient('https://fixture.supabase.co','fixture-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:globalThis.analysisFixtureFetch}});`; },
  }], server:{middlewareMode:true,hmr:false}, appType:'custom' });
  try {
    const { fetchAnalysisGame, fetchAnalysisGames } = await server.ssrLoadModule('/src/services/analysisGames.ts');
    payload = Array.from({ length:26 }, (_, index) => ({ id:String(index), white_id:USER, black_id:OTHER, result:'1-0' }));
    const page = await fetchAnalysisGames(USER, 1, new AbortController().signal);
    assert.equal(page.games.length, 25); assert.equal(page.hasMore, true);
    assert.equal(requestUrl.searchParams.get('offset'), '25');
    assert.equal(requestUrl.searchParams.get('limit'), '26');
    assert.equal(requestUrl.searchParams.get('status'), 'eq.completed');
    assert.ok(requestUrl.searchParams.get('or').includes(`white_id.eq.${USER},black_id.eq.${USER}`));
    assert.ok(!requestUrl.searchParams.get('select').includes('pgn'));
    assert.equal(requestUrl.searchParams.get('order'), 'completed_at.desc,id.desc');

    payload = { id:'owned', white_id:USER, black_id:OTHER, pgn:'1. e4 e5 2. Nf3 *', initial_fen:null };
    const game = await fetchAnalysisGame(USER, 'owned', new AbortController().signal);
    assert.deepEqual(game.moveHistory, ['e4','e5','Nf3']);
    assert.equal(game.positionHistory.length, 4);
    assert.equal(requestUrl.searchParams.get('id'), 'eq.owned');
    assert.ok(requestUrl.searchParams.get('or').includes(USER));
    payload = { ...payload, white_id:OTHER, black_id:OTHER };
    await assert.rejects(() => fetchAnalysisGame(USER, 'foreign', new AbortController().signal));
    payload = { ...payload, white_id:USER, pgn:'1. e4 e4' };
    await assert.rejects(() => fetchAnalysisGame(USER, 'broken', new AbortController().signal));
    await assert.rejects(() => fetchAnalysisGames('bad,filter', 0, new AbortController().signal));
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(() => fetchAnalysisGames(USER, 0, aborted.signal));
  } finally { await server.close(); delete globalThis.analysisFixtureFetch; }
});
