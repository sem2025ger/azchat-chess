export const REVIEW_BOARD_GUTTER = 16;

/** Match Home's playing field while keeping the side panel and both player labels visible. */
export function reviewLayout(width: number, height: number, homeField: number, homeTop: number) {
  const scale = Math.max(0, Math.min(1, width / 1560, height / 880));
  const boardInset = REVIEW_BOARD_GUTTER + 1; // The playing field has a one-pixel border.
  const sideInsets = (40 + 55) * scale;
  const evaluationSpace = 54 * scale;
  const columnGap = 19 * scale;
  const preferredPanelWidth = Math.max(335, 630 * scale);
  const topLabel = Math.max(18, 24 * scale);
  const minimumTopInset = Math.max(0, topLabel - REVIEW_BOARD_GUTTER);
  const bottomSpace = 36 * scale + 12;
  const boardSize = Math.max(0, Math.min(
    homeField + 2 * boardInset,
    width - sideInsets - evaluationSpace - columnGap - 335,
    height - minimumTopInset - bottomSpace,
  ));
  const topInset = Math.max(minimumTopInset, Math.min(
    homeTop - boardInset,
    height - boardSize - bottomSpace,
  ));
  const boardColumn = boardSize + evaluationSpace;
  const panelWidth = Math.min(preferredPanelWidth, width - sideInsets - boardColumn - columnGap);
  return { scale, boardSize, boardColumn, panelWidth, columnGap, topLabel, topInset };
}
