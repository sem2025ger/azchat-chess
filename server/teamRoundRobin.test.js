'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bergerSchedule, calculateTable, matchScenarios } = require('./teamRoundRobin');

const rules = {
  board_count: 4, home_white_board_one: true, win_points: 2, draw_points: 1, loss_points: 0,
  forfeit_win_units: 2, forfeit_loss_units: 0,
};

test('Berger orientation agrees with the four- and six-seed tables', () => {
  const pairs = size => bergerSchedule(Array.from({ length: size }, (_, i) => i + 1), rules).map(
    round => round.matches.map(match => [match.home_team_id, match.away_team_id]));
  assert.deepEqual(pairs(4), [[[1, 4], [2, 3]], [[4, 3], [1, 2]], [[2, 4], [3, 1]]]);
  assert.deepEqual(pairs(6), [
    [[1, 6], [2, 5], [3, 4]], [[6, 4], [5, 3], [1, 2]], [[2, 6], [3, 1], [4, 5]],
    [[6, 5], [1, 4], [2, 3]], [[3, 6], [4, 2], [5, 1]],
  ]);
});

test('all supported sizes schedule every pairing once, with at most one bye per team', () => {
  for (let count = 2; count <= 16; count++) {
    const teams = Array.from({ length: count }, (_, i) => i + 1);
    const rounds = bergerSchedule(teams, rules);
    assert.deepEqual(rounds, bergerSchedule(teams, rules));
    assert.equal(rounds.length, count - 1 + count % 2);
    const pairs = new Set(), byes = new Set();
    for (const round of rounds) {
      const participants = round.bye_team_id === null ? [] : [round.bye_team_id];
      if (round.bye_team_id !== null) {
        assert.ok(!byes.has(round.bye_team_id));
        byes.add(round.bye_team_id);
      }
      for (const match of round.matches) {
        participants.push(match.home_team_id, match.away_team_id);
        const key = [match.home_team_id, match.away_team_id].sort((a, b) => a - b).join(':');
        assert.ok(!pairs.has(key));
        pairs.add(key);
        assert.deepEqual(match.boards.map(board => board.home_white), [true, false, true, false]);
      }
      assert.deepEqual(participants.sort((a, b) => a - b), teams);
    }
    assert.equal(pairs.size, count * (count - 1) / 2);
    assert.equal(byes.size, count % 2 ? count : 0);
  }
  const pilot = bergerSchedule([1, 2, 3, 4], { ...rules, home_white_board_one: false });
  assert.equal(pilot.flatMap(r => r.matches).length, 6);
  assert.equal(pilot.flatMap(r => r.matches.flatMap(m => m.boards)).length, 24);
  assert.deepEqual(pilot[0].matches[0].boards.map(b => b.home_white), [false, true, false, true]);
  for (const invalid of [[1], [1, 1], Array.from({ length: 17 }, (_, i) => i)]) {
    assert.throws(() => bergerSchedule(invalid, rules), /invalid_team_count/);
  }
});

const teams = [{ id: 'a', seed: 1 }, { id: 'b', seed: 2 }];
function makeMatch(results, unconfirmed = []) {
  return {
    id: 'm', home_team_id: 'a', away_team_id: 'b',
    boards: results.map((result, index) => ({
      result, board_no: index + 1, home_white: index % 2 === 0, confirmed: !unconfirmed.includes(index),
    })),
  };
}

test('official and provisional scoring preserve white/black orientation and use Berlin weights', () => {
  const match = makeMatch(['1-0', '0-1', '0-1', '1-0'], [3]);
  const official = calculateTable(teams, [match], rules);
  assert.deepEqual(official.standings.map(x => [x.rank, x.match_points, x.played]), [[1, 0, 0], [1, 0, 0]]);
  assert.deepEqual(official.matches.map(x => [x.home_board_points, x.away_board_points, x.remaining_boards]), [[2, 1, 1]]);
  const provisional = calculateTable(teams, [match], rules, true);
  assert.deepEqual(provisional.standings.map(x => [x.team_id, x.rank, x.match_points, x.board_points, x.berliner_wertung]), [
    ['a', 1, 1, 2, 7], ['b', 2, 1, 2, 3],
  ]);
  const tied = calculateTable(teams, [makeMatch(Array(4).fill('1/2-1/2'))], rules);
  assert.deepEqual(tied.standings.map(x => [x.rank, x.match_points, x.berliner_wertung]), [[1, 1, 5], [1, 1, 5]]);
});

test('forfeits, draws and pending boards are scored without inventing an opponent or result', () => {
  const forfeitRules = { ...rules, forfeit_win_units: 1, win_points: 3 };
  const match = makeMatch(['+/-', '-/+', '-/-', '1/2-1/2']);
  const table = calculateTable(teams, [match], forfeitRules);
  assert.deepEqual(table.standings.map(x => [x.team_id, x.match_points, x.board_points]), [['a', 3, 1.5], ['b', 0, 0.5]]);
  const both = calculateTable(teams, [makeMatch(Array(4).fill('-/-'))], rules);
  assert.equal(both.matches[0].scenarios.outcome, 'double_forfeit');
  assert.deepEqual(both.standings.map(x => x.match_points), [0, 0]);
  assert.equal(calculateTable(teams, [makeMatch(['pending', '1-0', '1-0', '1-0'])], rules, true).matches[0].remaining_boards, 1);
});

test('match scenarios cover thresholds, clinched outcomes and an impossible win', () => {
  assert.deepEqual(matchScenarios(7, 5, 2).home, { draw_points_needed: 0.5, win_points_needed: 1 });
  assert.deepEqual(matchScenarios(3, 1, 2).home, { draw_points_needed: 0.5, win_points_needed: 1 });
  assert.equal(matchScenarios(5, 1, 1).outcome, 'home_win');
  assert.equal(matchScenarios(5, 1, 1).away.draw_points_needed, null);
  assert.deepEqual(matchScenarios(4, 2, 1).away, { draw_points_needed: 1, win_points_needed: null });
  assert.equal(matchScenarios(4, 4, 0).outcome, 'draw');
});
