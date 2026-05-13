import { center } from '../../canvas/helper/center.js';

export function relationshipPortSide(rect: { left: number; top: number; width: number; height: number }, otherRect: { left: number; top: number; width: number; height: number }): string {
  const ownCenter = center(rect);
  const otherCenter = center(otherRect);
  const dx = otherCenter.x - ownCenter.x;
  const dy = otherCenter.y - ownCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}
