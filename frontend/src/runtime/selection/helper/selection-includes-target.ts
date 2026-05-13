type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export function selectionIncludesTarget(selection: SelectionState, kind: string, id: string): boolean {
  if (!id) return false;
  if (kind === 'card') return selection.cardIds.includes(id);
  if (kind === 'zone') return selection.zoneIds.includes(id);
  if (kind === 'group') return selection.groupIds.includes(id);
  return false;
}
