export function relationshipPortNormal(port: { x: number; y: number }, rect: { left: number; top: number; right: number; bottom: number }): { x: number; y: number } {
  const distances = [
    { x: -1, y: 0, distance: Math.abs(port.x - rect.left) },
    { x: 1, y: 0, distance: Math.abs(port.x - rect.right) },
    { x: 0, y: -1, distance: Math.abs(port.y - rect.top) },
    { x: 0, y: 1, distance: Math.abs(port.y - rect.bottom) }
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return { x: distances[0].x, y: distances[0].y };
}
