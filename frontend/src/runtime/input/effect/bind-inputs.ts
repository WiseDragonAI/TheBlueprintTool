import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { finishPointer } from '../../gesture/effect/finish-pointer.js';
import { handleActionClick } from '../controller/handle-action-click.js';
import { handleCardDoubleClick } from '../controller/handle-card-double-click.js';
import { handleRegionColorChange, handleRegionColorInput } from '../controller/handle-region-color-input.js';
import { handleKeyboard } from '../controller/handle-keyboard.js';
import { handlePointerDown } from '../../gesture/controller/handle-pointer-down.js';
import { handlePointerMove } from '../../gesture/controller/handle-pointer-move.js';
import { handlePointerUp } from '../../gesture/controller/handle-pointer-up.js';
import { handleNativeDragStart } from '../../gesture/controller/handle-native-drag-start.js';
import { handleWheel } from '../../gesture/controller/handle-wheel.js';
import { ledgerEndpointForTab } from '../../ledger/helper/ledger-endpoint-for-tab.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { renderTabRegistry } from '../../navigation/effect/render-tab-registry.js';
import { renderToolbox } from '../../toolbox/effect/render-toolbox.js';
import { openThreadPanel } from '../../thread/effect/open-thread-panel.js';
import { saveThreadDraft } from '../../thread/effect/persist-thread-draft.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { routeTab } from '../../navigation/helper/route-tab.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function bindInputs(): void {
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTool = (button as HTMLElement).dataset.tool;
      if (state.activeTool === 'thread' && !state.threadId) selectThread('conversation-ledger');
      telemetry('tool-button-click', { tool: state.activeTool });
      telemetry('resolve-tool-mode', { activeTool: state.activeTool });
      renderToolbox();
      if (state.activeTool === 'thread') openThreadPanel();
      renderCanvasSurface();
    });
  });

  document.querySelector('[data-action="zone-color"]')?.addEventListener('input', (event) => {
    state.zoneColor = (event.target as HTMLInputElement).value;
    telemetry('resolve-tool-mode', { activeTool: 'zone', zoneColor: state.zoneColor });
  });

  document.querySelector('.tabs')?.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (!button?.dataset.tab) return;
    state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
    persistState();
    state.activeTab = button.dataset.tab;
    history.pushState({}, '', `/${state.activeTab}`);
    telemetry('browser-route-change', { activeTab: state.activeTab });
    telemetry('derive-route-state', { activeTab: state.activeTab });
    await loadActiveLedgerState();
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
  document.addEventListener('dblclick', handleCardDoubleClick);
  document.addEventListener('input', handleRegionColorInput);
  document.addEventListener('input', (event) => {
    if ((event.target as HTMLElement | null)?.closest('.thread-draft')) saveThreadDraft();
  });
  document.addEventListener('change', handleRegionColorChange);
  window.addEventListener('popstate', () => {
    state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
    persistState();
    state.activeTab = routeTab(window.location.pathname);
    telemetry('browser-route-change', { activeTab: state.activeTab });
    void loadActiveLedgerState().then(renderCanvasSurface);
    renderTabRegistry();
  });
}
