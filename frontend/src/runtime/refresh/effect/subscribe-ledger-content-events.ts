/**
 * WHAT: Subscribes to backend ledger and content-file change events.
 * WHY: The transport boundary must scope each SSE event before handing it to the refresh controller.
 */
import {
  resumeExternallyStartedCardSkillRun,
  resumeExternallyStartedPipelineRun
} from '../../codex/effect/poll-card-skill-run.js';
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
import { installVoiceTranscriptionRecoveryListeners, reconcilePendingVoiceTranscriptions, reconcileVoiceTranscription } from '../../voice/effect/reconcile-voice-transcription.js';
import { projectReplicaRequestPath } from '../../project/helper/project-request-scope.js';

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
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const pipelineRunId = String(payload.pipelineRunId ?? '').trim();
  if (reason.startsWith('pipeline-') && ledgerId && pipelineRunId) {
    resumeExternallyStartedPipelineRun({
      ledgerId,
      pipelineRunId,
      cardId: String(payload.outputCardId || payload.cardId || '').trim(),
      cardIds: payload.cardIds ?? [],
      runId: String(payload.runId ?? '').trim()
    });
    return;
  }
  // WHAT: Resume widgets only for explicit Codex start lifecycle events.
  // WHY: Ordinary ledger writes must not create polling loops.
  if (!reason.startsWith('codex-') || !reason.endsWith('-started')) return;
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
  installVoiceTranscriptionRecoveryListeners();
  const events = new EventSource(projectReplicaRequestPath('/api/ledger-content-events', String(state.projectId ?? ''), String(state.replicaNodeId ?? '')));
  events.addEventListener('open', () => reconcilePendingVoiceTranscriptions('event-source-open'));
  events.addEventListener('card-content-change', (event) => {
    const payload = contentEventPayload(event);
    // WHAT: Route thread content directly to the scoped slice refresh path.
    // WHY: Thread writes must not replace or rerender the active canvas ledger.
    if (payload.kind === 'thread-content') {
      const scope: ThreadContentRefreshScope = {
        projectId: String(state.projectId ?? ''),
        replicaNodeId: String(state.replicaNodeId ?? ''),
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
      if (payload.noteId && String(payload.reason ?? '').startsWith('voice-')) {
        void reconcileVoiceTranscription({ projectId: scope.projectId, replicaNodeId: scope.replicaNodeId, ledgerId: scope.ledgerId, threadId: scope.threadId, noteId: payload.noteId });
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
    const reason = payload.reason || 'ledger-content-change';
    const resizeCardIds = reason === 'pipeline-completed'
      ? (payload.cardIds?.length ? payload.cardIds : [String(payload.cardId ?? '').trim()].filter(Boolean))
      : reason === 'pipeline-skill-settled' && payload.status === 'complete'
        ? [String(payload.cardId ?? '').trim()].filter(Boolean)
        : [];
    requestLedgerContentRefresh(reason, { cardIds: resizeCardIds });
    if (payload.threadId && (reason === 'pipeline-skill-settled' || reason.startsWith('pipeline-complete'))) {
      requestThreadContentRefresh(reason);
    }
  });
  events.onerror = () => {
    telemetry('ledger-content-refresh-stream-error', {});
  };
  state.ledgerContentEventSource = events;
}
