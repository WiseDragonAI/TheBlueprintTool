import { canvas } from '../dom.js';
import { state } from '../state.js';
import { renderRelationshipOverlay } from './render-relationship-overlay.js';
import { renderTelemetry } from './render-telemetry.js';
import { renderThreadPanel } from './render-thread-panel.js';
import { telemetry } from './telemetry.js';

export function renderCanvasSurface(): void {
  canvas.style.setProperty('--viewport-scale', String(state.viewport.scale));
  canvas.style.setProperty('--canvas-bg-x', `${state.viewport.x}px`);
  canvas.style.setProperty('--canvas-bg-y', `${state.viewport.y}px`);
  (document.querySelector('.canvas-content') as HTMLElement).style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  document.querySelectorAll('[data-card-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.cardIds.includes(element.dataset.cardId));
    element.classList.toggle('connected', state.selection.cardIds.includes('card-boot') && element.dataset.cardId === 'card-zone');
  });
  document.querySelectorAll('[data-zone-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.zoneIds.includes(element.dataset.zoneId));
  });
  document.querySelectorAll('[data-group-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.classList.toggle('selected', state.selection.groupIds.includes(element.dataset.groupId));
  });
  renderRelationshipOverlay();
  document.querySelector('.relationships')?.classList.toggle('hide-labels', state.activeTab === 'runtime');
  telemetry('render-canvas-surface', { viewport: state.viewport, selection: state.selection });
  renderTelemetry();
  renderThreadPanel();
}
