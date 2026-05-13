import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { confirmZoneDeletionController } from '../../zone/controller/confirm-zone-deletion-controller.js';
import { deleteZoneController } from '../../zone/controller/delete-zone-controller.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resetActiveTool } from '../../toolbox/controller/reset-active-tool.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function handleKeyboard(event: KeyboardEvent): Promise<void> {
  const key = event.key.toLowerCase();
  telemetry('keyboard-shortcut', { key, ctrlKey: event.ctrlKey });
  if (key === 'escape') {
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    resetActiveTool('escape');
    telemetry('clear-transient-selection', { reason: 'escape' });
    renderCanvasSurface();
  }
  if (key === 'delete' && state.selection.zoneIds.length > 0) {
    confirmZoneDeletionController();
  }
  if (event.ctrlKey && key === 'c') {
    state.clipboard = structuredClone(state.selection);
    telemetry('copy-selection-payload', state.clipboard);
  }
  if (event.ctrlKey && key === 'v' && state.clipboard) {
    telemetry('commit-ledger-edit', { paste: state.clipboard });
    telemetry('render-canvas-surface', { reason: 'paste' });
  }
  if (modal.open && key === 'enter') await deleteZoneController();
  if (modal.open && key === 'escape') modal.close?.();
}
