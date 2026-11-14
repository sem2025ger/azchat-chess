'use strict';

const SCORES = {
  '1-0': [2, 0], '0-1': [0, 2], '1/2-1/2': [1, 1], '-/-': [0, 0],
};
const RESULTS = Object.freeze([...Object.keys(SCORES), '+/-', '-/+', 'pending']);

function bergerSchedule(teamIds, rules) {
  if (teamIds.length < 2 || teamIds.length > 16 || new Set(teamIds).size !== teamIds.length) {
    throw new RangeError('invalid_team_count');
  }
  const seeds = teamIds.length % 2 ? [...teamIds, null] : teamIds;
  const ring = seeds.length - 1;
  const half = seeds.length / 2;
  return Array.from({ length: ring }, (_, round) => {
    const pivot = round * half % ring;
    const pairings = [[seeds[pivot], seeds[ring]]];
    if (round % 2) pairings[0].reverse();
    for (let i = 1; i < half; i++) {
      pairings.push([seeds[(pivot + i) % ring], seeds[(pivot - i + ring) % ring]]);
    }
    return {
      round_no: round + 1,
      bye_team_id: pairings[0].includes(null) ? seeds[pivot] : null,
      matches: pairings.filter(pair => !pair.includes(null)).map(([home_team_id, away_team_id]) => ({
        home_team_id, away_team_id,
        boards: Array.from({ length: rules.board_count }, (_, i) => ({
          board_no: i + 1,
          home_white: i % 2 === 0 ? rules.home_white_board_one : !rules.home_white_board_one,
        })),
      })),
    };
  });
}

function boardUnits(board, rules) {
  let points = SCORES[board.result];
  const walkover = [rules.forfeit_win_units, rules.forfeit_loss_units];
  if (board.result === '+/-') points = walkover;
  if (board.result === '-/+') points = [...walkover].reverse();
  if (!points) throw new RangeError('invalid_board_result');
  return board.home_white ? points : [points[1], points[0]];
}

// Scores use integer half-points. Unfinished boards can contribute at most
// two units in total, so the worst case gives the opponent every other unit.
function matchScenarios(home, away, remaining) {
  const needed = (a, b, margin) => {
    const units = Math.max(0, Math.ceil((b + 2 * remaining - a + margin) / 2));
    return units <= 2 * remaining ? units / 2 : null;
  };
  let outcome = null;
  if (home > away + 2 * remaining) outcome = 'home_win';
  if (away > home + 2 * remaining) outcome = 'away_win';
  if (!remaining && home === away) outcome = 'draw';
  return {
    outcome,
    home: { draw_points_needed: needed(home, away, 0), win_points_needed: needed(home, away, 1) },
    away: { draw_points_needed: needed(away, home, 0), win_points_needed: needed(away, home, 1) },
  };
}

function calculateTable(teams, matches, rules, includeProvisional = false) {
  const table = new Map(teams.map(team => [team.id, {
    team_id: team.id, seed: team.seed, match_points: 0, board_units: 0, berlin_units: 0, played: 0,
  }]));
  const matchScores = matches.map(match => {
    const home = table.get(match.home_team_id);
    const away = table.get(match.away_team_id);
    let homeUnits = 0, awayUnits = 0, homeBerlin = 0, awayBerlin = 0;
    const counted = match.boards.filter(board => board.result !== 'pending' && (includeProvisional || board.confirmed));
    for (const board of counted) {
      const [h, a] = boardUnits(board, rules);
      const weight = rules.board_count + 1 - board.board_no;
      homeUnits += h; awayUnits += a;
      homeBerlin += weight * h; awayBerlin += weight * a;
    }
    const remaining = rules.board_count - counted.length;
    const bothForfeit = !remaining && counted.every(board => board.result === '-/-');
    if (!remaining) {
      const points = (side, other) => bothForfeit || side < other ? rules.loss_points :
        side === other ? rules.draw_points : rules.win_points;
      home.match_points += points(homeUnits, awayUnits);
      away.match_points += points(awayUnits, homeUnits);
      home.board_units += homeUnits; away.board_units += awayUnits;
      home.berlin_units += homeBerlin; away.berlin_units += awayBerlin;
      home.played++; away.played++;
    }
    const unavailable = { draw_points_needed: null, win_points_needed: null };
    const scenarios = bothForfeit ? { outcome: 'double_forfeit', home: unavailable, away: unavailable } :
      matchScenarios(homeUnits, awayUnits, remaining);
    return { match_id: match.id, home_board_points: homeUnits / 2, away_board_points: awayUnits / 2,
      remaining_boards: remaining, scenarios };
  });
  const compare = (a, b) => b.match_points - a.match_points || b.board_units - a.board_units || b.berlin_units - a.berlin_units;
  const ordered = [...table.values()].sort((a, b) => compare(a, b) || a.seed - b.seed);
  let rank = 0;
  const standings = ordered.map((row, i) => {
    if (!i || compare(ordered[i - 1], row)) rank = i + 1;
    return { team_id: row.team_id, rank, played: row.played, match_points: row.match_points,
      board_points: row.board_units / 2, berliner_wertung: row.berlin_units / 2 };
  });
  return { standings, matches: matchScores };
}

module.exports = { RESULTS, bergerSchedule, matchScenarios, calculateTable };
