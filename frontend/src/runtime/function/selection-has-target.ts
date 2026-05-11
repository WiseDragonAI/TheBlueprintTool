import { state } from '../state.js';

export function selectionHasTarget(): boolean {
  return state.selection.cardIds.length > 0 || state.selection.zoneIds.length > 0 || state.selection.groupIds.length > 0;
}
