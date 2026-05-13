import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { removeActiveLedgerZones } from '../../ledger/effect/remove-active-ledger-zones.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function deleteSelectedZones(): void {
  const zoneIds = [...state.selection.zoneIds];
  zoneIds.forEach((id: string) => document.querySelector(`[data-zone-id="${id}"]`)?.remove());
  removeActiveLedgerZones(zoneIds);
  telemetry('commit-ledger-edit', { deleteZones: zoneIds, activeTab: state.activeTab, preserveCards: true });
  state.selection.zoneIds = [];
  modal.close?.();
  renderCanvasSurface();
}
