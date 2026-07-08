import { chooseRelationshipRouteCandidate } from './choose-relationship-route-candidate.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export function chooseRelationshipPortSides(sourceRect: CanvasRect, targetRect: CanvasRect): { sourceSide: string; targetSide: string } {
  const candidate = chooseRelationshipRouteCandidate(sourceRect, targetRect);
  return { sourceSide: candidate.sourceSide, targetSide: candidate.targetSide };
}
