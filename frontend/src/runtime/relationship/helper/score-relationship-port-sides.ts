import { relationshipRouteCandidateForPolicies } from './choose-relationship-route-candidate.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export function scoreRelationshipPortSides(sourceRect: CanvasRect, targetRect: CanvasRect, sourceSide: string, targetSide: string): number {
  return relationshipRouteCandidateForPolicies(sourceRect, targetRect, sourceSide, targetSide, 'projected', 'projected').score;
}
