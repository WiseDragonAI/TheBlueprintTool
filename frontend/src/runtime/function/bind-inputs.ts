import { canvas } from '../dom.js';
import { state } from '../state.js';
import { finishPointer } from './finish-pointer.js';
import { handleActionClick } from './handle-action-click.js';
import { handleKeyboard } from './handle-keyboard.js';
import { handlePointerDown } from './handle-pointer-down.js';
import { handlePointerMove } from './handle-pointer-move.js';
import { handlePointerUp } from './handle-pointer-up.js';
import { handleNativeDragStart } from './handle-native-drag-start.js';
import { handleWheel } from './handle-wheel.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { renderTabRegistry } from './render-tab-registry.js';
import { renderToolbox } from './render-toolbox.js';
import { routeTab } from './route-tab.js';
import { telemetry } from './telemetry.js';

export function bindInputs(): void {
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTool = (button as HTMLElement).dataset.tool;
      if (state.activeTool === 'zone') state.zoneColor = '#55b8ff';
      if (state.activeTool === 'thread' && !state.threadId) state.threadId = 'conversation-ledger';
      telemetry('tool-button-click', { tool: state.activeTool });
      telemetry('resolve-tool-mode', { activeTool: state.activeTool });
      renderToolbox();
      renderCanvasSurface();
    });
  });

  document.querySelector('[data-action="zone-color"]')?.addEventListener('input', (event) => {
    state.zoneColor = (event.target as HTMLInputElement).value;
    telemetry('resolve-tool-mode', { activeTool: 'zone', zoneColor: state.zoneColor });
  });

  document.querySelector('.tabs')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (!button?.dataset.tab) return;
    state.activeTab = button.dataset.tab;
    history.pushState({}, '', `/${state.activeTab}`);
    telemetry('browser-route-change', { activeTab: state.activeTab });
    telemetry('derive-route-state', { activeTab: state.activeTab });
    renderTabRegistry();
    renderCanvasSurface();
  });

  canvas.addEventListener('wheel', handleWheel, { passive: false, capture: true });
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('dragstart', handleNativeDragStart);
  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('click', handleActionClick);
  window.addEventListener('popstate', () => {
    state.activeTab = routeTab(window.location.pathname);
    telemetry('browser-route-change', { activeTab: state.activeTab });
    renderTabRegistry();
  });
}
