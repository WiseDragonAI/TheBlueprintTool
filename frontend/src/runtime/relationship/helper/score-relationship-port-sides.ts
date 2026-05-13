/**
 * WHAT: Runtime relationship helper that scores one source/target border-side pair.
 * WHY: Routing should choose the shortest outward-facing path before assigning endpoint slots.
 */
import { center } from '../../canvas/helper/center.js';
import { relationshipPortForSide } from './relationship-port-for-side.js';
import { relationshipPortNormalForSide } from './relationship-port-normal-for-side.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export function scoreRelationshipPortSides(sourceRect: CanvasRect, targetRect: CanvasRect, sourceSide: string, targetSide: string): number {
  const clearance = 48;
  const minimumCorridor = clearance * 2;
  const sourcePort = relationshipPortForSide(sourceRect, sourceSide);
  const targetPort = relationshipPortForSide(targetRect, targetSide);
  const sourceNormal = relationshipPortNormalForSide(sourceSide);
  const targetNormal = relationshipPortNormalForSide(targetSide);
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const sourceFacing = sourceNormal.x * (targetCenter.x - sourceCenter.x) + sourceNormal.y * (targetCenter.y - sourceCenter.y);
  const targetFacing = targetNormal.x * (sourceCenter.x - targetCenter.x) + targetNormal.y * (sourceCenter.y - targetCenter.y);
  const sourceExit = { x: sourcePort.x + sourceNormal.x * clearance, y: sourcePort.y + sourceNormal.y * clearance };
  const targetEntry = { x: targetPort.x + targetNormal.x * clearance, y: targetPort.y + targetNormal.y * clearance };
  const routeDistance = Math.abs(sourcePort.x - sourceExit.x)
    + Math.abs(sourceExit.x - targetEntry.x)
    + Math.abs(sourceExit.y - targetEntry.y)
    + Math.abs(targetEntry.x - targetPort.x)
    + Math.abs(targetEntry.y - targetPort.y);
  const sourceHorizontal = sourceSide === 'left' || sourceSide === 'right';
  const targetHorizontal = targetSide === 'left' || targetSide === 'right';
  const awayPenalty = Math.max(0, -sourceFacing) * 6 + Math.max(0, -targetFacing) * 6;
  const sameSidePenalty = sourceSide === targetSide ? 900 : 0;
  const mixedAxisPenalty = sourceHorizontal === targetHorizontal ? 0 : 1200;
  const oppositeBonus = sourceNormal.x + targetNormal.x === 0 && sourceNormal.y + targetNormal.y === 0 ? -120 : 0;
  let tightCorridorPenalty = 0;
  if (sourceSide === 'right' && targetSide === 'left') tightCorridorPenalty = Math.max(0, minimumCorridor - (targetRect.left - sourceRect.right)) * 80;
  if (sourceSide === 'left' && targetSide === 'right') tightCorridorPenalty = Math.max(0, minimumCorridor - (sourceRect.left - targetRect.right)) * 80;
  if (sourceSide === 'bottom' && targetSide === 'top') tightCorridorPenalty = Math.max(0, minimumCorridor - (targetRect.top - sourceRect.bottom)) * 80;
  if (sourceSide === 'top' && targetSide === 'bottom') tightCorridorPenalty = Math.max(0, minimumCorridor - (sourceRect.top - targetRect.bottom)) * 80;
  return routeDistance + awayPenalty + sameSidePenalty + mixedAxisPenalty + oppositeBonus + tightCorridorPenalty;
}
