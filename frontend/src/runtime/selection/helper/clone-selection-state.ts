/**
 * WHAT: Normalizes and clones the three runtime selection id lists.
 * WHY: Gesture snapshots and async refresh guards must never share mutable selection arrays.
 */
import type { SelectionState } from '../../state.js';

export function cloneSelectionState(selection?: Partial<SelectionState> | null): SelectionState {
  const cloneIds = (values: unknown): string[] => Array.isArray(values)
    ? values.map((value) => String(value)).filter(Boolean)
    : [];
  return {
    cardIds: cloneIds(selection?.cardIds),
    zoneIds: cloneIds(selection?.zoneIds),
    groupIds: cloneIds(selection?.groupIds)
  };
}
