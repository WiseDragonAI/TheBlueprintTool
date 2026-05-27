import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function deleteSelectedGroups(input: { groupIds?: string[] } = {}): Promise<void> {
  const groupIds = input.groupIds?.length ? [...input.groupIds] : [...state.selection.groupIds];
  if (!groupIds.length) return;
  if (state.activeLedger) {
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
