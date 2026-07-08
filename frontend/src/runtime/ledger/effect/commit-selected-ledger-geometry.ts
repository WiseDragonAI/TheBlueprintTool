import { state } from '../../state.js';
import { commitActiveLedgerMutation } from './commit-active-ledger-mutation.js';
import { selectedLedgerGeometryPayload } from '../helper/active-ledger-geometry.js';

export async function commitSelectedLedgerGeometry(): Promise<boolean> {
  if (!state.activeLedger) return false;
  const geometry = selectedLedgerGeometryPayload();
  const hasGeometry = Object.values(geometry).some((records) => Object.keys(records).length > 0);
  if (!hasGeometry) return false;
  return commitActiveLedgerMutation({ action: 'patch-geometry', geometry }, { render: true });
}
