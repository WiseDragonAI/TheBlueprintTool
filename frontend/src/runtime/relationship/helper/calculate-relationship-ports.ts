/**
 * WHAT: Runtime helper that resolves source and target relationship ports from ledger card geometry.
 * WHY: SVG relationship routes must attach to chosen card borders in canvas-world coordinates.
 */
import { center } from '../../canvas/helper/center.js';
import { chooseRelationshipPortSides } from './choose-relationship-port-sides.js';
import { readableHorizontalRelationshipFlow } from './readable-horizontal-relationship-flow.js';
import { relationshipPortNormalForSide } from './relationship-port-normal-for-side.js';
import { relationshipPortForSide } from './relationship-port-for-side.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import type { CanvasRect } from '../../ledger/helper/active-ledger-geometry.js';

export function calculateRelationshipPorts(
  sourceRect: CanvasRect,
  targetRect: CanvasRect,
  slots?: { source: { side: string; slotIndex: number; slotCount: number }; target: { side: string; slotIndex: number; slotCount: number } },
  ids: { sourceId?: string; targetId?: string } = {}
): {
  sourcePort: { x: number; y: number };
  targetPort: { x: number; y: number };
  horizontal: boolean;
  sourceRect: CanvasRect;
  targetRect: CanvasRect;
  sourceSide: string;
  targetSide: string;
  sourceNormal: { x: number; y: number };
  targetNormal: { x: number; y: number };
} {
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const fallbackSides = chooseRelationshipPortSides(sourceRect, targetRect);
  const sourceSlot = slots?.source ?? { side: fallbackSides.sourceSide, slotIndex: 0, slotCount: 1 };
  const targetSlot = slots?.target ?? { side: fallbackSides.targetSide, slotIndex: 0, slotCount: 1 };
  const horizontal = sourceSlot.side === 'left' || sourceSlot.side === 'right' || Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  const preferTitleBand = Boolean(readableHorizontalRelationshipFlow(sourceRect, targetRect));
  const sourcePort = relationshipPortForSide(sourceRect, sourceSlot.side, sourceSlot.slotIndex, sourceSlot.slotCount, targetCenter, { preferTitleBand });
  const targetPort = relationshipPortForSide(targetRect, targetSlot.side, targetSlot.slotIndex, targetSlot.slotCount, sourceCenter, { preferTitleBand });
  const sourceNormal = relationshipPortNormalForSide(sourceSlot.side);
  const targetNormal = relationshipPortNormalForSide(targetSlot.side);
  telemetry('calculate-relationship-ports', { sourceId: ids.sourceId, targetId: ids.targetId, sourcePort, targetPort, sourceRect, targetRect, sourceSlot, targetSlot });
  return { sourcePort, targetPort, horizontal, sourceRect, targetRect, sourceSide: sourceSlot.side, targetSide: targetSlot.side, sourceNormal, targetNormal };
}
