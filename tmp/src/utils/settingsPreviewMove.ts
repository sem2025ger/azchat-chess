import { Chess } from 'chess.js';
import type { ChessSoundType } from './chessSounds';

/**
 * Apply one legal move to the Settings preview only.
 * A new Chess instance ensures the preview never mutates the live game's state.
 * Audio is played by the UI directly in the user's click/pointer handler.
 */
export function trySettingsPreviewMove(
  game: Chess,
  from: string,
  to: string,
  promotion = 'q',
): { game: Chess; sound: ChessSoundType } | null {
  try {
    const next = new Chess(game.fen());
    const move = next.move({ from, to, promotion });
    if (!move) return null;

    return {
      game: next,
      sound: next.isCheck() ? 'check' : move.captured ? 'capture' : 'move',
    };
  } catch {
    return null;
  }
}
