export function createLedgerGroupAnnotation(input: {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
}): Record<string, unknown> {
  return {
    id: input.id,
    label: 'New group',
    variant: 'group',
    x: Math.max(0, input.rect.x),
    y: Math.max(0, input.rect.y),
    width: Math.max(220, input.rect.width),
    height: Math.max(160, input.rect.height)
  };
}
