import { reviewLayout } from './reviewLayout.ts';

/** Match the analysis playing field, allowing for each screen's own frame. */
export function playLobbyBoardSize(width: number, height: number) {
  const { boardSize, scale } = reviewLayout(width, height);
  const analysisFrame = 2 * (6 + 16) * scale;
  const lobbyFrame = 2 * (6 + 12);
  return boardSize - analysisFrame + lobbyFrame;
}
