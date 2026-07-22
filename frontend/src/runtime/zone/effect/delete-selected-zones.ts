import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteSelectedZones(): Promise<void> {
  const zoneIds = [...state.selection.zoneIds];
  if (state.activeLedger) {
    if (state.canvasMode === 'ledger') {
      const previousSelection = structuredClone(state.selection);
      state.selection.zoneIds = [];
      modal.close?.();
      await runOptimisticActiveLedgerMutation({
        mutation: { action: 'delete-zones', zoneIds },
        apply: (ledger) => {
          const deleted = new Set(zoneIds);
          ledger.annotations = (ledger.annotations ?? []).filter((entry: Record<string, unknown>) => entry.variant === 'group' || !deleted.has(String(entry.id ?? '')));
        },
        render: (outcome) => {
          if (outcome === 'rejected') state.selection = previousSelection;
          refreshZoneAttributionCache(`optimistic-delete-zones:${outcome}`);
          renderCanvasSurface();
        },
      });
      return;
    }
    const committed = await commitActiveLedgerMutation({ action: 'delete-zones', zoneIds });
    if (!committed) return;
  } else {
    zoneIds.forEach((id: string) => document.querySelector(`[data-zone-id="${id}"]`)?.remove());
    telemetry('commit-static-surface-edit', { deleteZones: zoneIds, activeTab: state.activeTab, preserveCards: true });
  }
  state.selection.zoneIds = [];
  modal.close?.();
  renderCanvasSurface();
}
