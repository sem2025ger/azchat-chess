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
    store.set('chessaz.schachTreff.lastSeek', '2+1');
    assert.equal(core.readLastSeek(storage), '3+2', 'unsupported controls fall back');
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(core.readLastSeek(blocked), '3+2');
    assert.doesNotThrow(() => core.writeLastSeek(blocked, '5+0'));
    assert.deepEqual(core.SEEK_CONTROLS.map(control => control.value), ['1+0', '3+0', '3+2', '5+0', '10+0', '15+10'], 'same controls as club_challenge_action');
    const migration = readFileSync(new URL('../../supabase/migrations/20261112070000_schach_treff_v2_stage2_dm_positions_results.sql', import.meta.url), 'utf8');
    assert.ok(migration.includes("IN ('1+0','3+0','3+2','5+0','10+0','15+10')"));
    const serverSource = readFileSync(new URL('../../server/clubChallenges.js', import.meta.url), 'utf8');
    assert.ok(serverSource.includes("new Set(['1+0', '3+0', '3+2', '5+0', '10+0', '15+10'])"));

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
  assert.match(source, /\{v2Enabled \? \(dmChat \? <ChallengeButton composer targetUserId=\{dmChat\.partnerId\} disabled=\{iBlocked\} \/> : isClub && hideRooms \? <SeekButton \/> : null\) : <ChallengeButton composer \/>\}/);
  assert.match(source, /\{v2Enabled && <FeedbackButton \/>\}/);
  assert.match(source, /\(isClub \|\| hasChatActions \|\| v2Enabled\)/);
  assert.match(source, /\{v2Enabled && !isClub && <div className="st2-general-heading">/);
  assert.match(source, /let threaded = v2Enabled;/);
  assert.match(source, /threaded \? query\.is\('parent_id', null\) : query/);
  const challenges = readFileSync(new URL('../src/components/schachTreff/Challenges.tsx', import.meta.url), 'utf8');
  assert.match(challenges, /seek: time => request\('create',\{clubId,timeControl:time,targetUserId:null\}\)/);
});

