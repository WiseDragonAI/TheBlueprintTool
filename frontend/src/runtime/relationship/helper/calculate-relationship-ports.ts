/**
 * WHAT: Runtime helper that resolves source and target relationship ports from DOM card geometry.
 * WHY: SVG relationship routes must attach to chosen card borders in canvas-world coordinates.
 */
import { center } from '../../canvas/helper/center.js';
import { chooseRelationshipPortSides } from './choose-relationship-port-sides.js';
import { elementCanvasRect } from '../../canvas/helper/element-canvas-rect.js';
import { relationshipPortForSide } from './relationship-port-for-side.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function calculateRelationshipPorts(source: HTMLElement, target: HTMLElement, slots?: { source: { side: string; slotIndex: number; slotCount: number }; target: { side: string; slotIndex: number; slotCount: number } }): { sourcePort: { x: number; y: number }; targetPort: { x: number; y: number }; horizontal: boolean; sourceRect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; targetRect: { left: number; top: number; right: number; bottom: number; width: number; height: number } } {
  const sourceRect = elementCanvasRect(source);
  const targetRect = elementCanvasRect(target);
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const fallbackSides = chooseRelationshipPortSides(sourceRect, targetRect);
  const sourceSlot = slots?.source ?? { side: fallbackSides.sourceSide, slotIndex: 0, slotCount: 1 };
  const targetSlot = slots?.target ?? { side: fallbackSides.targetSide, slotIndex: 0, slotCount: 1 };
  const horizontal = sourceSlot.side === 'left' || sourceSlot.side === 'right' || Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  const sourcePort = relationshipPortForSide(sourceRect, sourceSlot.side, sourceSlot.slotIndex, sourceSlot.slotCount);
  const targetPort = relationshipPortForSide(targetRect, targetSlot.side, targetSlot.slotIndex, targetSlot.slotCount);
  telemetry('calculate-relationship-ports', { sourceId: source.dataset.cardId, targetId: target.dataset.cardId, sourcePort, targetPort, sourceRect, targetRect, sourceSlot, targetSlot });
  return { sourcePort, targetPort, horizontal, sourceRect, targetRect };
}
