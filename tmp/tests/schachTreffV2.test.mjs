import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

async function withVite(run) {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try { await run(server); } finally { await server.close(); }
}

test('v2 helpers: stable name colours, reaction summaries, reply counts, seek memory and activity', async () => {
  await withVite(async server => {
    const core = await server.ssrLoadModule('/src/components/schachTreff/v2/core.ts');
    assert.equal(core.v2Enabled, false, 'flag defaults off');
    const id = '6f1c1d3e-8f7a-4b8e-9c55-0d0e7a1b2c3d';
    assert.equal(core.nameColor(id), core.nameColor(id));
    assert.ok(core.NAME_COLORS.includes(core.nameColor(id)));
    const spread = new Set(Array.from({ length: 64 }, (_, n) => core.nameColor('user-' + n)));
    assert.ok(spread.size >= 6, 'colours are spread across the palette');

    const summary = core.summarizeReactions([
      { message_id: 'm1', user_id: 'a', reaction: '!?' },
      { message_id: 'm1', user_id: 'b', reaction: '!!' },
      { message_id: 'm1', user_id: 'me', reaction: '!!' },
      { message_id: 'm1', user_id: 'c', reaction: '??' },
      { message_id: 'm2', user_id: 'a', reaction: '!' },
    ], 'me');
    assert.deepEqual(summary.get('m1'), [{ reaction: '!!', count: 2, mine: true }, { reaction: '!?', count: 1, mine: false }]);
    assert.deepEqual(summary.get('m2'), [{ reaction: '!', count: 1, mine: false }]);
    assert.equal(summary.get('m3'), undefined);

    assert.deepEqual([...core.countReplies([{ parent_id: 'a' }, { parent_id: 'a' }, { parent_id: null }, { parent_id: 'b' }])], [['a', 2], ['b', 1]]);
    assert.ok(core.isMissingSchema('42703') && core.isMissingSchema('PGRST205') && !core.isMissingSchema('42501') && !core.isMissingSchema(undefined));

    const store = new Map();
    const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    assert.equal(core.readLastSeek(storage), '3+2');
    core.writeLastSeek(storage, '10+0');
    assert.equal(core.readLastSeek(storage), '10+0');
    store.set('chessaz.schachTreff.lastSeek', '1+0');
    assert.equal(core.readLastSeek(storage), '3+2', 'unsupported controls fall back');
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(core.readLastSeek(blocked), '3+2');
    assert.doesNotThrow(() => core.writeLastSeek(blocked, '5+0'));
    assert.deepEqual(core.SEEK_CONTROLS.map(control => control.value), ['3+2', '5+0', '10+0'], 'same controls as club_challenge_action');

    const now = Date.parse('2026-11-12T12:00:00Z');
    const active = core.recentlyActive([
      { author_id: 'fresh', created_at: '2026-11-12T11:50:00Z' },
      { author_id: 'old', created_at: '2026-11-12T11:30:00Z' },
      { author_id: 'bad', created_at: 'not a date' },
    ], now);
    assert.deepEqual([...active], ['fresh']);
  });
});

test('v2 copy is complete in all six languages and matches the agreed owner texts', async () => {
  await withVite(async server => {
    const { v2Copy } = await server.ssrLoadModule('/src/components/schachTreff/v2/copy.ts');
    const languages = ['de', 'en', 'ru', 'ua', 'az', 'tr'];
    assert.deepEqual(Object.keys(v2Copy).sort(), [...languages].sort());
    const keys = Object.keys(v2Copy.de).sort();
    for (const language of languages) {
      const copy = v2Copy[language];
      assert.deepEqual(Object.keys(copy).sort(), keys, language);
      for (const [key, value] of Object.entries(copy)) {
        if (typeof value === 'string') assert.ok(value.trim().length > 0, `${language}.${key}`);
      }
      assert.deepEqual(Object.keys(copy.reactionNames), ['!!', '!', '!?']);
      assert.match(copy.replies(2), /^2 /);
    }
    assert.equal(v2Copy.ru.feedbackButton, 'Ваше мнение: идеи и проблемы');
    assert.equal(v2Copy.de.feedbackButton, 'Feedback: Ideen und Probleme');
    assert.equal(v2Copy.ru.feedbackPlaceholder, 'Например: доска на телефоне слишком маленькая');
    assert.equal(v2Copy.ru.seek, 'Ищу соперника');
    assert.equal(v2Copy.ru.replies(1), '1 ответ');
    assert.equal(v2Copy.ru.replies(3), '3 ответа');
    assert.equal(v2Copy.ru.replies(11), '11 ответов');
    assert.equal(v2Copy.ua.replies(22), '22 відповіді');
  });
});

test('v2 reaction controls render accessible chess annotations; seek stays hidden without a live challenge path', async () => {
  await withVite(async server => {
    const { ReactionBar, MessageTools, SeekButton } = await server.ssrLoadModule('/src/components/schachTreff/v2/Parts.tsx');
    const { ChallengeProvider } = await server.ssrLoadModule('/src/components/schachTreff/Challenges.tsx');
    const { MemoryRouter } = await server.ssrLoadModule('react-router-dom');
    const bar = renderToStaticMarkup(createElement(ReactionBar, {
      summary: [{ reaction: '!!', count: 2, mine: true }, { reaction: '!?', count: 1, mine: false }],
      replies: 2, onToggle() {}, onThread() {},
    }));
    assert.match(bar, /aria-pressed="true"[^>]*aria-label="Brillant \(!!\): 2"/);
    assert.match(bar, /2 Antworten →/);
    assert.equal(renderToStaticMarkup(createElement(ReactionBar, { summary: [], replies: 0, onToggle() {}, onThread() {} })), '');
    const tools = renderToStaticMarkup(createElement(MessageTools, { summary: [{ reaction: '!', count: 1, mine: true }], onToggle() {}, onThread() {} }));
    for (const label of ['Brillant (!!)', 'Guter Zug (!)', 'Interessant (!?)', 'Im Thread antworten']) assert.ok(tools.includes(label), label);
    assert.match(tools, /aria-pressed="true"[^>]*aria-label="Guter Zug \(!\)"/);
    const seek = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(ChallengeProvider, { clubId: 'club', me: 'a', people: [], enabled: false }, createElement(SeekButton))));
    assert.doesNotMatch(seek, /Gegner suchen/, 'no seek button while challenges are unavailable');
  });
});

test('flag off keeps the existing Schach-Treff markup paths', () => {
  const source = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  assert.match(source, /className=\{v2Enabled \? 'schach-treff st-v2' : 'schach-treff'\}/);
  assert.match(source, /\{v2Enabled \? <SeekButton \/> : <ChallengeButton composer \/>\}/);
  assert.match(source, /\{v2Enabled && <FeedbackButton \/>\}/);
  assert.match(source, /\(isClub \|\| hasChatActions \|\| v2Enabled\)/);
  assert.match(source, /\{v2Enabled && !isClub && <h2 className="st2-general-title">\{t\.general\}<\/h2>\}/);
  assert.match(source, /let threaded = v2Enabled;/);
  assert.match(source, /threaded \? query\.is\('parent_id', null\) : query/);
  const challenges = readFileSync(new URL('../src/components/schachTreff/Challenges.tsx', import.meta.url), 'utf8');
  assert.match(challenges, /seek: time => request\('create',\{clubId,timeControl:time,targetUserId:null\}\)/);
});
