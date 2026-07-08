/**
 * WHAT: Runtime helper that resolves source and target relationship ports from ledger card geometry.
 * WHY: SVG relationship routes must attach to chosen card borders in canvas-world coordinates.
 */
import { center } from '../../canvas/helper/center.js';
import { chooseRelationshipRouteCandidate } from './choose-relationship-route-candidate.js';
import type { RelationshipPortOffsetPolicy } from './relationship-port-for-side.js';
import { relationshipPortNormalForSide } from './relationship-port-normal-for-side.js';
import { relationshipPortForSide } from './relationship-port-for-side.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import type { CanvasRect } from '../../ledger/helper/active-ledger-geometry.js';

export function calculateRelationshipPorts(
  sourceRect: CanvasRect,
  targetRect: CanvasRect,
  slots?: { source: { side: string; offsetPolicy?: RelationshipPortOffsetPolicy; slotIndex: number; slotCount: number }; target: { side: string; offsetPolicy?: RelationshipPortOffsetPolicy; slotIndex: number; slotCount: number } },
  ids: { sourceId?: string; targetId?: string } = {}
): {
  sourcePort: { x: number; y: number };
  targetPort: { x: number; y: number };
  horizontal: boolean;
  sourceRect: CanvasRect;
  targetRect: CanvasRect;
  sourceSide: string;
  targetSide: string;
  sourceOffsetPolicy: RelationshipPortOffsetPolicy;
  targetOffsetPolicy: RelationshipPortOffsetPolicy;
  sourceNormal: { x: number; y: number };
  targetNormal: { x: number; y: number };
} {
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const fallbackCandidate = chooseRelationshipRouteCandidate(sourceRect, targetRect);
  const sourceSlot = slots?.source ?? { side: fallbackCandidate.sourceSide, offsetPolicy: fallbackCandidate.sourceOffsetPolicy, slotIndex: 0, slotCount: 1 };
  const targetSlot = slots?.target ?? { side: fallbackCandidate.targetSide, offsetPolicy: fallbackCandidate.targetOffsetPolicy, slotIndex: 0, slotCount: 1 };
  const sourceOffsetPolicy = sourceSlot.offsetPolicy ?? fallbackCandidate.sourceOffsetPolicy;
  const targetOffsetPolicy = targetSlot.offsetPolicy ?? fallbackCandidate.targetOffsetPolicy;
  const horizontal = sourceSlot.side === 'left' || sourceSlot.side === 'right' || Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  const sourcePort = relationshipPortForSide(sourceRect, sourceSlot.side, sourceSlot.slotIndex, sourceSlot.slotCount, targetCenter, { offsetPolicy: sourceOffsetPolicy });
  const targetPort = relationshipPortForSide(targetRect, targetSlot.side, targetSlot.slotIndex, targetSlot.slotCount, sourceCenter, { offsetPolicy: targetOffsetPolicy });
  const sourceNormal = relationshipPortNormalForSide(sourceSlot.side);
  const targetNormal = relationshipPortNormalForSide(targetSlot.side);
  telemetry('calculate-relationship-ports', { sourceId: ids.sourceId, targetId: ids.targetId, sourcePort, targetPort, sourceRect, targetRect, sourceSlot, targetSlot });
  return { sourcePort, targetPort, horizontal, sourceRect, targetRect, sourceSide: sourceSlot.side, targetSide: targetSlot.side, sourceOffsetPolicy, targetOffsetPolicy, sourceNormal, targetNormal };
}
