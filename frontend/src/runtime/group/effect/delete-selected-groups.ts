import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteSelectedGroups(input: { groupIds?: string[] } = {}): Promise<void> {
  const groupIds = input.groupIds?.length ? [...input.groupIds] : [...state.selection.groupIds];
  if (!groupIds.length) return;
  if (state.activeLedger) {
    if (state.canvasMode === 'ledger') {
      const previousSelection = structuredClone(state.selection);
      state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
      modal.close?.();
      await runOptimisticActiveLedgerMutation({
        mutation: { action: 'delete-zones', zoneIds: [], groupIds },
        apply: (ledger) => {
          const deleted = new Set(groupIds);
          ledger.annotations = (ledger.annotations ?? []).filter((entry: Record<string, unknown>) => entry.variant !== 'group' || !deleted.has(String(entry.id ?? '')));
        },
        render: (outcome) => {
          if (outcome === 'rejected') state.selection = previousSelection;
          refreshZoneAttributionCache(`optimistic-delete-groups:${outcome}`);
          renderCanvasSurface();
        },
      });
      return;
    }
    const committed = await commitActiveLedgerMutation({ action: 'delete-zones', zoneIds: [], groupIds });
    if (!committed) return;
  } else {
    groupIds.forEach((id: string) => document.querySelector(`[data-group-id="${id}"]`)?.remove());
    telemetry('commit-static-surface-edit', { deleteGroups: groupIds, activeTab: state.activeTab, preserveContents: true });
  }
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  modal.close?.();
  renderCanvasSurface();
}
