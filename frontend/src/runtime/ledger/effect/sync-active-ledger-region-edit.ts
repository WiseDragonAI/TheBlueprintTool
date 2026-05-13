import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

type RegionEdit = { label?: string; color?: string };

export function syncActiveLedgerRegionEdit(element: HTMLElement, edit: RegionEdit): void {
  const ledger = state.activeLedger as { annotations?: Array<Record<string, unknown>> } | null;
  if (!ledger) return;
  const annotationId = element.dataset.zoneId ?? element.dataset.groupId;
  const annotation = (ledger.annotations ?? []).find((entry) => String(entry.id ?? '') === annotationId);
  if (!annotation) return;
  if (typeof edit.label === 'string') annotation.label = edit.label;
  if (element.dataset.zoneId && typeof edit.color === 'string') annotation.color = edit.color;
  telemetry('sync-active-ledger-region-edit', { activeTab: state.activeTab, id: annotationId, edit });
}
