export type PlayerOutcome = 'win' | 'loss' | 'draw';
/** Interpret the score using the card owner's colour, never the viewer's. */
export function playerOutcome(result: string, color?: string | null): PlayerOutcome | null {
  if (color !== 'w' && color !== 'b') return null;
  if (result === '1/2-1/2' || result === '½-½') return 'draw';
  if (result === '1-0') return color === 'w' ? 'win' : 'loss';
  if (result === '0-1') return color === 'b' ? 'win' : 'loss';
  return null;
}
