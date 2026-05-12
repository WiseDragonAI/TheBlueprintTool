import { telemetry } from './telemetry.js';
import { compactRoutePoints } from './compact-route-points.js';
import { relationshipRouteCrossesCard } from './relationship-route-crosses-card.js';
import { relationshipPortNormal } from './relationship-port-normal.js';

export function routeRelationshipPath({ sourcePort, targetPort, horizontal, sourceRect, targetRect, routeIndex = 0 }: { sourcePort: { x: number; y: number }; targetPort: { x: number; y: number }; horizontal: boolean; sourceRect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; targetRect: { left: number; top: number; right: number; bottom: number; width: number; height: number }; routeIndex?: number }): { path: string; label: { x: number; y: number } } {
  const clearance = 48;
  const visibleEndpointGap = 14;
  const laneSpacing = 34;
  const minimumDirectLength = 72;
  const sourceNormal = relationshipPortNormal(sourcePort, sourceRect);
  const targetNormal = relationshipPortNormal(targetPort, targetRect);
  const sourceStandoff = { x: sourcePort.x + sourceNormal.x * visibleEndpointGap, y: sourcePort.y + sourceNormal.y * visibleEndpointGap };
  const targetStandoff = { x: targetPort.x + targetNormal.x * visibleEndpointGap, y: targetPort.y + targetNormal.y * visibleEndpointGap };
  const sourceExit = { x: sourcePort.x + sourceNormal.x * clearance, y: sourcePort.y + sourceNormal.y * clearance };
  const targetEntry = { x: targetPort.x + targetNormal.x * clearance, y: targetPort.y + targetNormal.y * clearance };
  const laneOffset = ((routeIndex % 3) - 1) * laneSpacing;
  const laneBand = Math.abs(laneOffset);
  const routeHorizontal = Math.abs(targetEntry.x - sourceExit.x) >= Math.abs(targetEntry.y - sourceExit.y);
  const sameColumn = Math.abs(sourcePort.x - targetPort.x) < 1;
  const sameRow = Math.abs(sourcePort.y - targetPort.y) < 1;
  const directRoute = compactRoutePoints([sourceStandoff, targetStandoff]);
  const directLength = Math.abs(sourceStandoff.x - targetStandoff.x) + Math.abs(sourceStandoff.y - targetStandoff.y);
  let routedPoints = [];
  if ((sameRow || sameColumn) && directLength >= minimumDirectLength && !relationshipRouteCrossesCard(directRoute, sourceRect) && !relationshipRouteCrossesCard(directRoute, targetRect)) {
    routedPoints = directRoute;
  } else if (routeHorizontal) {
    const routeX = (sourceExit.x + targetEntry.x) / 2 + laneOffset;
    routedPoints = compactRoutePoints([sourceStandoff, sourceExit, { x: routeX, y: sourceExit.y }, { x: routeX, y: targetEntry.y }, targetEntry, targetStandoff]);
    if (relationshipRouteCrossesCard(routedPoints, sourceRect) || relationshipRouteCrossesCard(routedPoints, targetRect)) {
      const routeY = Math.max(32, Math.min(sourceRect.top, targetRect.top) - clearance - laneBand);
      routedPoints = compactRoutePoints([sourceStandoff, sourceExit, { x: sourceExit.x, y: routeY }, { x: targetEntry.x, y: routeY }, targetEntry, targetStandoff]);
    }
  } else {
    const routeY = (sourceExit.y + targetEntry.y) / 2 + laneOffset;
    routedPoints = compactRoutePoints([sourceStandoff, sourceExit, { x: sourceExit.x, y: routeY }, { x: targetEntry.x, y: routeY }, targetEntry, targetStandoff]);
    if (relationshipRouteCrossesCard(routedPoints, sourceRect) || relationshipRouteCrossesCard(routedPoints, targetRect)) {
      const routeX = Math.max(sourceRect.right, targetRect.right) + clearance + laneBand;
      routedPoints = compactRoutePoints([sourceStandoff, sourceExit, { x: routeX, y: sourceExit.y }, { x: routeX, y: targetEntry.y }, targetEntry, targetStandoff]);
    }
  }
  const labelPoint = routedPoints[Math.floor(routedPoints.length / 2)];
  const label = { x: labelPoint.x + 10, y: labelPoint.y - 10 };
  const path = `M ${routedPoints.map((point) => `${point.x} ${point.y}`).join(' L ')}`;
  telemetry('route-relationship-path', { path, label, routedPoints, routeIndex, laneOffset, sourceNormal, targetNormal, visibleEndpointGap, collisionAvoidance: 'orthogonal-card-clearance' });
  return { path, label };
}
