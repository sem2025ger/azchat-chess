/** Approved desktop composition, scaled down together when the workspace is smaller. */
export function reviewLayout(width: number, height: number) {
  // Reference is the approved HTML's 1560 x 880 workspace (excluding the sidebar).
  const scale = Math.max(0, Math.min(1, width / 1560, height / 880));
  const boardSize = 736 * scale; // Slightly smaller desktop frame; keep the board square and the surrounding composition proportional.
  const evaluationSpace = 54 * scale;
  const columnGap = 51 * scale;
  const panelWidth = 574 * scale;
  return { scale, boardSize, boardColumn: boardSize + evaluationSpace, panelWidth, columnGap };
}
