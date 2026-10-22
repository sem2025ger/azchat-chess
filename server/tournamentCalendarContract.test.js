'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261022000000_chessaz_deutsch_tournament_calendar.sql'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname,
  '../tmp/src/screens/ChessAZCommunityScreen.tsx'), 'utf8');

test('tournament templates default disabled and no scheduler is installed by migration', () => {
  assert.match(sql, /enabled boolean NOT NULL DEFAULT false/i);
  assert.match(sql, /32, false\s+FROM public\.chess_clubs/i);
  assert.doesNotMatch(sql, /\bcron\.schedule\s*\(/i);
  assert.doesNotMatch(sql, /CREATE EXTENSION/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.matches/i);
});

test('only server operators can generate calendar; RLS protects all new tables', () => {
  for (const name of ['chess_club_tournament_templates', 'chess_club_tournaments',
    'chess_club_tournament_entries']) {
    assert.match(sql, new RegExp('ALTER TABLE public\\.' + name + ' ENABLE ROW LEVEL SECURITY', 'i'));
  }
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.generate_chessaz_tournament_calendar\([\s\S]*?FROM PUBLIC, anon, authenticated/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION private\.generate_chessaz_tournament_calendar/i);
  assert.match(sql, /ON CONFLICT \(template_id, starts_at\) DO NOTHING/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /SECURITY DEFINER SET search_path = ''/i);
});

test('registration guard serializes capacity checks and requires active window', () => {
  assert.match(sql, /FUNCTION private\.enforce_chess_club_tournament_entry/i);
  assert.match(sql, /registration_opens_at <= now\(\)/i);
  assert.match(sql, /starts_at > now\(\)/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /count\(\*\)[\s\S]*>= cap/i);
  assert.match(sql, /PRIMARY KEY \(tournament_id, user_id\)/i);
});

test('Berlin timezone explicit for calendar generation and user display', () => {
  assert.match(sql, /time_zone = 'Europe\/Berlin'/i);
  assert.match(sql, /AT TIME ZONE 'Europe\/Berlin'/i);
  assert.match(sql, /make_timestamptz/i);
  assert.match(ui, /timeZone: 'Europe\/Berlin'/);
  assert.match(ui, /chess_club_tournament_entries/);
});

test('browser cannot create tournaments and cannot update status or admin templates', () => {
  assert.match(sql, /GRANT SELECT ON public\.chess_club_tournaments TO authenticated/i);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE)[\s\S]*?ON public\.chess_club_tournaments TO authenticated/i);
  assert.doesNotMatch(sql, /GRANT .*chess_club_tournament_templates TO authenticated/i);
  assert.match(ui, /automated games and pairings are not yet enabled/i);
});
