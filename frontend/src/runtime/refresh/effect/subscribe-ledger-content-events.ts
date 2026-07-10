/**
 * WHAT: Subscribes to backend ledger and content-file change events.
 * WHY: The transport boundary must scope each SSE event before handing it to the refresh controller.
 */
import { resumeExternallyStartedCardSkillRun } from '../../codex/effect/poll-card-skill-run.js';
import { currentLedgerStateId } from '../../ledger/helper/current-ledger-state-id.js';
import { state, type ThreadContentRefreshScope } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import {
  isActiveThreadContentScope,
  normalizeContentFileReference
} from '../../thread/effect/load-active-thread-slice.js';
import {
  flushPendingLedgerContentRefresh,
  requestLedgerContentRefresh,
  requestThreadContentRefresh
} from '../controller/ledger-content-refresh-controller.js';
import { changedCardIdForContentFile } from '../helper/changed-card-id-for-content-file.js';
import {
  contentEventPayload,
  type ContentChangeEvent
} from '../helper/content-event-payload.js';

export {
  flushPendingLedgerContentRefresh,
  requestLedgerContentRefresh,
  requestThreadContentRefresh,
  changedCardIdForContentFile,
  contentEventPayload
};

let subscribed = false;

function maybeResumeCodexRunWidget(payload: ContentChangeEvent): void {
  const reason = String(payload.reason ?? '');
  // WHAT: Resume widgets only for explicit Codex start lifecycle events.
  // WHY: Ordinary ledger writes must not create polling loops.
  if (!reason.startsWith('codex-') || !reason.endsWith('-started')) return;
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const cardId = String(payload.outputCardId || payload.cardId || '').trim();
  const runId = String(payload.runId ?? '').trim();
  // WHAT: Require the complete run identity before starting polling.
  // WHY: Partial SSE payloads cannot safely target a widget.
  if (!ledgerId || !cardId || !runId) return;
  resumeExternallyStartedCardSkillRun({ ledgerId, cardId, runId });
}

function eventBelongsToActiveLedger(payload: ContentChangeEvent): boolean {
  const ledgerId = String(payload.ledgerId ?? '').trim();
  return Boolean(ledgerId && ledgerId === currentLedgerStateId());
}

export function subscribeLedgerContentEvents(): void {
  // WHAT: Install at most one browser EventSource subscription.
  // WHY: Repeated boot paths must not multiply refresh work for each backend event.
  if (subscribed || typeof EventSource === 'undefined') return;
  subscribed = true;
  const events = new EventSource('/api/ledger-content-events');
  events.addEventListener('card-content-change', (event) => {
    const payload = contentEventPayload(event);
    // WHAT: Route thread content directly to the scoped slice refresh path.
    // WHY: Thread writes must not replace or rerender the active canvas ledger.
    if (payload.kind === 'thread-content') {
      const scope: ThreadContentRefreshScope = {
        ledgerId: String(payload.ledgerId ?? '').trim(),
        threadId: String(payload.threadId ?? '').trim(),
        contentFile: normalizeContentFileReference(payload.contentFile)
      };
      // WHAT: Reject thread events that no longer own the visible thread.
      // WHY: Route or thread changes can occur before a queued SSE callback runs.
      if (!isActiveThreadContentScope(scope)) {
        telemetry('thread-content-event-ignored', { reason: 'inactive-scope', ...scope });
        return;
      }
      requestThreadContentRefresh('thread-content-change', scope);
      return;
    }
    // WHAT: Reject card events for inactive ledgers.
    // WHY: The active canvas must not fetch or resize from background-ledger changes.
    if (!eventBelongsToActiveLedger(payload)) {
      telemetry('card-content-event-ignored', { reason: 'inactive-ledger', ledgerId: payload.ledgerId ?? '' });
      return;
    }
    requestLedgerContentRefresh('card-content-change', { contentFile: payload.contentFile });
  });
  events.addEventListener('ledger-content-change', (event) => {
    const payload = contentEventPayload(event);
    // WHAT: Reject lifecycle and mutation events for inactive ledgers.
    // WHY: Background ledger activity must not alter the visible route or polling widgets.
    if (!eventBelongsToActiveLedger(payload)) {
      telemetry('ledger-content-event-ignored', { reason: 'inactive-ledger', ledgerId: payload.ledgerId ?? '' });
      return;
    }
    maybeResumeCodexRunWidget(payload);
    requestLedgerContentRefresh(payload.reason || 'ledger-content-change');
  });
  events.onerror = () => {
    telemetry('ledger-content-refresh-stream-error', {});
  };
  state.ledgerContentEventSource = events;
}
