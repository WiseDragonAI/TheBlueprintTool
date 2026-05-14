import { telemetry } from '../../telemetry/effect/telemetry.js';
import { relationshipPortNormal } from './relationship-port-normal.js';

type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Point = { x: number; y: number };
type Normal = { x: number; y: number };
type LabelPoint = Point & { anchor: 'start' | 'middle' | 'end' };

export function routeRelationshipPath({ sourcePort, targetPort, sourceRect, targetRect }: {
  sourcePort: Point;
  targetPort: Point;
  horizontal: boolean;
  sourceRect: CanvasRect;
  targetRect: CanvasRect;
  routeIndex?: number;
}): { path: string; label: Point; startLabel: LabelPoint; endLabel: LabelPoint } {
  const sourceNormal = relationshipPortNormal(sourcePort, sourceRect);
  const targetNormal = relationshipPortNormal(targetPort, targetRect);
  const control = normalControlPoints(sourcePort, targetPort, sourceNormal, targetNormal);
  const path = `M ${sourcePort.x} ${sourcePort.y} C ${control.c1.x} ${control.c1.y}, ${control.c2.x} ${control.c2.y}, ${targetPort.x} ${targetPort.y}`;
  const label = cubicPoint(sourcePort, control.c1, control.c2, targetPort, 0.5);
  const startLabel = portLabelPoint(sourcePort, sourceNormal);
  const endLabel = portLabelPoint(targetPort, targetNormal);
  telemetry('route-relationship-path', { path, label, startLabel, endLabel, sourceNormal, targetNormal, curve: 'core-v1-port-normal-bezier' });
  return { path, label, startLabel, endLabel };
}

function normalControlPoints(sourcePort: Point, targetPort: Point, sourceNormal: Normal, targetNormal: Normal): { c1: Point; c2: Point } {
  const distance = Math.hypot(targetPort.x - sourcePort.x, targetPort.y - sourcePort.y);
  const handle = Math.min(260, Math.max(72, distance * 0.34));
  return {
    c1: { x: sourcePort.x + sourceNormal.x * handle, y: sourcePort.y + sourceNormal.y * handle },
    c2: { x: targetPort.x + targetNormal.x * handle, y: targetPort.y + targetNormal.y * handle }
  };
}

function portLabelPoint(port: Point, normal: Normal): LabelPoint {
  const vertical = normal.y !== 0;
  return {
    x: port.x + normal.x * 46,
    y: port.y + normal.y * 24 - (vertical ? 0 : 8),
    anchor: normal.x > 0 ? 'start' : normal.x < 0 ? 'end' : 'middle'
  };
}

function cubicPoint(start: Point, c1: Point, c2: Point, end: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * start.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * end.x,
    y: mt ** 3 * start.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * end.y
  };
}
