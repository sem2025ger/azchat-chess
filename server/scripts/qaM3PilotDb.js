'use strict';

const { Client } = require('pg');
const { databaseConfig } = require('./importLichessBroadcast');

const eventTables = [
  'team_tournament_m3_action_audit', 'team_tournament_result_audit',
  'team_tournament_board_results', 'team_tournament_matches', 'team_tournament_rounds',
  'team_tournament_roles', 'team_tournament_teams', 'team_tournament_rulesets',
  'team_tournament_m3_entries', 'team_tournament_m3_invites', 'team_tournament_m3_config',
];

function connect(qaDatabaseUrl) {
  return new Client({
    ...databaseConfig(qaDatabaseUrl), application_name: 'chessaz-m3-qa-pilot',
    statement_timeout: 10000, lock_timeout: 8000,
  });
}

async function fixtureUsers(db, tag, emails) {
  const { rows } = await db.query(
    "SELECT id, email FROM auth.users WHERE email = ANY($1::text[]) AND raw_app_meta_data->>'chessaz_m3_pilot' = $2",
    [emails, tag]);
  return rows;
}

async function eventGraph(db, tag, organizerIds, callback) {
  const { rows: events } = await db.query(`
    SELECT e.id FROM public.team_tournaments e
    WHERE starts_with(e.name, $1) AND EXISTS (
      SELECT 1 FROM public.team_tournament_roles r
      WHERE r.tournament_id = e.id AND r.role = 'organizer' AND r.user_id = ANY($2::uuid[])
    ) ORDER BY e.id FOR UPDATE OF e`, [`[${tag}] `, organizerIds]);
  const eventsIds = events.map(row => row.id);
  const { rows: matches } = await db.query(
    'SELECT id FROM public.team_tournament_matches WHERE tournament_id = ANY($1::uuid[])', [eventsIds]);
  const { rows: entries } = await db.query(
    'SELECT id FROM public.team_tournament_m3_entries WHERE tournament_id = ANY($1::uuid[])', [eventsIds]);
  for (const table of ['team_tournament_m3_board_reports', 'team_tournament_m3_board_states']) {
    await callback(table, 'match_id', matches.map(row => row.id));
  }
  await callback('team_tournament_m3_lineups', 'entry_id', entries.map(row => row.id));
  for (const table of eventTables) await callback(table, 'tournament_id', eventsIds);
  await callback('team_tournaments', 'id', eventsIds);
}

async function cleanupEvents(db, tag, organizerIds) {
  await db.query('BEGIN');
  try {
    const scopes = [];
    await eventGraph(db, tag, organizerIds, async (table, key, ids) => {
      if (!ids.length) return;
      scopes.push({ table, key, ids });
      await db.query(`DELETE FROM public.${table} WHERE ${key} = ANY($1::uuid[])`, [ids]);
    });
    for (const { table, key, ids } of scopes) {
      const { rowCount } = await db.query(
        `SELECT 1 FROM public.${table} WHERE ${key} = ANY($1::uuid[]) LIMIT 1`, [ids]);
      if (rowCount !== 0) throw new Error('event_cleanup_incomplete');
    }
    const { rowCount } = await db.query(
      'SELECT 1 FROM public.team_tournaments WHERE starts_with(name, $1) LIMIT 1', [`[${tag}] `]);
    if (rowCount !== 0) throw new Error('unexpected_fixture_event_owner');
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function verifyUserCleanup(db, ids, emails) {
  const { rows: [remaining] } = await db.query(`
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = ANY($2::text[]) OR id = ANY($1::uuid[]))
      OR EXISTS(SELECT 1 FROM auth.sessions WHERE user_id = ANY($1::uuid[]))
      OR EXISTS(SELECT 1 FROM public.profiles WHERE id = ANY($1::uuid[]))
      OR EXISTS(SELECT 1 FROM public.team_tournament_organizers WHERE user_id = ANY($1::uuid[]))
      AS found`, [ids, emails]);
  if (remaining.found) throw new Error('user_cleanup_incomplete');
}

async function inviteStorage(db, eventId) {
  const { rows } = await db.query(`
    SELECT 'invites' AS source, to_jsonb(r) AS data FROM public.team_tournament_m3_invites r WHERE tournament_id = $1
    UNION ALL SELECT 'entries', to_jsonb(r) FROM public.team_tournament_m3_entries r WHERE tournament_id = $1
    UNION ALL SELECT 'config', to_jsonb(r) FROM public.team_tournament_m3_config r WHERE tournament_id = $1
    UNION ALL SELECT 'event', to_jsonb(r) FROM public.team_tournaments r WHERE id = $1`, [eventId]);
  return rows;
}

module.exports = { connect, fixtureUsers, cleanupEvents, verifyUserCleanup, inviteStorage };
