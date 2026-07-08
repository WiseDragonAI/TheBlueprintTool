/**
 * WHAT: Runtime helper that assigns deterministic endpoint slots for visible relationships.
 * WHY: Multiple arrows sharing one card side must stay separated before path routing.
 */
import { center } from '../../canvas/helper/center.js';
import { chooseRelationshipRouteCandidate } from './choose-relationship-route-candidate.js';
import type { RelationshipPortOffsetPolicy } from './relationship-port-for-side.js';
import type { CanvasRect } from '../../ledger/helper/active-ledger-geometry.js';

type RelationshipEndpoint = { relationshipId: string; sourceId: string; targetId: string };
type PortSlot = { side: string; offsetPolicy: RelationshipPortOffsetPolicy; slotIndex: number; slotCount: number };

export function resolveRelationshipPortSlots(relationships: RelationshipEndpoint[], rectByCardId: Map<string, CanvasRect>): Record<string, { source: PortSlot; target: PortSlot }> {
  const entries: Array<{ relationshipId: string; endpoint: 'source' | 'target'; cardId: string; side: string; offsetPolicy: RelationshipPortOffsetPolicy; sortValue: number; order: number }> = [];
  for (const [order, relationship] of relationships.entries()) {
    const { relationshipId, sourceId, targetId } = relationship;
    const sourceRect = rectByCardId.get(sourceId);
    const targetRect = rectByCardId.get(targetId);
    if (!relationshipId || !sourceRect || !targetRect) continue;
    const candidate = chooseRelationshipRouteCandidate(sourceRect, targetRect);
    const sourceSide = candidate.sourceSide;
    const targetSide = candidate.targetSide;
    const sourceOtherCenter = center(targetRect);
    const targetOtherCenter = center(sourceRect);
    entries.push({ relationshipId, endpoint: 'source', cardId: sourceId, side: sourceSide, offsetPolicy: candidate.sourceOffsetPolicy, sortValue: sourceSide === 'left' || sourceSide === 'right' ? sourceOtherCenter.y : sourceOtherCenter.x, order });
    entries.push({ relationshipId, endpoint: 'target', cardId: targetId, side: targetSide, offsetPolicy: candidate.targetOffsetPolicy, sortValue: targetSide === 'left' || targetSide === 'right' ? targetOtherCenter.y : targetOtherCenter.x, order });
  }
  const slots: Record<string, { source: PortSlot; target: PortSlot }> = {};
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = `${entry.cardId}:${entry.side}:${entry.offsetPolicy}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.sortValue - b.sortValue || a.order - b.order);
    const slotCount = group.length;
    for (const [slotIndex, entry] of group.entries()) {
      if (!slots[entry.relationshipId]) slots[entry.relationshipId] = {
        source: { side: 'right', offsetPolicy: 'projected', slotIndex: 0, slotCount: 1 },
        target: { side: 'left', offsetPolicy: 'projected', slotIndex: 0, slotCount: 1 }
      };
      slots[entry.relationshipId][entry.endpoint] = { side: entry.side, offsetPolicy: entry.offsetPolicy, slotIndex, slotCount };
    }
  }
  return slots;
}
