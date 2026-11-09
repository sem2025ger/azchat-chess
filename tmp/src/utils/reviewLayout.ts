/** Approved desktop composition, with a tighter board-to-panel gap on smaller workspaces. */
export function reviewLayout(width: number, height: number) {
  // Reference is the approved HTML's 1560 x 880 workspace (excluding the sidebar).
  const scale = Math.max(0, Math.min(1, width / 1560, height / 880));
  const referenceBoardSize = 736 * scale;
  // Reserve room for the workspace's top offset, padding and both player rows.
  const availableBoardHeight = height - 32 - (10 + 36 + 36) * scale;
  // Take space from the gutter so the evaluation bar and the panel keep their anchors.
  const boardGrowth = Math.max(0, Math.min(32 * scale, 736 - referenceBoardSize, availableBoardHeight - referenceBoardSize));
  const boardSize = referenceBoardSize + boardGrowth;
  const evaluationSpace = 54 * scale;
  const columnGap = 51 * scale - boardGrowth;
  const panelWidth = 630 * scale; // A narrower desktop site rail frees room for PV notation.
  return { scale, boardSize, boardColumn: boardSize + evaluationSpace, panelWidth, columnGap };
}
