/**
 * WHAT: Removes selected ids that no longer exist in the active ledger or changed annotation kind.
 * WHY: Same-ledger refreshes preserve valid operator context without retaining stale targets.
 */
import { activeLedgerAnnotationMap, activeLedgerCardMap } from '../../ledger/helper/active-ledger-geometry.js';
import { state, type SelectionState } from '../../state.js';
import { cloneSelectionState } from './clone-selection-state.js';

export function pruneSelectionToActiveLedger(selection: Partial<SelectionState> = state.selection): SelectionState {
  const current = cloneSelectionState(selection);
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  return {
    cardIds: current.cardIds.filter((id) => cards.has(id)),
    zoneIds: current.zoneIds.filter((id) => {
      const annotation = annotations.get(id);
      return Boolean(annotation && annotation.variant !== 'group');
    }),
    groupIds: current.groupIds.filter((id) => {
      const annotation = annotations.get(id);
      return Boolean(annotation && annotation.variant === 'group');
    })
  };
}
