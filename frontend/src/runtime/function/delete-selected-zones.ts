import { modal } from '../dom.js';
import { state } from '../state.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { telemetry } from './telemetry.js';

export function deleteSelectedZones(): void {
  state.selection.zoneIds.forEach((id: string) => document.querySelector(`[data-zone-id="${id}"]`)?.remove());
  telemetry('commit-ledger-edit', { deleteZones: state.selection.zoneIds, preserveCards: true });
  state.selection.zoneIds = [];
  modal.close?.();
  renderCanvasSurface();
}
