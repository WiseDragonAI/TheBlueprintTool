import { state } from '../../state.js';
import { renderCardZoneColors } from '../../card/effect/render-card-zone-colors.js';
import { renderLedgerSurface } from '../../ledger/effect/render-ledger-surface.js';
import { renderRelationshipLabelVisibility } from '../../relationship/effect/render-relationship-label-visibility.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { renderZoneLabelOverlay } from '../../zone/effect/render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { applyViewportTransform } from './apply-viewport-transform.js';

export function renderCanvasSurface(): void {
  renderLedgerSurface();
  applyViewportTransform();
  renderSelectionState();
  renderCardZoneColors();
  renderZoneLabelOverlay();
  renderRelationshipOverlay();
  renderRelationshipLabelVisibility();
  telemetry('render-canvas-surface', { viewport: state.viewport, selection: state.selection });
  renderTelemetry();
  renderThreadPanel();
}