test('stage 2 helpers: FEN shape, move counting and feed timeline with finished games', async () => {
  await withVite(async server => {
    const core = await server.ssrLoadModule('/src/components/schachTreff/v2/core.ts');
    assert.ok(core.fenShapeOk('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
    for (const bad of ['', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 x', 'x'.repeat(101)]) assert.equal(core.fenShapeOk(bad), false, bad);
    assert.equal(core.countFullMoves('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'), 4);
    assert.equal(core.countFullMoves('[Event "x"]\n1. d4 {Comment 2. c4} d5 1-0'), 1);
    assert.equal(core.countFullMoves(null), 0);
    const result = { challenge_id: 'c1', completed_at: '2026-11-12T10:05:00Z' };
    const old = { challenge_id: 'c0', completed_at: '2026-11-12T08:00:00Z' };
    const messages = [{ id: 'a', created_at: '2026-11-12T10:00:00Z' }, { id: 'b', created_at: '2026-11-12T10:10:00Z' }];
    const merged = core.mergeTimeline(messages, [result, old], game => ({ id: core.resultMessageId(game), created_at: game.completed_at }));
    assert.deepEqual(merged.map(item => item.id), ['a', 'result:c1', 'b'], 'results sort by completion time; older than the loaded feed are skipped');
    assert.deepEqual(core.mergeTimeline(messages, [], () => null).map(item => item.id), ['a', 'b']);
  });
});

test('stage 2 copy is complete in all six languages with the agreed owner texts', async () => {
  await withVite(async server => {
    const { v2Copy2 } = await server.ssrLoadModule('/src/components/schachTreff/v2/copy2.ts');
    const keys = Object.keys(v2Copy2.de).sort();
    for (const language of ['de', 'en', 'ru', 'ua', 'az', 'tr']) {
      const copy = v2Copy2[language];
      assert.deepEqual(Object.keys(copy).sort(), keys, language);
      assert.deepEqual(Object.keys(copy.refusals).sort(), ['blocked', 'dm_limit', 'dm_not_allowed']);
      for (const [key, value] of Object.entries(copy)) if (typeof value === 'string') assert.ok(value.trim(), `${language}.${key}`);
      assert.match(copy.moves(5), /^5 /);
    }
    assert.equal(v2Copy2.ru.writePrivately, 'Написать лично');
    assert.equal(v2Copy2.ru.whoCanWrite, 'Кто может мне писать?');
    assert.equal(v2Copy2.ru.hideGames, 'Не показывать мои партии в чате');
    assert.equal(v2Copy2.ru.watchGame, 'Смотреть партию');
    assert.equal(v2Copy2.ru.replyWithPosition, 'Ответить позицией');
    assert.equal(v2Copy2.ru.openInAnalysis, 'Открыть в анализе');
    assert.equal(v2Copy2.ru.moves(34), '34 хода');
  });
});

test('stage 2 components render a read-only board, a position card and a finished game card', async () => {
  await withVite(async server => {
    const { MiniBoard, PositionMessage, GameResultCard } = await server.ssrLoadModule('/src/components/schachTreff/v2/Stage2.tsx');
    const { MemoryRouter } = await server.ssrLoadModule('react-router-dom');
    const fen = 'rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq - 1 6';
    const board = renderToStaticMarkup(createElement(MiniBoard, { fen, label: 'Najdorf' }));
    assert.equal((board.match(/<span/g) ?? []).length, 64);
    assert.equal((board.match(/<img/g) ?? []).length, 30);
    assert.match(board, /role="img" aria-label="Najdorf"/);
    assert.match(board, /\/pieces\/classic\/wB\.svg/);
    const position = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PositionMessage, { fen, onReply() {} })));
    for (const label of ['Schwarz am Zug', 'Mit Stellung antworten', 'In der Analyse öffnen']) assert.ok(position.includes(label), label);
    const card = renderToStaticMarkup(createElement(GameResultCard, {
      kind: 'Blitz', onWatch() {},
      game: { challenge_id: 'c', white_id: 'w', black_id: 'b', white_name: 'Tim', black_name: 'Anna', result: '1-0', time_control: '3+2', pgn: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0', completed_at: '2026-11-12T10:00:00Z', initial_fen: null },
    }));
    for (const part of ['Blitz 3+2', 'Tim', 'Anna', '1–0', '4 Züge', 'Weiß gewinnt', 'Partie ansehen']) assert.ok(card.includes(part), part);
    const noMoves = renderToStaticMarkup(createElement(GameResultCard, { kind: 'Blitz', onWatch() {}, game: { challenge_id: 'c', white_id: null, black_id: null, white_name: null, black_name: null, result: '1/2-1/2', time_control: '5+0', pgn: null, completed_at: '2026-11-12T10:00:00Z', initial_fen: null } }));
    assert.match(noMoves, /½–½/);
    assert.match(noMoves, /disabled=""[^>]*>Partie ansehen|>Partie ansehen<\/button>/);
  });
});

test('position replies: legal continuation moves, numbered move line and no unchanged empty replies', async () => {
  await withVite(async server => {
    const core = await server.ssrLoadModule('/src/components/schachTreff/v2/core.ts');
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    assert.equal(core.squareName(0, 0), 'a8');
    assert.equal(core.squareName(7, 4), 'e1');
    assert.equal(core.canPickUp(start, 'e2'), true);
    assert.equal(core.canPickUp(start, 'e7'), false, 'only the side to move');
    assert.equal(core.canPickUp('not a fen', 'e2'), false);
    const e4 = core.playMove(start, 'e2', 'e4');
    assert.equal(e4.san, 'e4');
    assert.ok(e4.fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq'));
    assert.ok(core.fenShapeOk(e4.fen), 'result fits the database FEN check');
    assert.equal(core.playMove(start, 'e2', 'e5'), null, 'illegal move');
    assert.equal(core.playMove(start, 'e7', 'e5'), null, 'wrong side');
    assert.equal(core.playMove(start, 'e3', 'e4'), null, 'empty square');
    const promoted = core.playMove('8/P7/8/8/8/8/k7/7K w - - 0 1', 'a7', 'a8');
    assert.equal(promoted.san, 'a8=Q+');
    assert.equal(core.moveLine(start, ['e4', 'e5', 'Nf3']), '1. e4 e5 2. Nf3');
    assert.equal(core.moveLine('rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq - 1 6', ['e6', 'f4']), '6... e6 7. f4');
    assert.equal(core.moveLine(start, []), '');
    assert.equal(core.positionReplyUnchanged(true, 0, '  '), true, 'identical reply without comment is blocked');
    assert.equal(core.positionReplyUnchanged(true, 1, ''), false);
    assert.equal(core.positionReplyUnchanged(true, 0, 'Wie weiter?'), false);
    assert.equal(core.positionReplyUnchanged(false, 0, ''), false, 'a new position may be the start position');
  });
});

test('one position composer: new position keeps FEN and analysis import; reply starts from the referenced position', async () => {
  await withVite(async server => {
    const { PositionDialog } = await server.ssrLoadModule('/src/components/schachTreff/v2/Stage2.tsx');
    const fen = 'rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq - 1 6';
    const fresh = renderToStaticMarkup(createElement(PositionDialog, { initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', onSend: async () => true, onClose() {} }));
    for (const label of ['Stellung im Chat teilen', 'Stellung (FEN)', 'Aus meiner Analyse', 'Zug zurück', 'Zurücksetzen', 'Zug ausführen']) assert.ok(fresh.includes(label), label);
    assert.doesNotMatch(fresh, /Grundstellung/, 'no prominent starting-position button');
    assert.equal((fresh.match(/<button type="button" aria-label="[a-h][1-8]"/g) ?? []).length, 64, 'interactive board');
    assert.doesNotMatch(fresh, /Mach einen Zug oder schreib einen Kommentar/);
    const reply = renderToStaticMarkup(createElement(PositionDialog, { initialFen: fen, reply: true, onSend: async () => true, onClose() {} }));
    assert.ok(reply.includes('Antwort mit Stellung'));
    assert.ok(reply.includes('Schwarz am Zug'), 'referenced position is preloaded');
    assert.match(reply, /aria-label="g5"[^>]*><img src="\/pieces\/classic\/wB\.svg"/);
    assert.doesNotMatch(reply, /Stellung \(FEN\)|Aus meiner Analyse/, 'a reply continues the position instead of replacing it');
    assert.ok(reply.includes('Mach einen Zug oder schreib einen Kommentar.'));
    assert.match(reply, /<button[^>]*disabled=""[^>]*>Stellung senden<\/button>/, 'unchanged reply cannot be sent');
  });
});

test('position replies are stored as thread replies of the original message and shown in its thread', () => {
  const source = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  assert.match(source, /insert\(\{ club_id: clubId, author_id: user\.id, body, fen, \.\.\.\(root \? \{ parent_id: root\.id \} : \{\}\) \}\)/);
  assert.match(source, /if \(sent && root\) \{ setThread\(root\); setThreadRevision\(value => value \+ 1\); setThreadScroll\(true\); \}/);
  assert.match(source, /onReply=\{fen => v2\.replyPosition\(message, fen\)\}/);
  assert.match(source, /onReply=\{\(\) => setComposer\(\{ fen, root: thread \}\)\}/, 'replies inside a thread keep the thread root as parent');
  assert.equal((source.match(/<PositionDialog /g) ?? []).length, 1, 'a single composer');
  const parts = readFileSync(new URL('../src/components/schachTreff/v2/Parts.tsx', import.meta.url), 'utf8');
  assert.match(parts, /if \(renderPosition && result\.error && isMissingSchema\(result\.error\.code\)\) result = await select\(columns\);/);
});

test('desktop layout fits one screen: chat columns are not resized by the app sidebar rule and scroll on their own', () => {
  const css = readFileSync(new URL('../src/components/schachTreff/v2/v2.css', import.meta.url), 'utf8');
  const sidebar = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(sidebar, /#root aside \{width:2[46]0px;min-width:2[46]0px;max-width:2[46]0px;\}/, 'the global sidebar rule this override neutralises');
  assert.match(css, /#root \.schach-treff\.st-v2 aside\{width:auto;min-width:0;max-width:none\}/);
  assert.match(css, /\.schach-treff\.st-v2 \.st-columns>\.st-rooms\{height:calc\(100dvh - 190px\);min-height:440px;box-sizing:border-box;overflow-y:auto\}/);
  assert.match(css, /\.schach-treff\.st-v2 \.st-messages\{overscroll-behavior-y:auto\}/);
  assert.match(css, /\.st2-thread \.st2-position\{[^}]*width:240px;max-width:100%;[^}]*border:0/);
  assert.match(css, /\.st2-thread \.st2-board\{width:100%!important;height:auto!important;aspect-ratio:1\}/);
});

test('thread scrolls to the newest reply once after a position reply', () => {
  const parts = readFileSync(new URL('../src/components/schachTreff/v2/Parts.tsx', import.meta.url), 'utf8');
  assert.match(parts, /if \(!scrollToEnd \|\| !panel\.current\) return;\n\s*panel\.current\.scrollTop = panel\.current\.scrollHeight;\n\s*onScrolled\?\.\(\);/);
  assert.match(parts, /<aside ref=\{panel\} className="st-surface st2-side st2-thread"/);
  const screen = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  assert.match(screen, /setThreadRevision\(value => value \+ 1\); setThreadScroll\(true\);/);
  assert.match(screen, /scrollToEnd=\{threadScroll\} onScrolled=\{threadScrolled\}/);
});

test('approved v2 composer and header: localized subtitle, real presence and position tooltip', async () => {
  const source = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/schachTreff/v2/v2.css', import.meta.url), 'utf8');
  assert.match(source, /<div className="st2-general-heading">/);
  assert.match(source, /<h2 className="st2-general-title st2-general-motto"><span className="st2-sr-only">\{t\.general\}: <\/span>\{copy1\.subtitle\}<\/h2>/);
  assert.match(source, /<div className="st2-chat-meta">/);
  assert.match(source, /Object\.keys\(channel\.presenceState\(\)\)/, 'presence is measured, not hardcoded');
  assert.match(source, /<PositionTrigger label=\{copy2.sendPosition\}/);
  assert.match(css, /\.st-chat-header \.st2-seek-popover\{top:calc\(100% \+ 10px\);bottom:auto/);
  const { v2Copy } = await (async () => {
    let value;
    await withVite(async server => { value = await server.ssrLoadModule('/src/components/schachTreff/v2/copy.ts'); });
    return value;
  })();
  for (const locale of ['de', 'en', 'ru', 'ua', 'az', 'tr']) {
    assert.ok(v2Copy[locale].subtitle && v2Copy[locale].onlineNow);
  }
  assert.equal(v2Copy.ru.subtitle, 'для немецкоязычных шахматистов');
  assert.equal(v2Copy.ru.onlineNow, 'в сети');
});

test('approved HTML reference: all v2 columns, responsive members, and real open challenges', async () => {
  const source = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/schachTreff/v2/v2.css', import.meta.url), 'utf8');
  const parts = readFileSync(new URL('../src/components/schachTreff/v2/Parts.tsx', import.meta.url), 'utf8');
  assert.match(source, /<MembersPanel members=\{members\} messages=\{messages\} me=\{user\?\.id\} onlineIds=\{onlineIds\}/);
  assert.match(css, /\.schach-treff\.st-v2 \.st2-side:not\(\.st2-thread\)\{display:flex/);
  assert.match(css, /grid-template-columns:240px minmax\(0,1fr\) 300px/);
  assert.match(parts, /challenges\.rows\.find\(row => row\.status === 'open'/);
  assert.match(parts, /onClick=\{\(\) => challenges\?\.act\('accept', offer\.id\)\}/);
  const { v2Copy } = await (async () => {
    let value;
    await withVite(async server => { value = await server.ssrLoadModule('/src/components/schachTreff/v2/copy.ts'); });
    return value;
  })();
  for (const locale of ['de','en','ru','ua','az','tr']) {
    for (const key of ['onlineInChat','seeking','seekUnavailable','myClubs']) assert.ok(v2Copy[locale][key], key + ' ' + locale);
  }
});

test('challenge creator opens the started game even when match_found went to another tab of the same user', async () => {
  await withVite(async server => {
    const { ownStartedGame, gamePath } = await server.ssrLoadModule('/src/components/schachTreff/challengeRouting.ts');
    const me = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
    const room = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const row = { id: 'c1', message_id: 'm1', created_by: me, target_user_id: null, time_control: '3+2', status: 'accepted', expires_at: '2026-11-13T05:00:00Z', room_id: room, accepted_by: other };
    assert.equal(ownStartedGame([row], me, new Set(['c1']), new Set()), room, 'offer created in this tab → open its game');
    assert.equal(gamePath(room), `/play?roomId=${room}`, 'colour comes from the server on reconnect');
    assert.equal(ownStartedGame([row], me, new Set(), new Set()), null, 'offers from other tabs or old offers are not auto-opened');
    assert.equal(ownStartedGame([row], me, new Set(['c1']), new Set([room])), null, 'opened once (match_found or earlier load)');
    assert.equal(ownStartedGame([{ ...row, room_id: null }], me, new Set(['c1']), new Set()), null, 'game not started yet');
    assert.equal(ownStartedGame([{ ...row, room_id: 'not-a-room' }], me, new Set(['c1']), new Set()), null);
    assert.equal(ownStartedGame([{ ...row, status: 'open' }], me, new Set(['c1']), new Set()), null);
    assert.equal(ownStartedGame([{ ...row, created_by: other }], me, new Set(['c1']), new Set()), null, 'the acceptor is routed by its own match_found');
  });
});

test('challenge card links both players to the started game; composer position button is a small chess board', () => {
  const challenges = readFileSync(new URL('../src/components/schachTreff/Challenges.tsx', import.meta.url), 'utf8');
  assert.match(challenges, /select\('id,message_id,created_by,target_user_id,time_control,status,expires_at,room_id,accepted_by'\)/);
  assert.match(challenges, /\(row\.created_by===me \|\| row\.accepted_by===me\) && <Link className="st-challenge-open" to=\{gamePath\(row\.room_id\)\}>\{t\.openGame\}<\/Link>/);
  assert.match(challenges, /if \(roomId\) \{ opened\.current\.add\(roomId\); navigate\(gamePath\(roomId\)\); \}/);
  const i18n = readFileSync(new URL('../src/components/schachTreff/i18n.ts', import.meta.url), 'utf8');
  assert.match(i18n, /"Zur Partie": \{\n    "de": "Zur Partie",\n    "en": "Open game",\n    "az": "[^"]+",\n    "tr": "[^"]+",\n    "ua": "[^"]+",\n    "ru": "Открыть партию"/);
  const parts = readFileSync(new URL('../src/components/schachTreff/v2/Parts.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(parts, /Grid3x3/);
  assert.match(parts, /<MiniBoardIcon \/>\n  <\/button>;/);
  const screen = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  assert.match(screen, /\{v2Enabled && !dmChat && !hideRooms && <SeekButton \/>\}/, 'desktop club rooms keep a way to seek an opponent (header)');
  assert.match(screen, /isClub && hideRooms \? <SeekButton \/> : null/, 'compact mobile room view keeps Seek in the composer');
});

test('finished challenge games: no "Open game" link, card says the game is over; unread badges are not stretched', () => {
  const challenges = readFileSync(new URL('../src/components/schachTreff/Challenges.tsx', import.meta.url), 'utf8');
  assert.match(challenges, /<p>\{finished \? t\.gameFinished : row\.room_id \? t\.gameStarted : t\.gameStarting\}<\/p>\{!finished && row\.room_id/);
  assert.match(challenges, /finished=\{context\.finished\.has\(row\.id\)\}/);
  const screen = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  assert.match(screen, /const finishedChallenges = new Set\(v2Data\?\.results\.map\(result => result\.challenge_id\) \?\? \[\]\);/);
  assert.match(screen, /enabled=\{member\} finished=\{finishedChallenges\}>/);
  const i18n = readFileSync(new URL('../src/components/schachTreff/i18n.ts', import.meta.url), 'utf8');
  assert.match(i18n, /"Partie beendet": \{\n    "de": "Partie beendet",\n    "en": "Game over",[\s\S]*?"ru": "Партия завершена"/);
  const index = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(index, /aside \[role=img\]\{margin-top:10px!important;min-height:52px!important\}/, 'the global rule this override neutralises');
  const css = readFileSync(new URL('../src/components/schachTreff/v2/v2.css', import.meta.url), 'utf8');
  assert.match(css, /#root \.schach-treff\.st-v2 aside \[role=img\]\{margin-top:0!important;min-height:0!important\}/);
  const stage2 = readFileSync(new URL('../src/components/schachTreff/v2/Stage2.tsx', import.meta.url), 'utf8');
  assert.match(stage2, /\{!parsed\?\.moveHistory\.length \? <p>\{copy\.noMoves\}<\/p>/, 'a game resigned before the first move is not reported as "not saved"');
});

test('notices float as toasts (no layout jump); a blocked DM partner disables the composer', async () => {
  await withVite(async server => {
    const { Toast } = await server.ssrLoadModule('/src/components/schachTreff/v2/Toast.tsx');
    const html = renderToStaticMarkup(createElement(Toast, { message: 'Nachrichten zwischen euch sind blockiert.', closeLabel: 'Schließen', onClose() {} }));
    assert.match(html, /^<div class="st2-toast" role="alert" data-tone="alert"><span>Nachrichten zwischen euch sind blockiert\.<\/span><button type="button" class="st2-icon-button" aria-label="Schließen">/);
    assert.equal(renderToStaticMarkup(createElement(Toast, { message: '', closeLabel: 'x', onClose() {} })), '');
  });
  const css = readFileSync(new URL('../src/components/schachTreff/v2/v2.css', import.meta.url), 'utf8');
  assert.match(css, /\.st2-toast\{position:fixed;/, 'out of the layout flow');
  const screen = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  assert.match(screen, /\{error && \(v2Enabled \? <Toast message=\{error\} closeLabel=\{t\.close\} onClose=\{\(\) => setError\(''\)\} \/> : <p role="alert">\{error\}<\/p>\)\}/, 'flag off keeps the old inline alert');
  assert.match(screen, /dmOpen\.error && \(v2Enabled \? <Toast/);
  assert.match(screen, /const iBlocked = Boolean\(dmChat && block\.blocked\);/);
  assert.match(screen, /disabled=\{iBlocked\} \/>\n\s*<button className="st-send" disabled=\{busy \|\| iBlocked \|\| !body\.trim\(\)\}>/);
  const challenges = readFileSync(new URL('../src/components/schachTreff/Challenges.tsx', import.meta.url), 'utf8');
  assert.match(challenges, /\{error && !shown && \(v2Enabled \? <Toast/);
});

test('owner 13 Nov: feed headline is the motto, bronze "General chat" link, blocked DM re-checked and fully inactive', async () => {
  const screen = readFileSync(new URL('../src/screens/SchachTreffDesktop.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/schachTreff/v2/v2.css', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  // 1. The visible "General chat" heading is gone from the feed; the motto replaces it (name kept for screen readers).
  assert.doesNotMatch(screen, /<h2 className="st2-general-title">\{t\.general\}<\/h2>/);
  assert.doesNotMatch(screen, /st2-general-subtitle/);
  assert.match(screen, /import '@fontsource\/bodoni-moda\/latin-600-italic\.css';/);
  assert.match(index, /#root :is\(button,input,select,textarea,label,p,small,dt,dd,summary,a,h2,h3,h4,h5,h6\)\{font-family:Inter[^}]*!important;font-style:normal!important\}/, 'the global rule the motto has to beat');
  assert.match(css, /#root \.schach-treff\.st-v2 \.st2-general-heading \.st2-general-motto\{[^}]*font-family:'Bodoni Moda',Georgia,serif!important;font-size:27px;font-style:italic!important;/);
  assert.match(css, /\.st2-general-heading\{flex:1 1 250px\}/, 'the motto never wraps into three narrow lines; online + Seek move below instead');
  // 2. Rooms column: larger "General chat" in the Seek button font, bronze-metallic text.
  const link = readFileSync(new URL('../src/components/schachTreff/GeneralRoomLink.tsx', import.meta.url), 'utf8');
  assert.match(link, /<span className="st-general-label">\{label\}<\/span>/);
  assert.match(css, /\.st-rooms \.st-general-link\{min-height:54px;[^}]*font-size:17px;font-weight:600;/);
  assert.match(css, /\.st-general-link \.st-general-label\{[^}]*background:linear-gradient\(180deg,[^}]*background-clip:text;[^}]*-webkit-text-fill-color:transparent\}/);
  // 3. Block state: re-read on tab focus and after a refused send; every composer action is disabled.
  const stage2 = readFileSync(new URL('../src/components/schachTreff/v2/Stage2.tsx', import.meta.url), 'utf8');
  assert.match(stage2, /window\.addEventListener\('focus', reload\)/);
  assert.match(stage2, /\}, \[user, partnerId, revision\]\);/);
  assert.match(stage2, /return \{ blocked, busy, toggle, reload \};/);
  assert.match(screen, /else if \(dmChat\) block\.reload\(\);/);
  assert.match(screen, /<ChallengeButton composer targetUserId=\{dmChat\.partnerId\} disabled=\{iBlocked\} \/>/);
  assert.match(screen, /<PositionTrigger label=\{copy2\.sendPosition\} disabled=\{iBlocked\}/);
  assert.match(screen, /placeholder=\{iBlocked \? copy2\.composerBlocked :/);
  assert.match(screen, /required=\{!v2Enabled\} disabled=\{iBlocked\}/, 'v2: an empty submit re-checks the block instead of a browser bubble');
  assert.match(css, /\.st-composer-challenge:disabled,\.schach-treff\.st-v2 \.st2-position-trigger:disabled\{opacity:\.45;cursor:not-allowed\}/);
  const challenges = readFileSync(new URL('../src/components/schachTreff/Challenges.tsx', import.meta.url), 'utf8');
  assert.match(challenges, /title=\{composer \? t\.challengePlayer : undefined\} disabled=\{disabled\}/);
  assert.match(css, /@media\(min-width:1024px\) and \(max-width:1599px\)\{\n  \.schach-treff\.st-v2 \.st-chat \.st-composer \.st-composer-challenge\{[^}]*width:44px/, 'DM input keeps its width on medium desktops');
  await withVite(async server => {
    const { PositionTrigger } = await server.ssrLoadModule('/src/components/schachTreff/v2/Parts.tsx');
    assert.match(renderToStaticMarkup(createElement(PositionTrigger, { label: 'Position', disabled: true, onClick() {} })), /<button type="button" class="st2-position-trigger" data-hint="Position" aria-label="Position" title="Position" disabled="">/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(PositionTrigger, { label: 'Position', onClick() {} })), /disabled/);
    const { v2Copy2 } = await server.ssrLoadModule('/src/components/schachTreff/v2/copy2.ts');
    for (const locale of ['de', 'en', 'ru', 'ua', 'az', 'tr']) assert.ok(v2Copy2[locale].composerBlocked, locale);
    assert.equal(v2Copy2.ru.composerBlocked, 'Чат заблокирован');
  });
  // Message actions (⋯) sit in the hover toolbar on mouse devices instead of an extra line.
  assert.match(css, /@media\(any-pointer:fine\)\{/);
});
