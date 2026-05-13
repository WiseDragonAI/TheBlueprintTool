import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function removeActiveLedgerZones(zoneIds: string[]): void {
  const ledger = state.activeLedger as { annotations?: Array<Record<string, unknown>> } | null;
  if (!ledger || zoneIds.length === 0) return;
  const ids = new Set(zoneIds);
  ledger.annotations = (ledger.annotations ?? []).filter((entry) => {
    if (entry.variant === 'group') return true;
    return !ids.has(String(entry.id ?? ''));
  });
  telemetry('sync-active-ledger-zone-delete', { activeTab: state.activeTab, zoneIds });
}
