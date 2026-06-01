/**
 * WHAT: Runtime helper that assigns deterministic endpoint slots for visible relationships.
 * WHY: Multiple arrows sharing one card side must stay separated before path routing.
 */
import { center } from '../../canvas/helper/center.js';
import { chooseRelationshipPortSides } from './choose-relationship-port-sides.js';
import type { CanvasRect } from '../../ledger/helper/active-ledger-geometry.js';

type RelationshipEndpoint = { relationshipId: string; sourceId: string; targetId: string };
type PortSlot = { side: string; slotIndex: number; slotCount: number };

export function resolveRelationshipPortSlots(relationships: RelationshipEndpoint[], rectByCardId: Map<string, CanvasRect>): Record<string, { source: PortSlot; target: PortSlot }> {
  const entries: Array<{ relationshipId: string; endpoint: 'source' | 'target'; cardId: string; side: string; sortValue: number; order: number }> = [];
  for (const [order, relationship] of relationships.entries()) {
    const { relationshipId, sourceId, targetId } = relationship;
    const sourceRect = rectByCardId.get(sourceId);
    const targetRect = rectByCardId.get(targetId);
    if (!relationshipId || !sourceRect || !targetRect) continue;
    const sides = chooseRelationshipPortSides(sourceRect, targetRect);
    const sourceSide = sides.sourceSide;
    const targetSide = sides.targetSide;
    const sourceOtherCenter = center(targetRect);
    const targetOtherCenter = center(sourceRect);
    entries.push({ relationshipId, endpoint: 'source', cardId: sourceId, side: sourceSide, sortValue: sourceSide === 'left' || sourceSide === 'right' ? sourceOtherCenter.y : sourceOtherCenter.x, order });
    entries.push({ relationshipId, endpoint: 'target', cardId: targetId, side: targetSide, sortValue: targetSide === 'left' || targetSide === 'right' ? targetOtherCenter.y : targetOtherCenter.x, order });
  }
  const slots: Record<string, { source: PortSlot; target: PortSlot }> = {};
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = `${entry.cardId}:${entry.side}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.sortValue - b.sortValue || a.order - b.order);
    const slotCount = group.length;
    for (const [slotIndex, entry] of group.entries()) {
      if (!slots[entry.relationshipId]) slots[entry.relationshipId] = { source: { side: 'right', slotIndex: 0, slotCount: 1 }, target: { side: 'left', slotIndex: 0, slotCount: 1 } };
      slots[entry.relationshipId][entry.endpoint] = { side: entry.side, slotIndex, slotCount };
    }
  }
  return slots;
}
