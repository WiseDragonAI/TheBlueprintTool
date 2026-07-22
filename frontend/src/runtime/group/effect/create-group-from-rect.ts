/**
 * WHAT: Creates a group annotation from a drawn rectangle in active-ledger or standalone DOM mode.
 * WHY: Draw gestures need immediate local feedback while active-ledger persistence reconciles asynchronously.
 */
import { content } from '../../dom.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { createLedgerGroupAnnotation } from '../../ledger/helper/create-ledger-group-annotation.js';
import { createLedgerObjectId } from '../../ledger/helper/create-ledger-object-id.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { insertActiveLedgerAnnotation } from '../../ledger/helper/active-ledger-geometry.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';

export async function createGroupFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const groupId = createLedgerObjectId('group');
  // WHAT: Insert and render the group immediately when ledger state owns the canvas.
  // WHY: The operator should not wait for a server round trip before seeing the drawn record.
  if (state.activeLedger && state.canvasMode === 'ledger') {
    const annotation = createLedgerGroupAnnotation({ id: groupId, rect });
    const previousSelection = structuredClone(state.selection);
    state.selection = { cardIds: [], zoneIds: [], groupIds: [groupId] };
    await runOptimisticActiveLedgerMutation({
      mutation: { action: 'create-group', annotation },
      apply: (ledger) => {
        ledger.annotations = (ledger.annotations ?? []).filter((entry: Record<string, unknown>) => String(entry.id ?? '') !== groupId).concat(structuredClone(annotation));
      },
      render: (outcome) => {
        if (outcome === 'rejected') state.selection = previousSelection;
        refreshZoneAttributionCache(`optimistic-create-group:${outcome}`);
        telemetry('render-group-layer', { created: groupId, authority: 'optimistic-client', outcome });
        renderCanvasSurface({ renderThreadPanel: false });
      },
    });
    return;
  }
  if (state.activeLedger) {
    const annotation = createLedgerGroupAnnotation({ id: groupId, rect });
    insertActiveLedgerAnnotation(annotation);
    await commitActiveLedgerMutation({ action: 'create-group', annotation }, { render: true });
    return;
  }
  const group = document.createElement('article');
  group.className = 'zone group-zone selected';
  group.dataset.groupId = groupId;
  group.dataset.threadId = `thread-${groupId}`;
  group.dataset.spec = '1d444573 796827d0 4801e6c7 85c81d67 0421d906 dff19657 d9d57c2c 2476bfa1 d2fbfa28 612afeda 8a05ef46 5b918cd3 d4f90f42 abad6dcb f18da923 c271a0df';
  group.style.left = `${Math.max(0, rect.x)}px`;
  group.style.top = `${Math.max(0, rect.y)}px`;
  group.style.width = `${Math.max(220, rect.width)}px`;
  group.style.height = `${Math.max(160, rect.height)}px`;
  group.innerHTML = '<div class="resize-handle nw"></div><div class="resize-handle ne"></div><div class="resize-handle sw"></div><div class="resize-handle se"></div><div class="zone-title">New group</div>';
  content.insertBefore(group, content.querySelector('.marquee'));
  state.selection = { cardIds: [], zoneIds: [], groupIds: [groupId] };
  telemetry('commit-static-surface-edit', { createGroup: groupId, geometry: rect });
  telemetry('render-group-layer', { created: groupId });
}
