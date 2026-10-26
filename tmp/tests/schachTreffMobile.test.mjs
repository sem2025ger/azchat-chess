import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('temporary Russian review copy covers every German interface label', async () => {
  const source = stripTypeScriptTypes(read('../src/components/schachTreff/copy.ts'));
  const { copy, russianCopy } = await import('data:text/javascript,' + encodeURIComponent(source));
  assert.deepEqual(Object.keys(russianCopy).sort(), Object.keys(copy).sort());
  for (const key of Object.keys(copy)) {
    assert.ok(russianCopy[key].trim(), `Russian text is required for ${key}`);
    if (key !== 'title') assert.notEqual(russianCopy[key], copy[key], `${key} must switch language`);
  }
  assert.equal(copy.general, 'Allgemein');
  assert.equal(russianCopy.general, 'Общий чат');
  assert.equal(copy.reviewLanguage, 'Русский');
  assert.equal(russianCopy.reviewLanguage, 'Deutsch');
});
test('legacy community implementation remains byte-identical to approved main', () => {
  const baseline = execFileSync('git', ['show', '4af51e5:tmp/src/screens/ChessAZCommunityScreen.tsx'], {encoding:'utf8'}).replace(/\r\n/g, '\n');
  const current = read('../src/screens/ChessAZCommunityScreen.tsx');
  assert.equal(current.split('function LegacyCommunityScreen() {')[1], baseline.split('export default function ChessAZCommunityScreen() {')[1]);
  assert.match(current, /return desktop \? <SchachTreffDesktop \/> : <LegacyCommunityScreen \/>/);
  assert.match(read('../src/components/schachTreff/useDesktop.ts'), /\(min-width: 1024px\)/);
  for (const width of [360,390,430,768]) assert.equal(width >= 1024, false);
});
test('mobile navigation JSX is unchanged', () => {
  const baseline = execFileSync('git', ['show', '4af51e5:tmp/src/components/Layout.tsx'], {encoding:'utf8'}).replace(/\r\n/g, '\n');
  const current = read('../src/components/Layout.tsx');
  const nav = source => source.split('<nav data-mobile-app-nav')[1].split('</nav>')[0];
  assert.equal(nav(current), nav(baseline));
  assert.equal(current.split('function MobileNavItem')[1], baseline.split('function MobileNavItem')[1]);
});
test('desktop names are stored usernames without suffix stripping or pseudonyms', () => {
  const current = read('../src/screens/SchachTreffDesktop.tsx');
  assert.doesNotMatch(current, /cleanDisplayName|displayPlayerName/);
  assert.match(current, /\{author.username\}/);
});
test('desktop player card renders — unconditionally and never shows stored placeholder ratings', () => {
  const current = read('../src/screens/SchachTreffDesktop.tsx');
  const cardBranch = current.split('{player ? ')[1]?.split(' : panel === ')[0] ?? '';
  assert.ok(cardBranch.includes('<dl><dt>{t.blitz}</dt><dd>—</dd><dt>{t.rapid}</dt><dd>—</dd></dl>'));
  assert.doesNotMatch(cardBranch, /rating_blitz|rating_rapid|1200|1500/);
});
test('desktop ranking shows the upcoming-rating note without rating data or member ordering', () => {
  const current = read('../src/screens/SchachTreffDesktop.tsx');
  assert.doesNotMatch(current, /rating_blitz|rating_rapid/);
  const rankingBranch = current.split("panel === 'ranking' ? ")[1]?.split(' : panel && ')[0] ?? '';
  assert.equal(rankingBranch, '<><h2>{t.ranking}</h2><p>{t.rankingSoon}</p></>');
  assert.match(read('../src/components/schachTreff/copy.ts'), /rankingSoon: 'Rangliste folgt mit der Elo-Wertung'/);
});

test('missing pin migration disables admin/moderator controls while chat still loads', async () => {
  const current = read('../src/screens/SchachTreffDesktop.tsx');
  const refreshBody = current.split('const refresh = useCallback(async () => {')[1].split('}, [user]);')[0]
    .replace('let pinnedAuthor: string | null', 'let pinnedAuthor');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const code of ['42703', 'PGRST204', 'PGRST205', null]) {
    for (const role of ['admin', 'moderator', 'member']) {
      const state = {};
      const calls = [];
      const setters = [...new Set(current.match(/set[A-Z]\w+(?=\()/g))];
      const supabase = { from(table) {
        let columns;
        const query = {
          select(value) { columns = value; return query; },
          eq() { return query; }, order() { return query; }, limit() { return query; }, in() { return query; },
          maybeSingle() { return query; },
          then(resolve) {
            calls.push([table, columns]);
            if (table === 'chess_clubs') return resolve(columns === 'id' ? { data: { id: 'club' } } : code ? { error: { code } } : { data: { pinned_body: 'Pinned', pinned_by: 'user' } });
            if (table === 'chess_club_members') return resolve({ data: columns.includes('role') ? { user_id: 'user', role } : [{ user_id: 'user' }] });
            if (table === 'chess_club_messages') return resolve({ data: [{ id: 'message', author_id: 'user', body: 'Chat works' }] });
            return resolve({ data: [{ id: 'user', username: 'Player' }] });
          },
        };
        return query;
      } };
      await new AsyncFunction('supabase', 'user', 'warned', 'console', ...setters, refreshBody)(
        supabase, { id: 'user' }, new Set(), { warn() {} },
        ...setters.map(name => value => { state[name] = value; }),
      );
      assert.equal(state.setPinAvailable, code === null);
      assert.equal(state.setCanPin, code === null && role !== 'member');
      assert.equal(state.setMessages[0].body, 'Chat works');
      assert.ok(calls.some(([table]) => table === 'chess_club_messages'));
      if (code) { assert.equal(state.setPin, null); assert.equal(state.setPinEdit, false); }
    }
  }
  assert.match(current, /\{pinAvailable && \(pin \|\| canPin\) &&/);
});

test('saving a pin cannot call the RPC when its migration is unavailable', async () => {
  const current = read('../src/screens/SchachTreffDesktop.tsx');
  const saveBody = current.split('async function savePin(event: FormEvent) {')[1].split('\n  function stamp')[0].replace(/\n  }\s*$/, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let attempted = false;
  await new AsyncFunction('event', 'clubId', 'pinAvailable', 'canPin', 'busy', 'perform', saveBody)(
    { preventDefault() {} }, 'club', false, true, false, () => { attempted = true; },
  );
  assert.equal(attempted, false);
});
