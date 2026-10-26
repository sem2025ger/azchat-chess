import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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
