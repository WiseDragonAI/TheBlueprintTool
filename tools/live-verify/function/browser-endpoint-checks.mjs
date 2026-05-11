export function browserEndpointChecks(selector) {
  return [...document.querySelectorAll(selector)].map(function browserCheckRelationshipEndpoint(relationship) {
    const source = document.querySelector(`[data-card-id="${relationship.dataset.source}"]`);
    const target = document.querySelector(`[data-card-id="${relationship.dataset.target}"]`);
    if (!source || !target) return { id: relationship.dataset.relationshipId, ok: false, missingEndpoint: true };
    const relationshipPoints = browserParsePath(relationship.getAttribute('d'));
    const relationshipSourceRect = browserRect(source);
    const relationshipTargetRect = browserRect(target);
    const relationshipSourceDistance = browserDistanceToRect(relationshipPoints[0], relationshipSourceRect);
    const relationshipTargetDistance = browserDistanceToRect(relationshipPoints[relationshipPoints.length - 1], relationshipTargetRect);
    const sourceSecondPoint = relationshipPoints[1] ?? relationshipPoints[0];
    const targetPreviousPoint = relationshipPoints[relationshipPoints.length - 2] ?? relationshipPoints[relationshipPoints.length - 1];
    const sourceConnectorClearance = relationshipPoints.length === 2 || browserDistanceToRect(sourceSecondPoint, relationshipSourceRect) >= 24;
    const targetConnectorClearance = relationshipPoints.length === 2 || browserDistanceToRect(targetPreviousPoint, relationshipTargetRect) >= 24;
    return {
      id: relationship.dataset.relationshipId,
      sourceDistance: relationshipSourceDistance,
      targetDistance: relationshipTargetDistance,
      sourceOutside: !browserInside(relationshipPoints[0], relationshipSourceRect),
      targetOutside: !browserInside(relationshipPoints[relationshipPoints.length - 1], relationshipTargetRect),
      sourceConnectorClearance,
      targetConnectorClearance,
      ok: relationshipSourceDistance >= 4 && relationshipSourceDistance <= 16 && relationshipTargetDistance >= 4 && relationshipTargetDistance <= 16 && sourceConnectorClearance && targetConnectorClearance
    };
  });
}
