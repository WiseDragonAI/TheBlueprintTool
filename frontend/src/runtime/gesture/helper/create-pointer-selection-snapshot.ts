/**
 * WHAT: Captures immutable selection and target identity for one pointer session.
 * WHY: Refresh and live selection changes must not change the operands of an active gesture.
 */
import type { PointerSelectionSnapshot, SelectionState } from '../../state.js';
import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';

export function createPointerSelectionSnapshot(input: {
  selection: Partial<SelectionState>;
  targetKind: string;
  targetId: string;
  ledgerStateId: string;
}): PointerSelectionSnapshot {
  return {
    ...cloneSelectionState(input.selection),
    targetKind: input.targetKind,
    targetId: input.targetId,
    ledgerStateId: input.ledgerStateId
  };
}
