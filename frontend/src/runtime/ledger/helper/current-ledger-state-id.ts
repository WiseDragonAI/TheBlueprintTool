/**
 * WHAT: Resolves the runtime identity of the currently visible ledger canvas.
 * WHY: Pointer snapshots must be restored only into the ledger that created them.
 */
import { state } from '../../state.js';

export function currentLedgerStateId(): string {
  return String(state.activeLedgerId || (state.canvasMode === 'ledgers' ? 'ledgers-canvas' : state.activeTab || ''));
}
