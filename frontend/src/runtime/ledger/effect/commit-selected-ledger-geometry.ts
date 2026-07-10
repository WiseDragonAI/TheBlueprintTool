/**
 * WHAT: Commits active-ledger geometry for one explicit selection.
 * WHY: Pointer release must persist the same target ids used throughout the gesture.
 */
import { state, type SelectionState } from '../../state.js';
import { commitActiveLedgerMutation } from './commit-active-ledger-mutation.js';
import { geometryRevisionSnapshot, selectedLedgerGeometryPayload } from '../helper/active-ledger-geometry.js';

export async function commitSelectedLedgerGeometry(selection: Partial<SelectionState> = state.selection): Promise<boolean> {
  // WHAT: Skip static canvases that have no active ledger mutation endpoint.
  // WHY: Their geometry is persisted through the local runtime state path.
  if (!state.activeLedger) return false;
  const geometry = selectedLedgerGeometryPayload(selection);
  const hasGeometry = Object.values(geometry).some((records) => Object.keys(records).length > 0);
  // WHAT: Avoid an empty mutation when every selected id disappeared from the ledger.
  // WHY: A no-op request would trigger unnecessary refresh and rendering work.
  if (!hasGeometry) return false;
  const submittedGeometryRevisions = geometryRevisionSnapshot(geometry);
  return commitActiveLedgerMutation(
    { action: 'patch-geometry', geometry },
    { render: true, submittedGeometryRevisions }
  );
}
