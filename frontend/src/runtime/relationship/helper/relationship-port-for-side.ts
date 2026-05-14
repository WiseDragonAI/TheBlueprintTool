export function relationshipPortForSide(
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  side: string,
  slotIndex = 0,
  slotCount = 1,
  target?: { x: number; y: number }
): { x: number; y: number } {
  const offset = slotCount > 1
    ? sidePortSlot(rect, side, slotCount, slotIndex)
    : projectedSideOffset(rect, side, target);
  if (side === 'left') return { x: rect.left, y: offset };
  if (side === 'right') return { x: rect.right, y: offset };
  if (side === 'top') return { x: offset, y: rect.top };
  return { x: offset, y: rect.bottom };
}

function projectedSideOffset(
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  side: string,
  target?: { x: number; y: number }
): number {
  if (!target) return sidePortSlot(rect, side, 1, 0);
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const projected = side === 'left' || side === 'right'
    ? center.y + (dy / Math.max(Math.abs(dx), 1)) * (rect.width / 2)
    : center.x + (dx / Math.max(Math.abs(dy), 1)) * (rect.height / 2);
  return clampSideOffset(rect, side, projected);
}

function sidePortSlot(
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  side: string,
  total: number,
  index: number
): number {
  const bounds = sidePortBounds(rect, side);
  const fraction = (index + 1) / (total + 1);
  return bounds.min + (bounds.max - bounds.min) * fraction;
}

function clampSideOffset(
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  side: string,
  offset: number
): number {
  const bounds = sidePortBounds(rect, side);
  return Math.min(bounds.max, Math.max(bounds.min, offset));
}

function sidePortBounds(
  rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  side: string
): { min: number; max: number } {
  const verticalSide = side === 'left' || side === 'right';
  const start = verticalSide ? rect.top : rect.left;
  const span = verticalSide ? rect.height : rect.width;
  const padding = Math.min(36, span / 4);
  return { min: start + padding, max: start + Math.max(padding, span - padding) };
}
