import type { Square } from 'chess.js';

export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Use the board bounds captured at pointerdown, without a layout read on every move.
export function squareAtPoint(
  x: number,
  y: number,
  rect: BoardRect,
  orientation: 'w' | 'b',
): Square | null {
  if (rect.width <= 0 || rect.height <= 0 ||
      x < rect.left || y < rect.top ||
      x >= rect.left + rect.width || y >= rect.top + rect.height) return null;

  const column = Math.floor((x - rect.left) * 8 / rect.width);
  const row = Math.floor((y - rect.top) * 8 / rect.height);
  const file = orientation === 'w' ? column : 7 - column;
  const rank = orientation === 'w' ? 8 - row : row + 1;
  return `${String.fromCharCode(97 + file)}${rank}` as Square;
}
