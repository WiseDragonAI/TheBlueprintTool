/**
 * WHAT: Subscribes to backend card content file change events.
 * WHY: direct Markdown file patches must refresh rendered card content without disturbing active voice recording.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';

let subscribed = false;
let refreshInFlight = false;
let threadRefreshInFlight = false;

function contentEventKind(event: Event): string {
  const data = String((event as MessageEvent).data ?? '');
  try {
    const parsed = JSON.parse(data) as { kind?: unknown };
    return String(parsed.kind ?? '');
  } catch {
    return '';
  }
}

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

async function reloadThreadContent(reason: string): Promise<void> {
  if (threadRefreshInFlight) {
    state.pendingThreadContentRefresh = true;
    return;
  }
  threadRefreshInFlight = true;
  const selection = state.selection;
  try {
    await loadActiveLedgerState();
    state.selection = selection;
    renderThreadPanel();
    telemetry('thread-content-refresh', { reason });
  } finally {
    threadRefreshInFlight = false;
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

export function requestThreadContentRefresh(reason = 'thread-content-change'): void {
  if (state.voice?.recording) {
    state.pendingThreadContentRefresh = true;
    telemetry('thread-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  state.pendingThreadContentRefresh = false;
  void reloadThreadContent(reason);
}

export function flushPendingLedgerContentRefresh(reason = 'voice-recording-stopped'): void {
  if (state.voice?.recording) return;
  if (state.pendingLedgerContentRefresh) {
    state.pendingLedgerContentRefresh = false;
    void reloadLedgerContent(reason);
  }
  if (state.pendingThreadContentRefresh) {
    state.pendingThreadContentRefresh = false;
    void reloadThreadContent(reason);
  }
}

export function subscribeLedgerContentEvents(): void {
  if (subscribed || typeof EventSource === 'undefined') return;
  subscribed = true;
  const events = new EventSource('/api/ledger-content-events');
  events.addEventListener('card-content-change', (event) => {
    if (contentEventKind(event) === 'thread-content') {
      requestThreadContentRefresh('thread-content-change');
      return;
    }
    requestLedgerContentRefresh('card-content-change');
  });
  events.addEventListener('ledger-content-change', () => {
    requestLedgerContentRefresh('ledger-content-change');
  });
  events.onerror = () => {
    telemetry('ledger-content-refresh-stream-error', {});
  };
  state.ledgerContentEventSource = events;
  telemetry('subscribe-ledger-content-events', {});
}
