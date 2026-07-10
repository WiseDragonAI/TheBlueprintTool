/**
 * WHAT: Owns the accumulating ledger and thread refresh queue lifecycle.
 * WHY: Refresh branching, deferral, draining, and recovery belong in one controller outside the SSE transport effect.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { resizeSelectedCardsToContent } from '../../card/effect/resize-selected-cards-to-content.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { loadActiveLedgerState } from '../../ledger/effect/load-active-ledger-state.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import {
  state,
  type LedgerContentRefreshState,
  type ThreadContentRefreshScope
} from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import {
  activeThreadContentScope,
  isActiveThreadContentScope,
  loadActiveThreadSlice,
  normalizeContentFileReference
} from '../../thread/effect/load-active-thread-slice.js';
import { changedCardIdForContentFile } from '../helper/changed-card-id-for-content-file.js';

type LedgerRefreshOptions = {
  contentFile?: string;
};

type RefreshBatch = {
  ledgerReasons: string[];
  changedContentFiles: string[];
  threadReasons: string[];
  threadScope: ThreadContentRefreshScope | null;
};

function contentRefreshState(): LedgerContentRefreshState {
  const existing = state.ledgerContentRefresh as LedgerContentRefreshState | undefined;
  // WHAT: Reuse a complete persisted refresh queue shape.
  // WHY: Runtime restoration may already have initialized pending refresh state.
  if (existing && Array.isArray(existing.ledgerReasons) && Array.isArray(existing.changedContentFiles) && Array.isArray(existing.threadReasons)) {
    return existing;
  }
  state.ledgerContentRefresh = {
    inFlight: false,
    ledgerReasons: [],
    changedContentFiles: [],
    threadReasons: [],
    threadScope: null
  } satisfies LedgerContentRefreshState;
  return state.ledgerContentRefresh as LedgerContentRefreshState;
}

function addUnique(values: string[], value: string): void {
  const normalized = String(value ?? '').trim();
  // WHAT: Accumulate each non-empty reason or file once per drain.
  // WHY: Repeated SSE notifications should not duplicate work or telemetry.
  if (normalized && !values.includes(normalized)) values.push(normalized);
}

function hasQueuedRefresh(refresh = contentRefreshState()): boolean {
  return refresh.ledgerReasons.length > 0
    || refresh.changedContentFiles.length > 0
    || refresh.threadReasons.length > 0
    || Boolean(refresh.threadScope);
}

function syncPendingRefreshFlags(refresh = contentRefreshState()): void {
  state.pendingLedgerContentRefresh = refresh.ledgerReasons.length > 0 || refresh.changedContentFiles.length > 0;
  state.pendingThreadContentRefresh = refresh.threadReasons.length > 0 || Boolean(refresh.threadScope);
}

function enqueueLedgerRefresh(reason: string, options: LedgerRefreshOptions): void {
  const refresh = contentRefreshState();
  addUnique(refresh.ledgerReasons, reason || 'ledger-content-change');
  // WHAT: Track changed card files independently from refresh reasons.
  // WHY: One ledger load can resize every card file accumulated while it was in flight.
  if (options.contentFile) addUnique(refresh.changedContentFiles, normalizeContentFileReference(options.contentFile));
  syncPendingRefreshFlags(refresh);
}

function enqueueThreadRefresh(reason: string, scope: ThreadContentRefreshScope): void {
  const refresh = contentRefreshState();
  addUnique(refresh.threadReasons, reason || 'thread-content-change');
  refresh.threadScope = { ...scope, contentFile: normalizeContentFileReference(scope.contentFile) };
  syncPendingRefreshFlags(refresh);
}

function takeRefreshBatch(refresh: LedgerContentRefreshState): RefreshBatch {
  const batch: RefreshBatch = {
    ledgerReasons: [...refresh.ledgerReasons],
    changedContentFiles: [...refresh.changedContentFiles],
    threadReasons: [...refresh.threadReasons],
    threadScope: refresh.threadScope ? { ...refresh.threadScope } : null
  };
  refresh.ledgerReasons = [];
  refresh.changedContentFiles = [];
  refresh.threadReasons = [];
  refresh.threadScope = null;
  syncPendingRefreshFlags(refresh);
  return batch;
}

async function resizeChangedCardToContent(contentFile: string): Promise<void> {
  const cardId = changedCardIdForContentFile(contentFile);
  // WHAT: Skip geometry work when the refreshed ledger has no exact content-file owner.
  // WHY: A stale file event must not resize a different card.
  if (!cardId) {
    telemetry('ledger-content-refresh-resize-skipped', { reason: 'card-not-found', contentFile });
    return;
  }
  const geometry = resizeSelectedCardsToContent({ cardIds: [cardId], zoneIds: [] });
  // WHAT: Avoid persistence and mutation when DOM measurement produced no geometry.
  // WHY: Missing rendered card detail is an expected no-op during route transitions.
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

async function reloadLedgerContent(batch: Pick<RefreshBatch, 'ledgerReasons' | 'changedContentFiles'>): Promise<void> {
  const applied = await loadActiveLedgerState();
  // WHAT: Render and resize only after the authoritative response wins reconciliation.
  // WHY: Rejected stale responses must not trigger DOM or geometry side effects.
  if (applied) {
    renderCanvasSurface();
    for (const contentFile of batch.changedContentFiles) await resizeChangedCardToContent(contentFile);
  }
  telemetry('ledger-content-refresh', {
    reasons: batch.ledgerReasons,
    changedContentFiles: batch.changedContentFiles,
    applied
  });
}

async function reloadThreadContent(batch: Pick<RefreshBatch, 'threadReasons' | 'threadScope'>): Promise<void> {
  // WHAT: Ignore a ledger-only batch at the thread slice boundary.
  // WHY: Whole-ledger events do not carry an owned thread scope.
  if (!batch.threadScope) return;
  const applied = await loadActiveThreadSlice(batch.threadScope);
  telemetry('thread-content-refresh', { reasons: batch.threadReasons, ...batch.threadScope, applied });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'unknown error');
}

async function drainPendingLedgerContentRefresh(): Promise<void> {
  const refresh = contentRefreshState();
  // WHAT: Keep one drain owner and defer all work during active voice capture.
  // WHY: Parallel drains lose queue ordering, while voice capture requires stable thread controls.
  if (refresh.inFlight || state.voice?.recording || !hasQueuedRefresh(refresh)) return;
  refresh.inFlight = true;
  try {
    while (!state.voice?.recording && hasQueuedRefresh(refresh)) {
      const batch = takeRefreshBatch(refresh);
      // WHAT: Reload the ledger once for every accumulated ledger/file batch.
      // WHY: Changed files share the same authoritative ledger response.
      if (batch.ledgerReasons.length > 0 || batch.changedContentFiles.length > 0) {
        try {
          await reloadLedgerContent(batch);
        } catch (error) {
          // WHAT: Record a failed ledger refresh and continue draining newer queued work.
          // WHY: One transient request failure must not strand later SSE events.
          telemetry('ledger-content-refresh-failed', { reasons: batch.ledgerReasons, error: errorMessage(error) });
        }
      }
      // WHAT: Apply a thread refresh only when the batch has an exact active-thread scope.
      // WHY: Thread content is intentionally independent from whole-ledger replacement.
      if (batch.threadScope) {
        // WHAT: Requeue the owned thread batch if voice capture starts during the ledger await.
        // WHY: Same-thread controls and capture state must remain untouched until recording stops.
        if (state.voice?.recording) {
          for (const reason of batch.threadReasons) addUnique(refresh.threadReasons, reason);
          refresh.threadScope = batch.threadScope;
          syncPendingRefreshFlags(refresh);
        } else {
          try {
            await reloadThreadContent(batch);
          } catch (error) {
            // WHAT: Record a failed thread refresh and leave the drain available for newer work.
            // WHY: A transient slice request must not deadlock the shared queue.
            telemetry('thread-content-refresh-failed', { reasons: batch.threadReasons, error: errorMessage(error) });
          }
        }
      }
    }
  } finally {
    refresh.inFlight = false;
    syncPendingRefreshFlags(refresh);
    // WHAT: Restart the drain when work arrived after the loop's final queue check.
    // WHY: Event delivery can race the async settlement boundary without starting a second in-flight drain.
    if (!state.voice?.recording && hasQueuedRefresh(refresh)) void drainPendingLedgerContentRefresh();
  }
}

export function requestLedgerContentRefresh(reason = 'card-content-change', options: LedgerRefreshOptions = {}): void {
  enqueueLedgerRefresh(reason, options);
  // WHAT: Retain the queued batch during voice capture.
  // WHY: The stop-voice controller owns the explicit flush boundary.
  if (state.voice?.recording) {
    telemetry('ledger-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  void drainPendingLedgerContentRefresh();
}

export function requestThreadContentRefresh(
  reason = 'thread-content-change',
  scope: ThreadContentRefreshScope | null = activeThreadContentScope()
): void {
  // WHAT: Reject absent or stale thread scopes before enqueueing.
  // WHY: A later active thread must not consume an event owned by the previous thread.
  if (!scope || !isActiveThreadContentScope(scope)) {
    telemetry('thread-content-refresh-skipped', { reason: 'inactive-scope', refreshReason: reason });
    return;
  }
  enqueueThreadRefresh(reason, scope);
  // WHAT: Retain the scoped batch during voice capture.
  // WHY: Recording completion provides the safe refresh boundary.
  if (state.voice?.recording) {
    telemetry('thread-content-refresh-deferred', { reason, voiceRecording: true });
    return;
  }
  void drainPendingLedgerContentRefresh();
}

export function flushPendingLedgerContentRefresh(reason = 'voice-recording-stopped'): void {
  // WHAT: Ignore premature flush requests while capture still owns the thread UI.
  // WHY: Only the completed stop-voice path may resume deferred refresh work.
  if (state.voice?.recording) return;
  telemetry('ledger-content-refresh-flush', { reason, pending: hasQueuedRefresh() });
  void drainPendingLedgerContentRefresh();
}
