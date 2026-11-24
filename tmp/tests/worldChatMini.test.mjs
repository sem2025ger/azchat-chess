import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const layout = read('../src/components/Layout.tsx');
const chat = read('../src/screens/SchachTreffDesktop.tsx');
const wrapper = read('../src/screens/WorldChatScreen.tsx');
const translations = read('../src/translations.ts');
const invites = read('../src/screens/ClubInviteScreen.tsx');
const migration = read('../../supabase/migrations/20261117080000_world_chat_invite_only_schach_treff.sql');

test('World Chat is a separate, default-off v2-only route with its own lazy-loaded screen', () => {
  assert.match(app, /VITE_WORLD_CHAT_ENABLED === 'true' && import\.meta\.env\.VITE_SCHACH_TREFF_V2 === 'true'/);
  assert.match(app, /path="world-chat" element=\{<WorldChatScreen \/>\}/);
  assert.match(read('../src/routeLoaders.ts'), /worldChat: cacheImport\(\(\) => import\('\.\/screens\/WorldChatScreen'\)\)/);
  assert.match(wrapper, /<ChessAZCommunityScreen worldChat \/>/);
  assert.match(layout, /to="\/world-chat".*label=\{t\('world\.title'\)\}/);
  const mobile = read('../src/screens/ChessAZCommunityScreen.tsx');
  assert.match(mobile, /worldChat = false/);
  assert.match(mobile, /<CommunityRouter worldChat=\{worldChat\} \/>/);
  assert.match(mobile, /<SchachTreffDesktop hideRooms \/>/);
  assert.match(mobile, /href=\{homePath\}/);
  assert.match(mobile, /worldChat \? 'world-chat' : 'chessaz-deutsch'/);
});

test('World Chat always selects the world-chat slug and cannot open another club through query parameters', () => {
  assert.match(chat, /const requested = typeof window === 'undefined' \|\| worldRoute \? null/);
  assert.match(chat, /const communitySlug = worldRoute \? 'world-chat' : 'chessaz-deutsch'/);
  assert.match(chat, /query\.eq\('id',requested\) : query\.eq\('slug',communitySlug\)/);
  assert.match(chat, /const isClub = !worldChat && new URLSearchParams/);
  assert.match(chat, /worldChat \? siteT\('world.title'\) : t.general/);
  assert.match(chat, /href=\{worldChat \? '\/world-chat' : '\/chat'\}/);
  assert.doesNotMatch(chat, /compact=\{worldChat\}/);
  assert.match(chat, /: <MembersPanel members=\{members\}/);
  assert.match(chat, /onThread=\{\(\) => v2\.openThread\(message\)\}/);
  assert.match(chat, /replies=\{v2\.replies\.get\(message.id\) \?\? 0\}/);
  assert.match(chat, /onReply=\{fen => v2\.replyPosition\(message, fen\)\}/);
});

test('both chat routes share reactions, threads, position replies, members, DMs and moderation', () => {
  const mobile = read('../src/screens/ChessAZCommunityScreen.tsx');
  const rooms = read('../src/components/schachTreff/GeneralRoomLink.tsx');
  assert.match(chat, /<DirectList currentClubId=\{clubId\} \/>/);
  assert.match(chat, /const direct = useDirectChats\(v2Enabled \? user\?\.id : undefined\)/);
  assert.match(chat, /\{pinAvailable && \(pin \|\| canPin\) &&/);
  assert.match(chat, /<MembersPanel members=\{members\}/);
  assert.match(chat, /<ThreadPanel key=\{thread.id\}/);
  assert.match(chat, /<PositionDialog initialFen=\{composer.fen\}/);
  assert.match(chat, /<MessageTools summary=\{summary\}/);
  assert.match(chat, /<MessageActions message=\{message\}/);
  assert.match(chat, /<WorldChatShareLink \/>/);
  assert.match(chat, /<PlayerSummary userId=\{player.id\}>/);
  assert.match(mobile, /<LegacyCommunityScreen worldChat=\{worldChat\} \/>/);
  assert.match(mobile, /siteT\('world.aboutText'\)/);
  assert.match(mobile, /onClick=\{joinWorldChat\}/);
  assert.match(rooms, /href=\{href\}/);
  assert.match(rooms, /<UnreadBadge clubId=\{worldClubId\}/);
});

test('Schach-Treff cannot be joined directly in the UI and invited members return to its canonical route', () => {
  assert.match(chat, /!member \? \(worldChat \? <div/);
  assert.match(chat, /siteT\('schach\.inviteOnly'\)/);
  assert.match(invites, /joined\.slug === 'chessaz-deutsch'/);
  assert.match(invites, /\? '\/chat' : '\/chat\?' \+ new URLSearchParams/);
  assert.match(chat, /communitySlug === 'chessaz-deutsch'\) && \['admin','moderator'\]/);
  const legacy = read('../src/screens/ChessAZCommunityScreen.tsx');
  assert.doesNotMatch(legacy, /onClick=\{membershipAction\}/, 'legacy mobile must not expose direct Schach join');
  assert.match(legacy, /worldChat \? 'world.joinHint' : 'schach.inviteOnly'/);
  assert.match(legacy, /!worldChat \|\| !club \|\| !user \|\| member \|\| busy/);
});

test('all new user-facing labels support all six existing language codes', () => {
  for (const key of ['world.title', 'world.subtitle', 'world.joinHint', 'world.unavailable', 'world.empty', 'world.aboutText', 'world.international', 'world.share', 'world.linkCopied', 'schach.inviteOnly']) {
    const line = translations.split('\n').find(value => value.includes("'" + key + "':"));
    assert.ok(line, 'missing translation ' + key);
    for (const locale of ['de','en','az','tr','ua','ru']) {
      assert.match(line, new RegExp('\\b' + locale + ':'), key + ' ' + locale);
    }
  }
});

test('World Chat sign-in return is explicitly allowlisted, including OTP and recovery', () => {
  const helper = read('../src/lib/authCallbackUrl.ts');
  const profile = read('../src/screens/ProfileScreen.tsx');
  assert.match(helper, /if \(value === '\/world-chat'\) return '\/world-chat'/);
  assert.match(helper, /return value === '\/chat' \? '\/chat' : null/);
  assert.match(helper, /callback\.searchParams\.set\('returnTo', '\/world-chat'\)/);
  assert.match(profile, /clubReturnTo === '\/world-chat'/);
  assert.match(profile, /emailRedirectTo: worldChatAuthCallbackUrl\(window\.location\.origin, '\/profile'\)/);
  assert.match(profile, /redirectTo: worldChatAuthCallbackUrl\(window\.location\.origin, '\/update-password'\)/);
});

test('QA migration retains members, requires a verified Schach admin, and preserves ten-link invite limits', () => {
  assert.match(migration, /VALUES \('world-chat', 'World Chat'/);
  assert.match(migration, /kind='community' AND m\.role='admin'/);
  assert.match(migration, /UPDATE public\.chess_clubs SET is_open=false\s+WHERE slug='chessaz-deutsch'/);
  assert.match(migration, /c\.kind='room' OR \(c\.slug='chessaz-deutsch' AND c\.kind='community' AND NOT c\.is_open\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, />=10 THEN/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.chess_club_members/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_club_invite\(uuid\) TO authenticated/);
});
