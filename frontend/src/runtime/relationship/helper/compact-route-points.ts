export function compactRoutePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}
