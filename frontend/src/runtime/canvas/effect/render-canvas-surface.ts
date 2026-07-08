import { state } from '../../state.js';
import { canvas } from '../../dom.js';
import { renderCardZoneColors } from '../../card/effect/render-card-zone-colors.js';
import { renderLedgerSurface } from '../../ledger/effect/render-ledger-surface.js';
import { renderRelationshipLabelVisibility } from '../../relationship/effect/render-relationship-label-visibility.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderCanvasDebugOverlay } from '../../debug/effect/render-canvas-debug-overlay.js';
import { applyViewportTransform } from './apply-viewport-transform.js';
import { renderCanvasControlOverlay } from './render-canvas-control-overlay.js';
import { renderLedgersIndicator } from './render-ledgers-indicator.js';

export function renderCanvasSurface(options: { renderThreadPanel?: boolean } = {}): void {
  canvas.classList.toggle('ledgers-canvas-mode', state.canvasMode === 'ledgers');
  renderLedgerSurface();
  applyViewportTransform();
  renderSelectionState();
  if (!state.activeLedger) renderCardZoneColors();
  renderZoneLabelOverlay();
  renderRelationshipOverlay();
  renderRelationshipLabelVisibility();
  renderCanvasControlOverlay();
  renderLedgersIndicator();
  telemetry('render-canvas-surface', { viewport: state.viewport, selection: state.selection });
  renderTelemetry();
  if (options.renderThreadPanel !== false) renderThreadPanel();
  renderCanvasDebugOverlay('surface');
}
