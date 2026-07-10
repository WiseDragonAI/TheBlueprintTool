/**
 * WHAT: Compares two runtime selections by ordered ids.
 * WHY: An async refresh may restore its captured selection only when the operator has not changed it.
 */
import type { SelectionState } from '../../state.js';
import { cloneSelectionState } from './clone-selection-state.js';

export function selectionStatesEqual(
  left: Partial<SelectionState> | null | undefined,
  right: Partial<SelectionState> | null | undefined
): boolean {
  const current = cloneSelectionState(left);
  const expected = cloneSelectionState(right);
  return current.cardIds.length === expected.cardIds.length
    && current.cardIds.every((value, index) => value === expected.cardIds[index])
    && current.zoneIds.length === expected.zoneIds.length
    && current.zoneIds.every((value, index) => value === expected.zoneIds[index])
    && current.groupIds.length === expected.groupIds.length
    && current.groupIds.every((value, index) => value === expected.groupIds[index]);
}
