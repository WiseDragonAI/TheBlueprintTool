export function browserSegmentHits(a, b, box) {
  for (let step = 1; step < 20; step += 1) {
    const t = step / 20;
    if (browserInside({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, box)) return true;
  }
  return false;
}
