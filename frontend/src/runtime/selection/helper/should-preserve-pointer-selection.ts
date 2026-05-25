/**
 * WHAT: Decides whether pointer down should keep the current selection set.
 * WHY: Direct card clicks must be able to escape zone-expanded selections.
 */
import { selectionIncludesTarget } from './selection-includes-target.js';

type SelectionState = { cardIds: string[]; zoneIds: string[]; groupIds: string[] };

export const directCardClickReplacesZoneSelectionSpec = 'a6c2f0d4';

export function shouldPreservePointerSelection(selection: SelectionState, kind: string, id: string, additive: boolean): boolean {
  if (additive) return false;
  if (kind === 'card' && selection.zoneIds.length > 0) return false;
  return selectionIncludesTarget(selection, kind, id);
}
