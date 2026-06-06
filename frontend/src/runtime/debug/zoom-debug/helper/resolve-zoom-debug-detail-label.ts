/**
 * WHAT: Converts a viewport scale into the active zoom detail label.
 * WHY: The debug overlay should expose the simplified two-mode zoom contract.
 */
export function resolveZoomDebugDetailLabel(scale: number): string {
  if (scale < 0.35) {
    // Branch: Low detail hides the heavy card subtree and the grid.
    return 'low-detail';
  }
  // Branch: Detail mode is any scale above the single low-detail threshold.
  return 'detail';
}
