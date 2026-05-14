import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function pasteSelectionController(): Promise<void> {
  if (!state.clipboard) return;
  telemetry('paste-selection-controller', state.clipboard);
  await commitActiveLedgerMutation({ action: 'paste-selection', selection: state.clipboard }, { render: true });
}
