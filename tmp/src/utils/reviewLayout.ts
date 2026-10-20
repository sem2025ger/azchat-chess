/** Desktop workspace geometry in CSS pixels, after removing the outer padding. */
export function reviewLayout(width: number, height: number, headerHeight: number) {
  const columnGap = 24;
  const rowGap = 12;
  const evaluationSpace = 44;
  const minPanelWidth = width >= 1300 ? 400 : 335;
  const availableHeight = Math.max(0, height - headerHeight - rowGap);
  const availableWidth = Math.max(0, width - columnGap - evaluationSpace - minPanelWidth);
  const boardSize = Math.floor(Math.min(availableHeight, availableWidth));
  return { boardSize, boardColumn: boardSize + evaluationSpace, panelWidth: width - boardSize - evaluationSpace - columnGap, columnGap };
}
