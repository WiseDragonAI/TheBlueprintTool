export function browserEndpointChecks(selector) {
  return [...document.querySelectorAll(selector)].map(function browserCheckRelationshipEndpoint(relationship) {
    const source = document.querySelector(`[data-card-id="${relationship.dataset.source}"]`);
    const target = document.querySelector(`[data-card-id="${relationship.dataset.target}"]`);
    if (!source || !target) return { id: relationship.dataset.relationshipId, ok: false, missingEndpoint: true };
    const relationshipPoints = browserParsePath(relationship.getAttribute('d'));
    const relationshipSourceRect = browserRect(source);
    const relationshipTargetRect = browserRect(target);
    const pathMinX = Math.min(...relationshipPoints.map(function relationshipPointX(point) { return point.x; }));
    const pathMaxX = Math.max(...relationshipPoints.map(function relationshipPointX(point) { return point.x; }));
    const pathMinY = Math.min(...relationshipPoints.map(function relationshipPointY(point) { return point.y; }));
    const pathMaxY = Math.max(...relationshipPoints.map(function relationshipPointY(point) { return point.y; }));
    const unionMinX = Math.min(relationshipSourceRect.left, relationshipTargetRect.left);
    const unionMaxX = Math.max(relationshipSourceRect.right, relationshipTargetRect.right);
    const unionMinY = Math.min(relationshipSourceRect.top, relationshipTargetRect.top);
    const unionMaxY = Math.max(relationshipSourceRect.bottom, relationshipTargetRect.bottom);
    const routeOverflow = Math.max(unionMinX - pathMinX, pathMaxX - unionMaxX, unionMinY - pathMinY, pathMaxY - unionMaxY, 0);
    const relationshipSourceDistance = browserDistanceToRect(relationshipPoints[0], relationshipSourceRect);
    const relationshipTargetDistance = browserDistanceToRect(relationshipPoints[relationshipPoints.length - 1], relationshipTargetRect);
    const relationshipSourcePoint = relationshipPoints[0];
    const relationshipTargetPoint = relationshipPoints[relationshipPoints.length - 1];
    const sourceSecondPoint = relationshipPoints[1] ?? relationshipPoints[0];
    const targetPreviousPoint = relationshipPoints[relationshipPoints.length - 2] ?? relationshipPoints[relationshipPoints.length - 1];
    const sourceConnectorClearance = relationshipPoints.length === 2 || browserDistanceToRect(sourceSecondPoint, relationshipSourceRect) >= 24;
    const targetConnectorClearance = relationshipPoints.length === 2 || browserDistanceToRect(targetPreviousPoint, relationshipTargetRect) >= 24;
    const sourceLeftDistance = Math.abs(relationshipSourcePoint.x - relationshipSourceRect.left);
    const sourceRightDistance = Math.abs(relationshipSourcePoint.x - relationshipSourceRect.right);
    const sourceTopDistance = Math.abs(relationshipSourcePoint.y - relationshipSourceRect.top);
    const sourceBottomDistance = Math.abs(relationshipSourcePoint.y - relationshipSourceRect.bottom);
    const targetLeftDistance = Math.abs(relationshipTargetPoint.x - relationshipTargetRect.left);
    const targetRightDistance = Math.abs(relationshipTargetPoint.x - relationshipTargetRect.right);
    const targetTopDistance = Math.abs(relationshipTargetPoint.y - relationshipTargetRect.top);
    const targetBottomDistance = Math.abs(relationshipTargetPoint.y - relationshipTargetRect.bottom);
    let sourceSide = 'left';
    let sourceAxis = relationshipSourcePoint.y;
    if (sourceRightDistance < sourceLeftDistance && sourceRightDistance <= sourceTopDistance && sourceRightDistance <= sourceBottomDistance) sourceSide = 'right';
    if (sourceTopDistance < sourceLeftDistance && sourceTopDistance < sourceRightDistance && sourceTopDistance <= sourceBottomDistance) {
      sourceSide = 'top';
      sourceAxis = relationshipSourcePoint.x;
    }
    if (sourceBottomDistance < sourceLeftDistance && sourceBottomDistance < sourceRightDistance && sourceBottomDistance < sourceTopDistance) {
      sourceSide = 'bottom';
      sourceAxis = relationshipSourcePoint.x;
    }
    let targetSide = 'left';
    let targetAxis = relationshipTargetPoint.y;
    if (targetRightDistance < targetLeftDistance && targetRightDistance <= targetTopDistance && targetRightDistance <= targetBottomDistance) targetSide = 'right';
    if (targetTopDistance < targetLeftDistance && targetTopDistance < targetRightDistance && targetTopDistance <= targetBottomDistance) {
      targetSide = 'top';
      targetAxis = relationshipTargetPoint.x;
    }
    if (targetBottomDistance < targetLeftDistance && targetBottomDistance < targetRightDistance && targetBottomDistance < targetTopDistance) {
      targetSide = 'bottom';
      targetAxis = relationshipTargetPoint.x;
    }
    return {
      id: relationship.dataset.relationshipId,
      sourceId: relationship.dataset.source,
      targetId: relationship.dataset.target,
      sourceSide,
      targetSide,
      sourceAxis,
      targetAxis,
      sourcePoint: relationshipSourcePoint,
      targetPoint: relationshipTargetPoint,
      routeOverflow,
      sourceDistance: relationshipSourceDistance,
      targetDistance: relationshipTargetDistance,
      sourceOutside: !browserInside(relationshipPoints[0], relationshipSourceRect),
      targetOutside: !browserInside(relationshipPoints[relationshipPoints.length - 1], relationshipTargetRect),
      sourceConnectorClearance,
      targetConnectorClearance,
      ok: relationshipSourceDistance >= 4 && relationshipSourceDistance <= 16 && relationshipTargetDistance >= 4 && relationshipTargetDistance <= 16 && sourceConnectorClearance && targetConnectorClearance && routeOverflow <= 140
    };
  });
}
