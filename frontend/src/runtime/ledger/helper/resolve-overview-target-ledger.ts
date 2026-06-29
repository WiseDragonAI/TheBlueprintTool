/**
 * WHAT: Resolves the linked ledger card nearest the viewport center.
 * WHY: Zooming into `/ledgers` should open the ledger the operator is visually targeting.
 */
export function resolveOverviewTargetLedger(input: {
  ledger: { cards?: Array<Record<string, unknown>> } | null;
  viewportCenter: { x: number; y: number };
}): string {
  const cards = Array.isArray(input.ledger?.cards) ? input.ledger.cards : [];
  let nearest = '';
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const card of cards) {
    const targetLedgerId = String(card.targetLedgerId ?? '');
    if (!targetLedgerId) continue;
    const x = Number(card.x ?? 0);
    const y = Number(card.y ?? 0);
    const width = Math.max(220, Number(card.w ?? card.width ?? 280));
    const height = Math.max(132, Number(card.h ?? card.height ?? 132));
    const inside = input.viewportCenter.x >= x && input.viewportCenter.x <= x + width && input.viewportCenter.y >= y && input.viewportCenter.y <= y + height;
    if (inside) return targetLedgerId;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const distance = Math.hypot(input.viewportCenter.x - centerX, input.viewportCenter.y - centerY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = targetLedgerId;
    }
  }
  return nearest;
}
