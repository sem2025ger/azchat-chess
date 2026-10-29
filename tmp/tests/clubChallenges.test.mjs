import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

test('actual challenge cards render only permitted actions and German lifecycle states', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { ChallengeCard, ChallengeProvider } = await server.ssrLoadModule('/src/components/schachTreff/Challenges.tsx');
    const row = { id: 'offer', created_by: 'a', target_user_id: null, time_control: '3+2', status: 'open', expires_at: '2026-10-26T20:00:00Z', room_id: null };
    const render = (overrides = {}, me = 'b') => renderToStaticMarkup(createElement(ChallengeCard, { row: { ...row, ...overrides }, me, people: [{ id: 'a', username: 'Alice' }, { id: 'b', username: 'Bob' }], busy: false, now: Date.parse('2026-10-26T19:55:00Z'), act() {} }));
    assert.match(render(), />Annehmen<\/button>/);
    assert.match(render(), /Partie <span class="st-mono">3\+2/);
    assert.doesNotMatch(render(), /gewertet/);
    assert.doesNotMatch(render({ target_user_id: 'c' }), />Annehmen<\/button>/);
    assert.match(render({}, 'a'), /Wartet auf Gegner/);
    assert.doesNotMatch(render({}, 'a'), />Annehmen<\/button>/);
    for (const [status, label] of [['expired', 'Abgelaufen'], ['cancelled', 'Abgebrochen'], ['accepted', 'Partie startet …']]) {
      const html = render({ status });
      assert.ok(html.includes(label));
      assert.doesNotMatch(html, />Annehmen<\/button>/);
    }
    assert.match(render({ expires_at: '2026-10-26T19:50:00Z' }), /Abgelaufen/);
    const dialog = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ChallengeProvider, { clubId: 'club', me: 'a', people: [], enabled: false }, 'chat')));
    for (const label of ['Herausforderung', 'Offen für alle', 'Persönliche Herausforderung', 'Bedenkzeit', 'Herausforderung senden', '3+2', '5+0', '10+0']) assert.ok(dialog.includes(label));
    assert.ok(dialog.includes('chat'), 'missing migration does not remove chat');
  } finally { await server.close(); }
});

test('legacy mobile community renders challenge bodies as text without new controls', () => {
  const source = readFileSync(new URL('../src/screens/ChessAZCommunityScreen.tsx', import.meta.url), 'utf8');
  const legacy = source.split('function LegacyCommunityScreen() {')[1];
  assert.match(legacy, /<p className="whitespace-pre-wrap break-words text-sm">\{item.body\}<\/p>/);
  assert.doesNotMatch(legacy, /ChallengeProvider|ChallengeMessage|ChallengeButton/);
});
