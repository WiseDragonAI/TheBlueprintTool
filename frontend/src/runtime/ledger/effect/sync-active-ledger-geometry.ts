import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function syncActiveLedgerGeometry(elements: HTMLElement[]): void {
  const ledger = state.activeLedger as { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>> } | null;
  if (!ledger) return;
  const cardById = new Map((ledger.cards ?? []).map((card) => [String(card.id ?? ''), card]));
  const annotationById = new Map((ledger.annotations ?? []).map((annotation) => [String(annotation.id ?? ''), annotation]));
  const syncedIds: string[] = [];
  for (const element of elements) {
    if (!element.classList.contains('ledger-node')) continue;
    const cardId = element.dataset.cardId;
    if (cardId && cardById.has(cardId)) {
      const card = cardById.get(cardId) as Record<string, unknown>;
      card.x = element.offsetLeft;
      card.y = element.offsetTop;
      card.w = element.offsetWidth;
      syncedIds.push(cardId);
      continue;
    }
    const annotationId = element.dataset.zoneId ?? element.dataset.groupId;
    if (annotationId && annotationById.has(annotationId)) {
      const annotation = annotationById.get(annotationId) as Record<string, unknown>;
      annotation.x = element.offsetLeft;
      annotation.y = element.offsetTop;
      annotation.width = element.offsetWidth;
      annotation.height = element.offsetHeight;
      syncedIds.push(annotationId);
    }
  }
  if (syncedIds.length > 0) telemetry('sync-active-ledger-geometry', { activeTab: state.activeTab, ids: syncedIds });
}
