export function center(rect: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
