export function relationshipPortForSide(rect: { left: number; top: number; right: number; bottom: number; width: number; height: number }, side: string, slotIndex = 0, slotCount = 1): { x: number; y: number } {
  const fraction = (slotIndex + 1) / (slotCount + 1);
  if (side === 'left') return { x: rect.left, y: rect.top + rect.height * fraction };
  if (side === 'right') return { x: rect.right, y: rect.top + rect.height * fraction };
  if (side === 'top') return { x: rect.left + rect.width * fraction, y: rect.top };
  return { x: rect.left + rect.width * fraction, y: rect.bottom };
}
