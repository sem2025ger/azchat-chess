/** Desktop workspace geometry in CSS pixels, after removing the outer padding. */
export function reviewLayout(width: number, height: number, headerHeight: number) {
  const columnGap = 64;
  const rowGap = 12;
  const evaluationSpace = 44;
  const playerSpace = 72;
  const raisedSpace = 24;
  const previousPanelWidth = width >= 1300 ? 400 : 335;
  const minPanelWidth = width >= 1300 ? 360 : 280;
  const previousHeight = Math.max(0, height - headerHeight - rowGap - playerSpace);
  const previousWidth = Math.max(0, width - 48 - evaluationSpace - previousPanelWidth);
  const requestedBoardSize = Math.floor(Math.min(previousHeight, previousWidth) * 1.1);
  const availableHeight = previousHeight + raisedSpace;
  const availableWidth = Math.max(0, width - columnGap - evaluationSpace - minPanelWidth);
  const boardSize = Math.floor(Math.min(requestedBoardSize, availableHeight, availableWidth));
  const panelWidth = Math.max(minPanelWidth, Math.min(440, width - boardSize - evaluationSpace - columnGap));
  return { boardSize, boardColumn: boardSize + evaluationSpace, panelWidth, columnGap };
}
