/**
 * WHAT: Runtime relationship helper for mapping a card border side to its outward normal.
 * WHY: Relationship routing needs explicit side semantics before choosing ports and clearance lanes.
 */
export function relationshipPortNormalForSide(side: string): { x: number; y: number } {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}
