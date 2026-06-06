/**
 * WHAT: Marks the current runtime-mounted state for one card detail host.
 * WHY: Fade coordination and rerender refreshes need an explicit card-local mount state contract.
 */
export function markLedgerCardDetailMounted(card: HTMLElement, state: 'mounting' | 'mounted' | 'unmounting' | ''): void {
  // Branch: Persist an explicit mounted state whenever the card still owns a detail lifecycle phase.
  if (state) {
    card.dataset.detailMounted = state;
    return;
  }
  delete card.dataset.detailMounted;
}
