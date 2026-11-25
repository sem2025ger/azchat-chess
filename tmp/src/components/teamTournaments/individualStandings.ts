import type { EventDetail, Pair } from '../../services/individualTournaments';

type Standing = { no: number; name: string; points: number; played: number; rank: number };

// Match the server pairing score: win/bye=1, draw=.5, loss=0.
// No invented tie-break system: players on equal points share a rank.
export function individualStandings(players: EventDetail['players'], pairs: Pair[]): Standing[] {
  const rows = new Map(players.map(player => [player.no, { ...player, points: 0, played: 0, rank: 0 }]));
  for (const pair of pairs) {
    if (!pair.result) continue;
    const white = rows.get(pair.white_no);
    if (pair.black_no === null) {
      if (white && pair.result === 'bye') white.points += 1;
      continue;
    }
    const black = rows.get(pair.black_no);
    if (!white || !black || pair.result === 'bye') continue;
    white.played++;
    black.played++;
    if (pair.result === '1-0') white.points += 1;
    else if (pair.result === '0-1') black.points += 1;
    else if (pair.result === '1/2-1/2') { white.points += .5; black.points += .5; }
  }
  const sorted = [...rows.values()].sort((a,b) => b.points - a.points || a.no - b.no);
  return sorted.map((row,index) => ({ ...row, rank: index > 0 && row.points === sorted[index-1].points
    ? sorted.findIndex(other => other.points === row.points) + 1 : index + 1 }));
}
