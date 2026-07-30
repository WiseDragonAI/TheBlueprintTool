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
  acceptLedgerInvalidationRevision,
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
import { refreshActiveLedgerCardEditor } from '../../content-authoring/controller/ledger-card-editor.js';

export {
  flushPendingLedgerContentRefresh,
  requestLedgerContentRefresh,
  requestThreadContentRefresh,
  changedCardIdForContentFile,
  contentEventPayload
};

let subscriptionScope = '';

function currentSubscriptionScope(): { key: string; projectId: string; replicaNodeId: string } {
  const projectId = String(state.projectId ?? '').trim();
  const replicaNodeId = String(state.replicaNodeId ?? '').trim();
  return { key: `${projectId}\u0000${replicaNodeId}`, projectId, replicaNodeId };
}

function maybeResumeCodexRunWidget(payload: ContentChangeEvent, scope: { projectId: string; replicaNodeId: string }): void {
  const reason = String(payload.reason ?? '');
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const pipelineRunId = String(payload.pipelineRunId ?? '').trim();
  if (reason.startsWith('pipeline-') && ledgerId && pipelineRunId) {
    resumeExternallyStartedPipelineRun({
      projectId: scope.projectId,
      replicaNodeId: scope.replicaNodeId,
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
  if (reason !== 'codex-run-accepted' && reason !== 'codex-turn-started') return;
  const cardId = String(payload.outputCardId || payload.cardId || '').trim();
  const runId = String(payload.runId ?? '').trim();
  // WHAT: Require the complete run identity before starting polling.
  // WHY: Partial SSE payloads cannot safely target a widget.
  if (!ledgerId || !cardId || !runId) return;
  resumeExternallyStartedCardSkillRun({ projectId: scope.projectId, replicaNodeId: scope.replicaNodeId, ledgerId, cardId, runId, executionId: String(payload.executionId ?? ''), status: payload.status as 'pending' | 'running' });
}

function eventBelongsToActiveLedger(payload: ContentChangeEvent, scope: { key: string; projectId: string; replicaNodeId: string }): boolean {
  const ledgerId = String(payload.ledgerId ?? '').trim();
  const payloadProjectId = String(payload.projectId ?? '').trim();
  const payloadReplicaNodeId = String(payload.replicaNodeId ?? '').trim();
  const active = currentSubscriptionScope();
  return Boolean(scope.key === active.key
    && ledgerId
    && ledgerId === currentLedgerStateId()
    && (!payloadProjectId || payloadProjectId === scope.projectId)
    && (!payloadReplicaNodeId || payloadReplicaNodeId === scope.replicaNodeId));
}

export function subscribeLedgerContentEvents(): void {
  // WHAT: Install at most one browser EventSource subscription.
  // WHY: Repeated boot paths must not multiply refresh work for each backend event.
  if (typeof EventSource === 'undefined') return;
  const scope = currentSubscriptionScope();
  if (subscriptionScope === scope.key && state.ledgerContentEventSource) return;
  state.ledgerContentEventSource?.close?.();
  subscriptionScope = scope.key;
  installVoiceTranscriptionRecoveryListeners();
  const events = new EventSource(projectReplicaRequestPath('/api/ledger-content-events', scope.projectId, scope.replicaNodeId));
  events.addEventListener('open', () => {
    if (currentSubscriptionScope().key === scope.key) reconcilePendingVoiceTranscriptions('event-source-open');
  });
  events.addEventListener('card-content-change', (event) => {
    const payload = contentEventPayload(event);
    // WHAT: Route thread content directly to the scoped slice refresh path.
    // WHY: Thread writes must not replace or rerender the active canvas ledger.
    if (payload.kind === 'thread-content') {
      const threadScope: ThreadContentRefreshScope = {
        projectId: scope.projectId,
        replicaNodeId: scope.replicaNodeId,
        ledgerId: String(payload.ledgerId ?? '').trim(),
        threadId: String(payload.threadId ?? '').trim(),
        contentFile: normalizeContentFileReference(payload.contentFile)
      };
      // WHAT: Reject thread events that no longer own the visible thread.
      // WHY: Route or thread changes can occur before a queued SSE callback runs.
      if (!isActiveThreadContentScope(threadScope)) {
        telemetry('thread-content-event-ignored', { reason: 'inactive-scope', ...threadScope });
        return;
      }
      if (!acceptLedgerInvalidationRevision(Number(payload.invalidationRevision ?? 0))) {
        telemetry('content-invalidation-ignored', { reason: 'stale-revision', revision: payload.invalidationRevision ?? 0 });
        return;
      }
      if (payload.noteId && String(payload.reason ?? '').startsWith('voice-')) {
        void reconcileVoiceTranscription({ projectId: threadScope.projectId, replicaNodeId: threadScope.replicaNodeId, ledgerId: threadScope.ledgerId, threadId: threadScope.threadId, noteId: payload.noteId });
        return;
      }
      requestThreadContentRefresh('thread-content-change', threadScope);
      return;
    }
    // WHAT: Reject card events for inactive ledgers.
    // WHY: The active canvas must not fetch or resize from background-ledger changes.
    if (!eventBelongsToActiveLedger(payload, scope)) {
      telemetry('card-content-event-ignored', { reason: 'inactive-ledger', ledgerId: payload.ledgerId ?? '' });
      return;
    }
    if (!acceptLedgerInvalidationRevision(Number(payload.invalidationRevision ?? 0))) {
      telemetry('content-invalidation-ignored', { reason: 'stale-revision', revision: payload.invalidationRevision ?? 0 });
      return;
    }
    const changedCardId = changedCardIdForContentFile(String(payload.contentFile ?? ''));
    if (changedCardId) {
      void refreshActiveLedgerCardEditor({
        projectId: scope.projectId,
        ledgerId: String(payload.ledgerId ?? '').trim(),
        cardId: changedCardId,
      });
    }
    requestLedgerContentRefresh('card-content-change', { contentFile: payload.contentFile });
  });
  events.addEventListener('ledger-content-change', (event) => {
    const payload = contentEventPayload(event);
    // WHAT: Reject lifecycle and mutation events for inactive ledgers.
    // WHY: Background ledger activity must not alter the visible route or polling widgets.
    if (!eventBelongsToActiveLedger(payload, scope)) {
      telemetry('ledger-content-event-ignored', { reason: 'inactive-ledger', ledgerId: payload.ledgerId ?? '' });
      return;
    }
    if (!acceptLedgerInvalidationRevision(Number(payload.invalidationRevision ?? 0))) {
      telemetry('content-invalidation-ignored', { reason: 'stale-revision', revision: payload.invalidationRevision ?? 0 });
      return;
    }
    maybeResumeCodexRunWidget(payload, scope);
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
