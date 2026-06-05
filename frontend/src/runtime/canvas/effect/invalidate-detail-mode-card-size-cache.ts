/**
 * WHAT: Keeps the legacy detail-mode card-size invalidation hook callable.
 * WHY: Card geometry is ledger-owned now, but older rendering code still calls this hook after explicit size changes.
 */
export function invalidateDetailModeCardSizeCache(): void {
  // Card geometry is ledger-owned; zoom detail no longer measures layout.
}
