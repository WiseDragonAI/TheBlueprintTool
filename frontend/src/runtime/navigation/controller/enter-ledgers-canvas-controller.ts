/**
 * WHAT: Enters the `/ledgers` parent canvas mode.
 * WHY: Header, toolbox, wheel, and browser navigation should share one overview entry path.
 */
import { canvas } from '../../dom.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { renderTabRegistry } from '../effect/render-tab-registry.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function enterLedgersCanvasController(options: { replace?: boolean } = {}): Promise<void> {
  state.viewports = { ...(state.viewports ?? {}), [state.activeTab]: { ...state.viewport } };
  persistState();
  state.canvasMode = 'ledgers';
  if (options.replace) history.replaceState?.({}, '', '/ledgers');
  else if (window.location.pathname !== '/ledgers') history.pushState?.({}, '', '/ledgers');
  canvas.classList.add('ledgers-canvas-mode');
  await loadActiveLedgerState();
  renderTabRegistry();
  renderCanvasSurface();
  telemetry('enter-ledgers-canvas-controller', { activeTab: state.activeTab });
}
