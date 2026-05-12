/**
 * WHAT: Runtime helper that assigns deterministic endpoint slots for visible relationships.
 * WHY: Multiple arrows sharing one card side must stay separated before path routing.
 */
import { center } from './center.js';
import { chooseRelationshipPortSides } from '../helper/relationship/choose-relationship-port-sides.js';
import { elementCanvasRect } from './element-canvas-rect.js';

export function resolveRelationshipPortSlots(relationships: SVGPathElement[]): Record<string, { source: { side: string; slotIndex: number; slotCount: number }; target: { side: string; slotIndex: number; slotCount: number } }> {
  const entries: Array<{ relationshipId: string; endpoint: 'source' | 'target'; cardId: string; side: string; sortValue: number; order: number }> = [];
  for (const [order, relationship] of relationships.entries()) {
    const relationshipId = relationship.dataset.relationshipId ?? '';
    const sourceId = relationship.dataset.source ?? '';
    const targetId = relationship.dataset.target ?? '';
    const source = document.querySelector(`[data-card-id="${sourceId}"]`) as HTMLElement | null;
    const target = document.querySelector(`[data-card-id="${targetId}"]`) as HTMLElement | null;
    if (!relationshipId || !source || !target) continue;
    const sourceRect = elementCanvasRect(source);
    const targetRect = elementCanvasRect(target);
    const sides = chooseRelationshipPortSides(sourceRect, targetRect);
    const sourceSide = sides.sourceSide;
    const targetSide = sides.targetSide;
    const sourceOtherCenter = center(targetRect);
    const targetOtherCenter = center(sourceRect);
    entries.push({ relationshipId, endpoint: 'source', cardId: sourceId, side: sourceSide, sortValue: sourceSide === 'left' || sourceSide === 'right' ? sourceOtherCenter.y : sourceOtherCenter.x, order });
    entries.push({ relationshipId, endpoint: 'target', cardId: targetId, side: targetSide, sortValue: targetSide === 'left' || targetSide === 'right' ? targetOtherCenter.y : targetOtherCenter.x, order });
  }
  const slots: Record<string, { source: { side: string; slotIndex: number; slotCount: number }; target: { side: string; slotIndex: number; slotCount: number } }> = {};
  for (const entry of entries) {
    let slotCount = 0;
    let slotIndex = 0;
    for (const candidate of entries) {
      const sameGroup = candidate.cardId === entry.cardId && candidate.side === entry.side;
      if (!sameGroup) continue;
      slotCount += 1;
      if (candidate.sortValue < entry.sortValue || (candidate.sortValue === entry.sortValue && candidate.order < entry.order)) slotIndex += 1;
    }
    if (!slots[entry.relationshipId]) slots[entry.relationshipId] = { source: { side: 'right', slotIndex: 0, slotCount: 1 }, target: { side: 'left', slotIndex: 0, slotCount: 1 } };
    slots[entry.relationshipId][entry.endpoint] = { side: entry.side, slotIndex, slotCount };
  }
  return slots;
}
