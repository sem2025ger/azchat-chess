import test from 'node:test';
import assert from 'node:assert/strict';
import { individualStandings } from '../src/components/teamTournaments/individualStandings.ts';
import { tournamentCopy } from '../src/components/teamTournaments/copy.ts';

const players = [1,2,3,4,5].map(no => ({ no, name: 'P'+no }));
const pair = (round_no,board_no,white_no,black_no,result) => ({ round_no,board_no,white_no,black_no,result });

test('individual standings score wins, draws, losses, byes and pending boards without fictitious tie-breaks', () => {
  const games = [pair(1,1,1,2,'1-0'),pair(1,2,3,4,'1/2-1/2'),pair(1,3,5,null,'bye'),
    pair(2,1,5,1,'0-1'),pair(2,2,2,3,null),pair(2,3,4,null,'bye')];
  assert.deepEqual(individualStandings(players,games).map(p=>[p.no,p.points,p.played,p.rank]),
    [[1,2,2,1],[4,1.5,1,2],[5,1,1,3],[3,.5,1,4],[2,0,1,5]]);
  assert.deepEqual(individualStandings(players,[]).map(p=>p.rank),[1,1,1,1,1]);
  assert.equal(individualStandings(players,games.slice(0,3))[1].rank,1);
  assert.equal(players[0].points,undefined);
});
test('individual tournament presentation labels exist in every supported locale', () => {
  for (const lang of ['de','en','az','tr','ua','ru']) {
    const tr = tournamentCopy(lang);
    for (const key of ['individualParticipants','individualJoined','individualStandings','individualPoints',
      'individualGames','individualPointsOnly','individualMyEvents','individualView']) assert.ok(tr(key).trim(),lang+' '+key);
  }
});
