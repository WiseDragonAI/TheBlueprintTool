export const clickMoveThresholdPx = 4;

export function pointerDistancePx(start: { x: number; y: number }, current: { x: number; y: number }): number {
  return Math.hypot(current.x - start.x, current.y - start.y);
}

export function isClickMovement(distancePx: number): boolean {
  return distancePx < clickMoveThresholdPx;
}
