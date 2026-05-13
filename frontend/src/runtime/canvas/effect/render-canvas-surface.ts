import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { connectedCardIds } from '../../relationship/helper/connected-card-ids.js';
import { elementCanvasRect } from '../helper/element-canvas-rect.js';
import { rectanglesIntersect } from '../helper/rectangles-intersect.js';
import { renderLedgerSurface } from '../../ledger/effect/render-ledger-surface.js';
import { renderRelationshipOverlay } from '../../relationship/effect/render-relationship-overlay.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { updateDetailMode } from './update-detail-mode.js';

export function renderCanvasSurface(): void {
  renderLedgerSurface();
  canvas.style.setProperty('--viewport-scale', String(state.viewport.scale));
  updateDetailMode();
  (document.querySelector('.canvas-content') as HTMLElement).style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  const connectedIds = connectedCardIds(state.selection.cardIds);
  document.querySelectorAll('[data-card-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.cardIds.includes(element.dataset.cardId));
    element.classList.toggle('connected', connectedIds.includes(element.dataset.cardId ?? ''));
  });
  document.querySelectorAll('[data-zone-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.zoneIds.includes(element.dataset.zoneId));
  });
  document.querySelectorAll('[data-group-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.groupIds.includes(element.dataset.groupId));
  });
  const zones = Array.from(document.querySelectorAll('.regular-zone[data-zone-id]')) as HTMLElement[];
  for (const card of Array.from(document.querySelectorAll('[data-card-id]')) as HTMLElement[]) {
    card.style.removeProperty('--card-zone-color');
    const cardRect = elementCanvasRect(card);
    for (const zone of zones) {
      if (!rectanglesIntersect(cardRect, elementCanvasRect(zone))) continue;
      card.style.setProperty('--card-zone-color', getComputedStyle(zone).getPropertyValue('--zone-color').trim());
      break;
    }
  }
  renderRelationshipOverlay();
  document.querySelectorAll('.relationships').forEach((overlay) => overlay.classList.toggle('hide-labels', state.activeTab === 'runtime'));
  telemetry('render-canvas-surface', { viewport: state.viewport, selection: state.selection });
  renderTelemetry();
  renderThreadPanel();
}
