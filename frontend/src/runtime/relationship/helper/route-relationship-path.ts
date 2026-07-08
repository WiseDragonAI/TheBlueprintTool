import { telemetry } from '../../telemetry/effect/telemetry.js';
import { relationshipPortNormalForSide } from './relationship-port-normal-for-side.js';
import { relationshipPortNormal } from './relationship-port-normal.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Point = { x: number; y: number };
type Normal = { x: number; y: number };
type LabelPoint = Point & { anchor: 'start' | 'middle' | 'end' };

const RELATIONSHIP_LABEL_SAFETY_MARGIN = 72;

type RouteRelationshipInput = {
  sourcePort: Point;
  targetPort: Point;
  horizontal: boolean;
  sourceRect: CanvasRect;
  targetRect: CanvasRect;
  routeIndex?: number;
  sourceSide?: string;
  targetSide?: string;
  sourceNormal?: Normal;
  targetNormal?: Normal;
};

export function routeRelationshipPath(input: RouteRelationshipInput): { path: string; label: Point; startLabel: LabelPoint; endLabel: LabelPoint } {
  const { sourcePort, targetPort, sourceRect, targetRect } = input;
  const sourceNormal = explicitNormal(sourcePort, sourceRect, input.sourceSide, input.sourceNormal);
  const targetNormal = explicitNormal(targetPort, targetRect, input.targetSide, input.targetNormal);
  const control = normalControlPoints(sourcePort, targetPort, sourceNormal, targetNormal);
  const path = `M ${sourcePort.x} ${sourcePort.y} C ${control.c1.x} ${control.c1.y}, ${control.c2.x} ${control.c2.y}, ${targetPort.x} ${targetPort.y}`;
  const label = cubicPoint(sourcePort, control.c1, control.c2, targetPort, 0.5);
  const startLabel = portLabelPoint(sourcePort, sourceNormal, sourceRect);
  const endLabel = portLabelPoint(targetPort, targetNormal, targetRect);
  telemetry('route-relationship-path', { path, label, startLabel, endLabel, sourceNormal, targetNormal, curve: 'core-v1-port-normal-bezier' });
  return { path, label, startLabel, endLabel };
}

function explicitNormal(port: Point, rect: CanvasRect, side?: string, normal?: Normal): Normal {
  if (normal) return normal;
  if (side) return relationshipPortNormalForSide(side);
  return relationshipPortNormal(port, rect);
}

function normalControlPoints(sourcePort: Point, targetPort: Point, sourceNormal: Normal, targetNormal: Normal): { c1: Point; c2: Point } {
  const distance = Math.hypot(targetPort.x - sourcePort.x, targetPort.y - sourcePort.y);
  const handle = readableHandleLength(sourcePort, targetPort, sourceNormal, targetNormal, distance);
  return {
    c1: { x: sourcePort.x + sourceNormal.x * handle, y: sourcePort.y + sourceNormal.y * handle },
    c2: { x: targetPort.x + targetNormal.x * handle, y: targetPort.y + targetNormal.y * handle }
  };
}

function readableHandleLength(sourcePort: Point, targetPort: Point, sourceNormal: Normal, targetNormal: Normal, distance: number): number {
  const base = Math.min(260, Math.max(72, distance * 0.34));
  const directGap = directOpposingGap(sourcePort, targetPort, sourceNormal, targetNormal);
  if (directGap === null) return base;
  return Math.min(base, Math.max(18, directGap * 0.45));
}

function directOpposingGap(sourcePort: Point, targetPort: Point, sourceNormal: Normal, targetNormal: Normal): number | null {
  if (sourceNormal.x !== 0 && sourceNormal.x + targetNormal.x === 0) {
    const gap = sourceNormal.x > 0 ? targetPort.x - sourcePort.x : sourcePort.x - targetPort.x;
    return gap > 0 ? gap : null;
  }
  if (sourceNormal.y !== 0 && sourceNormal.y + targetNormal.y === 0) {
    const gap = sourceNormal.y > 0 ? targetPort.y - sourcePort.y : sourcePort.y - targetPort.y;
    return gap > 0 ? gap : null;
  }
  return null;
}

function portLabelPoint(port: Point, normal: Normal, rect: CanvasRect): LabelPoint {
  const anchor = normal.x > 0 ? 'start' : normal.x < 0 ? 'end' : 'middle';
  if (normal.x > 0) {
    return { x: rect.right + RELATIONSHIP_LABEL_SAFETY_MARGIN, y: port.y - 8, anchor };
  }
  if (normal.x < 0) {
    return { x: rect.left - RELATIONSHIP_LABEL_SAFETY_MARGIN, y: port.y - 8, anchor };
  }
  if (normal.y > 0) {
    return { x: port.x, y: rect.bottom + RELATIONSHIP_LABEL_SAFETY_MARGIN, anchor };
  }
  return { x: port.x, y: rect.top - RELATIONSHIP_LABEL_SAFETY_MARGIN, anchor };
}

function cubicPoint(start: Point, c1: Point, c2: Point, end: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * start.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * end.x,
    y: mt ** 3 * start.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * end.y
  };
}
