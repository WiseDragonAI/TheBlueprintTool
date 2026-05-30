/**
 * WHAT: Subscribes to backend card-content file change events.
 * WHY: direct Markdown file patches must refresh rendered card content without disturbing active voice recording.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

let subscribed = false;
let refreshInFlight = false;

async function reloadLedgerContent(reason: string): Promise<void> {
  if (refreshInFlight) {
    state.pendingLedgerContentRefresh = true;
    return;
  }
  refreshInFlight = true;
  try {
    await loadActiveLedgerState();
    renderCanvasSurface();
    telemetry('ledger-content-refresh', { reason });
  } finally {
    refreshInFlight = false;
  }
}

export function requestLedgerContentRefresh(reason = 'card-content-change'): void {
  if (state.voice?.recording) {
    state.pendingLedgerContentRefresh = true;
    telemetry('ledger-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  state.pendingLedgerContentRefresh = false;
  void reloadLedgerContent(reason);
}

export function flushPendingLedgerContentRefresh(reason = 'voice-recording-stopped'): void {
  if (!state.pendingLedgerContentRefresh || state.voice?.recording) return;
  state.pendingLedgerContentRefresh = false;
  void reloadLedgerContent(reason);
}

export function subscribeLedgerContentEvents(): void {
  if (subscribed || typeof EventSource === 'undefined') return;
  subscribed = true;
  const events = new EventSource('/api/ledger-content-events');
  events.addEventListener('card-content-change', () => {
    requestLedgerContentRefresh('card-content-change');
  });
  events.onerror = () => {
    telemetry('ledger-content-refresh-stream-error', {});
  };
  state.ledgerContentEventSource = events;
  telemetry('subscribe-ledger-content-events', {});
}
