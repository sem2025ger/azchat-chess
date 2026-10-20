/** Desktop board geometry; the toolbar lives inside the right panel. */
export function reviewLayout(width: number, height: number) {
  const columnGap = 64;
  const evaluationSpace = 44;
  const playerSpace = 72;
  const minPanelWidth = width >= 1300 ? 360 : 280;
  const availableHeight = Math.max(0, height - playerSpace);
  const availableWidth = Math.max(0, width - columnGap - evaluationSpace - minPanelWidth);
  const boardSize = Math.floor(Math.min(availableHeight, availableWidth));
  const panelWidth = Math.max(minPanelWidth, Math.min(440, width - boardSize - evaluationSpace - columnGap));
  return { boardSize, boardColumn: boardSize + evaluationSpace, panelWidth, columnGap };
}
