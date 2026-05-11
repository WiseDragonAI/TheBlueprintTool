import { telemetry } from './telemetry.js';
import { calculateRelationshipStandoff } from './calculate-relationship-standoff.js';
import { compactRoutePoints } from './compact-route-points.js';
import { relationshipRouteCrossesCard } from './relationship-route-crosses-card.js';

export function routeRelationshipPath({ sourcePort, targetPort, horizontal, sourceRect, targetRect, routeIndex = 0 }: { sourcePort: { x: number; y: number }; targetPort: { x: number; y: number }; horizontal: boolean; sourceRect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; targetRect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; routeIndex?: number }): { path: string; label: { x: number; y: number } } {
  const clearance = 48;
  const laneSpacing = 34;
  const { sourceStandoff, targetStandoff, direction } = calculateRelationshipStandoff({ sourcePort, targetPort, horizontal });
  const sourceExit = horizontal
    ? { x: sourcePort.x + direction * clearance, y: sourcePort.y }
    : { x: sourcePort.x, y: sourcePort.y + direction * clearance };
  const targetEntry = horizontal
    ? { x: targetPort.x - direction * clearance, y: targetPort.y }
    : { x: targetPort.x, y: targetPort.y - direction * clearance };
  const laneOffset = routeIndex * laneSpacing;
  const clearHorizontal = direction > 0 ? sourceExit.x <= targetEntry.x : sourceExit.x >= targetEntry.x;
  const clearVertical = direction > 0 ? sourceExit.y <= targetEntry.y : sourceExit.y >= targetEntry.y;
  const sameColumn = Math.abs(sourcePort.x - targetPort.x) < 1;
  const sameRow = Math.abs(sourcePort.y - targetPort.y) < 1;
  const directRoute = compactRoutePoints([sourcePort, sourceStandoff, targetStandoff, targetPort]);
  const horizontalElbowRoute = compactRoutePoints([sourcePort, sourceStandoff, { x: targetStandoff.x, y: sourceStandoff.y }, targetStandoff, targetPort]);
  const verticalElbowRoute = compactRoutePoints([sourcePort, sourceStandoff, { x: sourceStandoff.x, y: targetStandoff.y }, targetStandoff, targetPort]);
  let routedPoints = [];
  if ((sameRow || sameColumn) && !relationshipRouteCrossesCard(directRoute, sourceRect) && !relationshipRouteCrossesCard(directRoute, targetRect)) {
    routedPoints = directRoute;
  } else if (!relationshipRouteCrossesCard(horizontalElbowRoute, sourceRect) && !relationshipRouteCrossesCard(horizontalElbowRoute, targetRect)) {
    routedPoints = horizontalElbowRoute;
  } else if (!relationshipRouteCrossesCard(verticalElbowRoute, sourceRect) && !relationshipRouteCrossesCard(verticalElbowRoute, targetRect)) {
    routedPoints = verticalElbowRoute;
  } else if (horizontal && clearHorizontal) {
    const routeX = (sourceExit.x + targetEntry.x) / 2 + laneOffset;
    routedPoints = compactRoutePoints([sourcePort, sourceStandoff, sourceExit, { x: routeX, y: sourceExit.y }, { x: routeX, y: targetEntry.y }, targetEntry, targetStandoff, targetPort]);
  } else if (!horizontal && clearVertical) {
    const routeY = (sourceExit.y + targetEntry.y) / 2 + laneOffset;
    routedPoints = compactRoutePoints([sourcePort, sourceStandoff, sourceExit, { x: sourceExit.x, y: routeY }, { x: targetEntry.x, y: routeY }, targetEntry, targetStandoff, targetPort]);
  } else if (horizontal) {
    const routeY = Math.max(32, Math.min(sourceRect.top, targetRect.top) - clearance - laneOffset);
    routedPoints = compactRoutePoints([sourcePort, sourceStandoff, sourceExit, { x: sourceExit.x, y: routeY }, { x: targetEntry.x, y: routeY }, targetEntry, targetStandoff, targetPort]);
  } else {
    const routeX = Math.min(5168, Math.max(sourceRect.right, targetRect.right) + clearance + laneOffset);
    routedPoints = compactRoutePoints([sourcePort, sourceStandoff, sourceExit, { x: routeX, y: sourceExit.y }, { x: routeX, y: targetEntry.y }, targetEntry, targetStandoff, targetPort]);
  }
  const labelPoint = routedPoints[Math.floor(routedPoints.length / 2)];
  const label = { x: labelPoint.x + 10, y: labelPoint.y - 10 };
  const path = `M ${routedPoints.map((point) => `${point.x} ${point.y}`).join(' L ')}`;
  telemetry('route-relationship-path', { path, label, routedPoints, routeIndex, collisionAvoidance: 'orthogonal-card-clearance' });
  return { path, label };
}
