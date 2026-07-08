/**
 * WHAT: Subscribes to backend card content file change events.
 * WHY: direct Markdown file patches must refresh rendered card content without disturbing active voice recording.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resizeSelectedCardsToContent } from '../../card/effect/resize-selected-cards-to-content.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';

let subscribed = false;
let refreshInFlight = false;
let threadRefreshInFlight = false;

type ContentChangeEvent = {
  contentFile?: string;
  kind?: string;
};

type LedgerRefreshOptions = {
  contentFile?: string;
};

function contentEventPayload(event: Event): ContentChangeEvent {
  const data = String((event as MessageEvent).data ?? '');
  try {
    const parsed = JSON.parse(data) as { contentFile?: unknown; kind?: unknown };
    return {
      contentFile: typeof parsed.contentFile === 'string' ? parsed.contentFile : '',
      kind: typeof parsed.kind === 'string' ? parsed.kind : ''
    };
  } catch {
    return {};
  }
}

function normalizedContentFile(value: unknown): string {
  const file = String(value ?? '').trim().replace(/\\/g, '/');
  if (file.startsWith('/.decision-os/')) return file.slice(1);
  return file.replace(/^\.\/+/, '');
}

export function changedCardIdForContentFile(contentFile: string): string {
  const target = normalizedContentFile(contentFile);
  if (!target) return '';
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  for (const card of cards) {
    const comment = card.comment && typeof card.comment === 'object' ? card.comment as Record<string, unknown> : {};
    if (normalizedContentFile(comment.contentFile) === target) return String(card.id ?? '');
  }
  return '';
}

async function resizeChangedCardToContent(contentFile: string): Promise<void> {
  const cardId = changedCardIdForContentFile(contentFile);
  if (!cardId) {
    telemetry('ledger-content-refresh-resize-skipped', { reason: 'card-not-found', contentFile });
    return;
  }
  const geometry = resizeSelectedCardsToContent({ cardIds: [cardId], zoneIds: [] });
  if (Object.keys(geometry.cards).length === 0 && Object.keys(geometry.zones).length === 0) {
    telemetry('ledger-content-refresh-resize-skipped', { reason: 'empty-geometry', contentFile, cardId });
    return;
  }

  persistState();
  const committed = state.activeLedger
    ? await commitActiveLedgerMutation({ action: 'patch-geometry', geometry }, { render: true })
    : false;
  telemetry('ledger-content-refresh-resize', { contentFile, cardId, committed });
}

async function reloadLedgerContent(reason: string, options: LedgerRefreshOptions = {}): Promise<void> {
  if (refreshInFlight) {
    state.pendingLedgerContentRefresh = true;
    return;
  }
  refreshInFlight = true;
  try {
    await loadActiveLedgerState();
    renderCanvasSurface();
    if (options.contentFile) await resizeChangedCardToContent(options.contentFile);
    telemetry('ledger-content-refresh', { reason, contentFile: options.contentFile ?? '' });
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

export function requestLedgerContentRefresh(reason = 'card-content-change', options: LedgerRefreshOptions = {}): void {
  if (state.voice?.recording) {
    state.pendingLedgerContentRefresh = true;
    telemetry('ledger-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  state.pendingLedgerContentRefresh = false;
  void reloadLedgerContent(reason, options);
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
    const payload = contentEventPayload(event);
    if (payload.kind === 'thread-content') {
      requestThreadContentRefresh('thread-content-change');
      return;
    }
    requestLedgerContentRefresh('card-content-change', { contentFile: payload.contentFile });
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
