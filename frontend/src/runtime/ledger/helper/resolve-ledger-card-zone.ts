export function resolveLedgerCardZone(card: Record<string, unknown>, annotations: Array<Record<string, unknown>>): Record<string, unknown> | null {
  const cardLeft = Number(card.x ?? 0);
  const cardTop = Number(card.y ?? 0);
  const cardWidth = Math.max(0, Number(card.w ?? card.width ?? 280));
  const cardHeight = Math.max(0, Number(card.h ?? card.height ?? 132));
  if (![cardLeft, cardTop, cardWidth, cardHeight].every(Number.isFinite)) return null;
  const cardRight = cardLeft + cardWidth;
  const cardBottom = cardTop + cardHeight;
  let bestZone: Record<string, unknown> | null = null;
  let bestArea = 0;
  for (const annotation of annotations) {
    if (annotation.variant === 'group' || typeof annotation.color !== 'string') continue;
    const zoneLeft = Number(annotation.x ?? 0);
    const zoneTop = Number(annotation.y ?? 0);
    const zoneWidth = Math.max(0, Number(annotation.width ?? 0));
    const zoneHeight = Math.max(0, Number(annotation.height ?? 0));
    if (![zoneLeft, zoneTop, zoneWidth, zoneHeight].every(Number.isFinite)) continue;
    const overlapWidth = Math.max(0, Math.min(cardRight, zoneLeft + zoneWidth) - Math.max(cardLeft, zoneLeft));
    const overlapHeight = Math.max(0, Math.min(cardBottom, zoneTop + zoneHeight) - Math.max(cardTop, zoneTop));
    const overlapArea = overlapWidth * overlapHeight;
    if (overlapArea <= bestArea) continue;
    bestArea = overlapArea;
    bestZone = annotation;
  }
  return bestZone;
}
