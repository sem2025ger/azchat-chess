import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/migrations/20261021000000_chessaz_deutsch_community_foundation.sql', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/screens/ChatScreen.tsx', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/screens/ChessAZCommunityScreen.tsx', import.meta.url), 'utf8');

test('community migration enables RLS for every new public table', () => {
  for (const table of ['chess_clubs', 'chess_club_members', 'chess_club_messages',
    'chess_club_events', 'chess_club_event_participants']) {
    assert.match(sql, new RegExp('ALTER TABLE public\\.' + table + ' ENABLE ROW LEVEL SECURITY', 'i'));
  }
});

test('community membership inserts cannot self-assign elevated roles', () => {
  assert.match(sql, /CREATE POLICY chess_club_members_join[\s\S]*?user_id = \(SELECT auth\.uid\(\)\) AND role = 'member'/);
  assert.doesNotMatch(sql, /GRANT\s+UPDATE\s+ON\s+public\.chess_club_members\s+TO\s+authenticated/i);
});

test('club chat and event writes are restricted to members', () => {
  for (const policy of ['chess_club_messages_post', 'chess_club_events_create',
    'chess_club_event_participants_join']) {
    assert.match(sql, new RegExp('CREATE POLICY ' + policy + '[\\s\\S]*?user_id = \\(SELECT auth\\.uid\\(\\)\\)'));
  }
});

test('event capacity uses serialized trigger, not recursive participant RLS', () => {
  const policy = sql.split('CREATE POLICY chess_club_event_participants_join')[1]
    ?.split('CREATE POLICY chess_club_event_participants_leave')[0];
  assert.ok(policy, 'join policy exists');
  assert.doesNotMatch(policy, /count\(\*\).*chess_club_event_participants/is);
  assert.match(sql, /FOR UPDATE;/);
  assert.match(sql, /CREATE TRIGGER chess_club_event_capacity_guard/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.enforce_chess_club_event_capacity/);
});

test('existing chat route now hosts the separate community module', () => {
  assert.match(route, /export \{ default \} from '\.\/ChessAZCommunityScreen'/);
  assert.match(ui, /\.from\('chess_club_messages'\)/);
  assert.match(ui, /\.from\('chess_club_events'\)/);
  assert.match(ui, /\.from\('chess_club_event_participants'\)/);
});

test('database trigger has valid matching PostgreSQL dollar-quoted body', () => {
  assert.match(sql, /CREATE FUNCTION private\.enforce_chess_club_event_capacity\(\)[\s\S]*?AS \$\$[\s\S]*?\$\$;/);
  assert.equal((sql.match(/\$\$/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /AS \$\n/);
});
