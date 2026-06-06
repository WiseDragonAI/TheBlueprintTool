/**
 * WHAT: Marks the current low-detail branch lifecycle state for one card.
 * WHY: Exclusive mode branches need an explicit state contract so low-detail mounts can be rebuilt fresh on entry.
 */
export function markLedgerCardLowDetailMounted(card: HTMLElement, state: 'mounting' | 'mounted' | 'unmounting' | ''): void {
  if (state) {
    // Branch: Persist an explicit lifecycle state while the low-detail branch exists or is transitioning.
    card.dataset.lowDetailMounted = state;
    return;
  }
  delete card.dataset.lowDetailMounted;
}
