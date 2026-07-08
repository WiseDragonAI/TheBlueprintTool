import { center } from '../../canvas/helper/center.js';
import { relationshipPortSideOptions } from './relationship-port-side-options.js';
import { relationshipPortForSide, type RelationshipPortOffsetPolicy } from './relationship-port-for-side.js';
import { relationshipPortNormalForSide } from './relationship-port-normal-for-side.js';
import type { CanvasRect } from '../../ledger/helper/active-ledger-geometry.js';

type Point = { x: number; y: number };
type Normal = { x: number; y: number };

export type RelationshipRouteCandidate = {
  sourceSide: string;
  targetSide: string;
  sourceOffsetPolicy: RelationshipPortOffsetPolicy;
  targetOffsetPolicy: RelationshipPortOffsetPolicy;
  sourcePort: Point;
  targetPort: Point;
  sourceNormal: Normal;
  targetNormal: Normal;
  score: number;
};

export function chooseRelationshipRouteCandidate(sourceRect: CanvasRect, targetRect: CanvasRect): RelationshipRouteCandidate {
  let best: RelationshipRouteCandidate | null = null;
  for (const sourceSide of relationshipPortSideOptions()) {
    for (const targetSide of relationshipPortSideOptions()) {
      for (const sourceOffsetPolicy of relationshipPortOffsetPolicies(sourceSide)) {
        for (const targetOffsetPolicy of relationshipPortOffsetPolicies(targetSide)) {
          const candidate = relationshipRouteCandidateForPolicies(sourceRect, targetRect, sourceSide, targetSide, sourceOffsetPolicy, targetOffsetPolicy);
          if (!best || candidate.score < best.score) best = candidate;
        }
      }
    }
  }
  return best ?? relationshipRouteCandidateForPolicies(sourceRect, targetRect, 'right', 'left', 'projected', 'projected');
}

export function relationshipRouteCandidateForPolicies(
  sourceRect: CanvasRect,
  targetRect: CanvasRect,
  sourceSide: string,
  targetSide: string,
  sourceOffsetPolicy: RelationshipPortOffsetPolicy = 'projected',
  targetOffsetPolicy: RelationshipPortOffsetPolicy = 'projected'
): RelationshipRouteCandidate {
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const sourcePort = relationshipPortForSide(sourceRect, sourceSide, 0, 1, targetCenter, { offsetPolicy: sourceOffsetPolicy });
  const targetPort = relationshipPortForSide(targetRect, targetSide, 0, 1, sourceCenter, { offsetPolicy: targetOffsetPolicy });
  const sourceNormal = relationshipPortNormalForSide(sourceSide);
  const targetNormal = relationshipPortNormalForSide(targetSide);
  const candidate = { sourceSide, targetSide, sourceOffsetPolicy, targetOffsetPolicy, sourcePort, targetPort, sourceNormal, targetNormal, score: 0 };
  return { ...candidate, score: scoreRelationshipRouteCandidate(sourceRect, targetRect, candidate) };
}

function scoreRelationshipRouteCandidate(sourceRect: CanvasRect, targetRect: CanvasRect, candidate: Omit<RelationshipRouteCandidate, 'score'>): number {
  const clearance = 48;
  const minimumCorridor = clearance * 2;
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const sourceFacing = candidate.sourceNormal.x * (targetCenter.x - sourceCenter.x) + candidate.sourceNormal.y * (targetCenter.y - sourceCenter.y);
  const targetFacing = candidate.targetNormal.x * (sourceCenter.x - targetCenter.x) + candidate.targetNormal.y * (sourceCenter.y - targetCenter.y);
  const sourceExit = {
    x: candidate.sourcePort.x + candidate.sourceNormal.x * clearance,
    y: candidate.sourcePort.y + candidate.sourceNormal.y * clearance
  };
  const targetEntry = {
    x: candidate.targetPort.x + candidate.targetNormal.x * clearance,
    y: candidate.targetPort.y + candidate.targetNormal.y * clearance
  };
  const routeDistance = Math.abs(candidate.sourcePort.x - sourceExit.x)
    + Math.abs(sourceExit.x - targetEntry.x)
    + Math.abs(sourceExit.y - targetEntry.y)
    + Math.abs(targetEntry.x - candidate.targetPort.x)
    + Math.abs(targetEntry.y - candidate.targetPort.y);
  const sourceHorizontal = isHorizontalSide(candidate.sourceSide);
  const targetHorizontal = isHorizontalSide(candidate.targetSide);
  const awayPenalty = Math.max(0, -sourceFacing) * 6 + Math.max(0, -targetFacing) * 6;
  const sameSidePenalty = candidate.sourceSide === candidate.targetSide ? 900 : 0;
  const mixedAxisPenalty = sourceHorizontal === targetHorizontal ? 0 : 1200;
  const oppositeBonus = candidate.sourceNormal.x + candidate.targetNormal.x === 0 && candidate.sourceNormal.y + candidate.targetNormal.y === 0 ? -120 : 0;
  const tightCorridorPenalty = tightCorridorScore(sourceRect, targetRect, candidate.sourceSide, candidate.targetSide, minimumCorridor);
  const horizontalFlowBonus = horizontalFlowScore(sourceRect, targetRect, candidate.sourceSide, candidate.targetSide);
  const horizontalDeltaPenalty = sourceHorizontal && targetHorizontal ? Math.abs(candidate.sourcePort.y - candidate.targetPort.y) * 2.5 : 0;
  return routeDistance
    + awayPenalty
    + sameSidePenalty
    + mixedAxisPenalty
    + oppositeBonus
    + tightCorridorPenalty
    + horizontalFlowBonus
    + horizontalDeltaPenalty;
}

function relationshipPortOffsetPolicies(side: string): RelationshipPortOffsetPolicy[] {
  return isHorizontalSide(side) ? ['projected', 'title-band'] : ['projected'];
}

function isHorizontalSide(side: string): boolean {
  return side === 'left' || side === 'right';
}

function tightCorridorScore(sourceRect: CanvasRect, targetRect: CanvasRect, sourceSide: string, targetSide: string, minimumCorridor: number): number {
  if (sourceSide === 'right' && targetSide === 'left') return Math.max(0, minimumCorridor - (targetRect.left - sourceRect.right)) * 80;
  if (sourceSide === 'left' && targetSide === 'right') return Math.max(0, minimumCorridor - (sourceRect.left - targetRect.right)) * 80;
  if (sourceSide === 'bottom' && targetSide === 'top') return Math.max(0, minimumCorridor - (targetRect.top - sourceRect.bottom)) * 80;
  if (sourceSide === 'top' && targetSide === 'bottom') return Math.max(0, minimumCorridor - (sourceRect.top - targetRect.bottom)) * 80;
  return 0;
}

function horizontalFlowScore(sourceRect: CanvasRect, targetRect: CanvasRect, sourceSide: string, targetSide: string): number {
  const minimumGap = 28;
  const overlapTolerance = 96;
  const verticalOverlap = sourceRect.top <= targetRect.bottom + overlapTolerance && targetRect.top <= sourceRect.bottom + overlapTolerance;
  if (!verticalOverlap) return 0;
  if (sourceSide === 'right' && targetSide === 'left' && targetRect.left - sourceRect.right >= minimumGap) return -2500;
  if (sourceSide === 'left' && targetSide === 'right' && sourceRect.left - targetRect.right >= minimumGap) return -2500;
  return 0;
}
