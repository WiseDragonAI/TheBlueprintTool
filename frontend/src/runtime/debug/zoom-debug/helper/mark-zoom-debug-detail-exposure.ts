/**
 * WHAT: Marks persistent canvas survivor nodes that have already lived through detail mode.
 * WHY: The low-detail glitch is history-dependent, so debug must distinguish fresh low-detail nodes from nodes contaminated by a prior detail pass.
 */
export function markZoomDebugDetailExposure(): void {
  for (const element of document.querySelectorAll<HTMLElement>('.card[data-card-id], .ledger-card-overview-layer, .zone[data-zone-id], .zone[data-group-id], .zone-title, .relationships text')) {
    // Branch: Once a survivor node has been present during detail mode, keep that fact for later low-detail diagnosis.
    element.dataset.debugSawDetail = '1';
  }
}
