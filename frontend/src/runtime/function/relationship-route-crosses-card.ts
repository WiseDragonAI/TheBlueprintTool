export function relationshipRouteCrossesCard(points: { x: number; y: number }[], rect: { left: number; top: number; right: number; bottom: number }): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    for (let step = 1; step < 20; step += 1) {
      const t = step / 20;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      if (x > rect.left + 1 && x < rect.right - 1 && y > rect.top + 1 && y < rect.bottom - 1) return true;
    }
  }
  return false;
}
