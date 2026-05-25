import { relationshipPortSideOptions } from './relationship-port-side-options.js';
import { scoreRelationshipPortSides } from './score-relationship-port-sides.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export function chooseRelationshipPortSides(sourceRect: CanvasRect, targetRect: CanvasRect): { sourceSide: string; targetSide: string } {
  let best = { sourceSide: 'right', targetSide: 'left', score: Number.POSITIVE_INFINITY };
  for (const sourceSide of relationshipPortSideOptions()) {
    for (const targetSide of relationshipPortSideOptions()) {
      const score = scoreRelationshipPortSides(sourceRect, targetRect, sourceSide, targetSide);
      if (score < best.score) best = { sourceSide, targetSide, score };
    }
  }
  return { sourceSide: best.sourceSide, targetSide: best.targetSide };
}
