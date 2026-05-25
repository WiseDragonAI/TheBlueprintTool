export function createLedgerZoneAnnotation(input: {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  color: string;
}): Record<string, unknown> {
  return {
    id: input.id,
    label: 'New zone',
    variant: 'zone',
    color: input.color,
    x: input.rect.x,
    y: input.rect.y,
    width: Math.max(180, input.rect.width),
    height: Math.max(140, input.rect.height)
  };
}
