import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { commitActiveLedgerZoneMutation } from '../../ledger/effect/commit-active-ledger-zone-mutation.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteSelectedZones(): Promise<void> {
  const zoneIds = [...state.selection.zoneIds];
  if (state.activeLedger) {
    const committed = await commitActiveLedgerZoneMutation({ action: 'delete-zones', zoneIds });
    if (!committed) return;
  } else {
    zoneIds.forEach((id: string) => document.querySelector(`[data-zone-id="${id}"]`)?.remove());
    telemetry('commit-ledger-edit', { deleteZones: zoneIds, activeTab: state.activeTab, preserveCards: true });
  }
  state.selection.zoneIds = [];
  modal.close?.();
  renderCanvasSurface();
}
