/** Desktop workspace geometry in CSS pixels, after removing the outer padding. */
export function reviewLayout(width: number, height: number, headerHeight: number) {
  const columnGap = 24;
  const rowGap = 12;
  const evaluationSpace = 44;
  const playerSpace = 96; // Two player rows, with room for future clock labels.
  const scale = 0.92;
  const minPanelWidth = width >= 1300 ? 400 : 335;
  const availableHeight = Math.max(0, height - headerHeight - rowGap);
  const availableWidth = Math.max(0, width - columnGap - evaluationSpace - minPanelWidth);
  const fullBoardSize = Math.floor(Math.min(availableHeight, availableWidth));
  const boardSize = Math.floor(Math.min(fullBoardSize * scale, Math.max(0, availableHeight - playerSpace)));
  const fullPanelWidth = width - fullBoardSize - evaluationSpace - columnGap;
  const panelWidth = Math.max(minPanelWidth, Math.floor(fullPanelWidth * scale));
  return { boardSize, boardColumn: boardSize + evaluationSpace, panelWidth, columnGap };
}
