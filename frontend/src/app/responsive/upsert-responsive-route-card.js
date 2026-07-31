/**
 * WHAT: Installs the exact card-detail response into the responsive ledger projection.
 * WHY: A newly created task can be addressable before the independently loaded navigation snapshot lists it.
 */
export function upsertResponsiveRouteCard(cards, card) {
  // WHAT: Normalize an absent legacy card collection to an empty route projection.
  // WHY: Exact card-detail hydration must remain usable while the ledger navigation payload is initializing.
  const records = Array.isArray(cards) ? cards : [];
  const cardId = String(card?.id ?? '');
  const existingIndex = records.findIndex((entry) => String(entry?.id ?? '') === cardId);
  // WHAT: Append a route-owned card that the older navigation snapshot does not contain.
  // WHY: Thread controls resolve their task identity from the installed ledger card collection.
  if (existingIndex < 0) return [...records, card];
  const updated = [...records];
  updated[existingIndex] = card;
  return updated;
}
