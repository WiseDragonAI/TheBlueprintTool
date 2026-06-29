/**
 * WHAT: Opens a real ledger from the parent ledgers canvas.
 * WHY: Overview zoom-in navigation should land at canonical min-scale centered framing.
 */
import { canvas } from '../../dom.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { mergeLocalThreadNotes } from '../../ledger/helper/merge-local-thread-notes.js';
import { minScaleCenteredLedgerViewport } from '../../ledger/helper/min-scale-centered-ledger-viewport.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { activeLedgers } from '../../ledger/helper/active-ledgers.js';
import { renderTabRegistry } from '../effect/render-tab-registry.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export async function enterLedgerController(ledgerId: string, options: { replace?: boolean; canonicalMinScale?: boolean } = {}): Promise<void> {
  if (!activeLedgers().some((ledger) => ledger.id === ledgerId)) return;
  const response = await fetch(`/decision-os/${ledgerId}`).catch(() => undefined);
  if (!response?.ok) return;
  const ledger = await response.json().catch(() => null);
  state.canvasMode = 'ledger';
  state.activeTab = ledgerId;
  state.activeLedgerId = ledgerId;
  state.activeLedger = mergeLocalThreadNotes(ledger);
  refreshZoneAttributionCache('enter-ledger-controller');
  if (options.canonicalMinScale !== false) {
    const rect = canvas?.getBoundingClientRect?.() ?? { width: window.innerWidth, height: window.innerHeight };
    const viewport = minScaleCenteredLedgerViewport({ ledger: state.activeLedger, canvasSize: { width: rect.width, height: rect.height }, scale: 0.03 });
    Object.assign(state.viewport, viewport);
    state.viewports = { ...(state.viewports ?? {}), [ledgerId]: { ...viewport } };
  } else {
    Object.assign(state.viewport, state.viewports?.[ledgerId] ?? ledger?.viewport ?? state.viewport);
  }
  state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  if (options.replace) history.replaceState?.({}, '', `/${ledgerId}`);
  else if (window.location.pathname !== `/${ledgerId}`) history.pushState?.({}, '', `/${ledgerId}`);
  canvas.classList.remove('ledgers-canvas-mode');
  renderTabRegistry();
  renderCanvasSurface();
  telemetry('enter-ledger-controller', { ledgerId, canonicalMinScale: options.canonicalMinScale !== false });
}
