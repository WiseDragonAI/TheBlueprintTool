import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function addActiveLedgerZone(annotation: Record<string, unknown>): void {
  const ledger = state.activeLedger as { annotations?: Array<Record<string, unknown>> } | null;
  if (!ledger) return;
  const id = String(annotation.id ?? '');
  const annotations = ledger.annotations ?? [];
  ledger.annotations = annotations.filter((entry) => String(entry.id ?? '') !== id).concat(annotation);
  telemetry('sync-active-ledger-zone-create', { activeTab: state.activeTab, id });
}
