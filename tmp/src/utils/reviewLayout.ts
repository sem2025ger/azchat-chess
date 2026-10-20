/** Desktop workspace geometry in CSS pixels, after removing the outer padding. */
export function reviewLayout(width: number, height: number, headerHeight: number) {
  const columnGap = 48;
  const rowGap = 12;
  const evaluationSpace = 44;
  const playerSpace = 72; // Two visible 36px colour/player rows.
  const minPanelWidth = width >= 1300 ? 400 : 335;
  const availableHeight = Math.max(0, height - headerHeight - rowGap - playerSpace);
  const availableWidth = Math.max(0, width - columnGap - evaluationSpace - minPanelWidth);
  const boardSize = Math.floor(Math.min(availableHeight, availableWidth));
  const panelWidth = Math.max(minPanelWidth, width - boardSize - evaluationSpace - columnGap);
  return { boardSize, boardColumn: boardSize + evaluationSpace, panelWidth, columnGap };
}
