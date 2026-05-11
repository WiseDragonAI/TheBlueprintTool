import { modal } from '../dom.js';
import { state } from '../state.js';
import { deleteSelectedZones } from './delete-selected-zones.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { telemetry } from './telemetry.js';

export function handleKeyboard(event: KeyboardEvent): void {
  const key = event.key.toLowerCase();
  telemetry('keyboard-shortcut', { key, ctrlKey: event.ctrlKey });
  if (key === 'escape') {
    state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
    telemetry('clear-transient-selection', { reason: 'escape' });
    renderCanvasSurface();
  }
  if (key === 'delete' && state.selection.zoneIds.length > 0) {
    telemetry('confirm-zone-deletion', { zoneIds: state.selection.zoneIds });
    modal.showModal?.();
  }
  if (event.ctrlKey && key === 'c') {
    state.clipboard = structuredClone(state.selection);
    telemetry('copy-selection-payload', state.clipboard);
  }
  if (event.ctrlKey && key === 'v' && state.clipboard) {
    telemetry('commit-ledger-edit', { paste: state.clipboard });
    telemetry('render-canvas-surface', { reason: 'paste' });
  }
  if (modal.open && key === 'enter') deleteSelectedZones();
  if (modal.open && key === 'escape') modal.close?.();
}
