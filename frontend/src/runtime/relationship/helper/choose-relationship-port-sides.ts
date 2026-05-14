type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export function chooseRelationshipPortSides(sourceRect: CanvasRect, targetRect: CanvasRect): { sourceSide: string; targetSide: string } {
  return {
    sourceSide: closestSideForEndpoint(sourceRect, rectCenter(targetRect)),
    targetSide: closestSideForEndpoint(targetRect, rectCenter(sourceRect))
  };
}

function closestSideForEndpoint(rect: CanvasRect, target: { x: number; y: number }): string {
  const center = rectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  if (Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function rectCenter(rect: CanvasRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
