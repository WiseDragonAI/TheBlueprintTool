/**
 * WHAT: Binds the thread Codex Log to one task summary and one exact execution presentation.
 * WHY: Thread logs must stop polling session-latest responses and merging physical JSONL cursors.
 */
import type {
  TaskExecutionStateItem,
  TaskExecutionStateSummary,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import { state } from '../../state.js';
import { projectIdFromLocation, replicaNodeIdFromLocation } from '../../project/helper/project-request-scope.js';
import { findTaskExecution } from '../helper/find-task-execution.js';
import { scopeTaskExecutionState } from '../helper/scope-task-execution-state.js';
import { taskExecutionDisplayStatus } from '../helper/task-execution-display-status.js';
import { requestTaskExecutionPresentation, requestTaskExecutionState } from './request-task-execution-state.js';
import { shouldAcceptReplicatedTaskState } from '../../refresh/helper/task-projection-acceptance.js';
import { syncThreadCodexRunControls } from '../../thread/effect/sync-thread-codex-run-controls.js';
import { stopThreadCodexRunClock } from './sync-thread-codex-run-clock.js';
import type { ThreadCodexRunLogIdentity } from './thread-codex-run-log-identity-types.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export { syncThreadCodexRunClock } from './sync-thread-codex-run-clock.js';
export { bindThreadCodexActiveRunLog, unbindThreadCodexActiveRunLog } from './bind-thread-codex-active-run-log.js';
export type { ThreadCodexRunLogIdentity } from './thread-codex-run-log-identity-types.js';

type TaskLogPoller = {
  key: string;
  generation: number;
  identity: Required<Pick<ThreadCodexRunLogIdentity, 'projectId' | 'replicaNodeId' | 'ledgerId' | 'cardId' | 'threadId' | 'runId'>>;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  abortController: AbortController | null;
  expectedSessionUntilMs: number;
};

const taskLogPollers = new Map<string, TaskLogPoller>();
let executionEvents: EventSource | null = null;

function recordState(name: string): Record<string, any> {
  // WHAT: Repair execution-presentation state maps when an older browser session is restored.
  // WHY: Epoch 4 cutover must not require clearing local UI state.
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function syncControlsFromSummary(threadId: string, summary: TaskExecutionStateSummary): void {
  if (typeof document === 'undefined') return;
  const selectedExecutionId = String(recordState('threadSelectedExecutionIdByThreadId')[threadId]
    ?? summary.defaultExecutionId
    ?? '');
  const selected = findTaskExecution(summary, selectedExecutionId);
  const active = summary.activeExecutionIds
    .map((executionId) => findTaskExecution(summary, executionId))
    .filter((execution): execution is TaskExecutionStateItem => Boolean(execution))
    .at(-1) ?? null;
  syncThreadCodexRunControls({
    threadId,
    status: active ? taskExecutionDisplayStatus(active.phase) : selected ? taskExecutionDisplayStatus(selected.phase) : 'idle',
    active: Boolean(active),
    queuePosition: active?.queuePosition ?? null,
  });
}

function paintThreadLog(threadId: string): void {
  if (String(state.threadId ?? '') !== threadId || typeof document === 'undefined') return;
  void import('../../thread/effect/render-thread-codex-log-update.js')
    .then(({ renderThreadCodexLogUpdate }) => renderThreadCodexLogUpdate())
    .catch(() => undefined);
}

function schedule(poller: TaskLogPoller, delay = 900): void {
  if (poller.timer) clearTimeout(poller.timer);
  // WHAT: Keep one finite refresh timer per visible task log.
  // WHY: Repeated panel renders must not multiply asynchronous polling.
  poller.timer = setTimeout(() => {
    poller.timer = null;
    void refreshTaskLog(poller).catch(() => undefined);
  }, delay);
  if (typeof poller.timer === 'object' && poller.timer && 'unref' in poller.timer) poller.timer.unref();
}

async function refreshTaskLog(poller: TaskLogPoller): Promise<void> {
  if (poller.inFlight || taskLogPollers.get(poller.identity.threadId) !== poller) return;
  poller.inFlight = true;
  const generation = poller.generation;
  const abortController = new AbortController();
  poller.abortController = abortController;
  const { projectId, replicaNodeId, ledgerId, cardId, threadId } = poller.identity;
  const startedAt = Date.now();
  let retryDelay: number | null = null;
  const ownsRequest = (): boolean => taskLogPollers.get(threadId) === poller
    && poller.generation === generation
    && poller.abortController === abortController;
  try {
    telemetry('codex-log-refresh-started', {
      projectId, replicaNodeId, ledgerId, cardId, threadId, generation,
    });
    const summaryResult = await requestTaskExecutionState({
      projectId,
      replicaNodeId,
      ledgerId,
      cardId,
      signal: abortController.signal,
    });
    telemetry('codex-log-summary-settled', {
      projectId,
      replicaNodeId,
      ledgerId,
      cardId,
      threadId,
      generation,
      durationMs: Date.now() - startedAt,
      outcome: 'error' in summaryResult ? 'error' : 'value',
      error: 'error' in summaryResult ? summaryResult.error : '',
    });
    if (!ownsRequest()) return;
    if ('error' in summaryResult) {
      recordState('threadExecutionStateErrorByThreadId')[threadId] = summaryResult.error;
      paintThreadLog(threadId);
      retryDelay = 1_500;
      return;
    }
    const summary = scopeTaskExecutionState(summaryResult.value, poller.identity.cardId);
    const expectedSessionExecution = poller.expectedSessionUntilMs > Date.now()
      ? summary.sessions.find((session) => session.sessionId === poller.identity.runId)?.executions.at(-1) ?? null
      : null;
    const awaitingExpectedSession = poller.expectedSessionUntilMs > Date.now()
      && Boolean(poller.identity.runId)
      && !expectedSessionExecution;
    // WHAT: Clear the bounded admission expectation after its session execution becomes locally visible.
    // WHY: Once durable execution state catches up, normal active and invalidation-driven refresh ownership resumes.
    if (expectedSessionExecution) poller.expectedSessionUntilMs = 0;
    telemetry('codex-log-summary-installed', {
      projectId,
      replicaNodeId,
      ledgerId,
      cardId,
      threadId,
      generation,
      sessions: summary.sessions.length,
      executions: summary.sessions.reduce((count, session) => count + session.executions.length, 0),
      activeExecutions: summary.activeExecutionIds.length,
      defaultExecutionId: summary.defaultExecutionId,
      requestedRunId: poller.identity.runId,
      sessionIds: summary.sessions.map((session) => session.sessionId),
      executionIds: summary.sessions.flatMap((session) => session.executions.map((execution) => execution.executionId)),
    });
    recordState('threadTaskExecutionStateByThreadId')[threadId] = summary;
    delete recordState('threadExecutionStateErrorByThreadId')[threadId];
    const selectedIds = recordState('threadSelectedExecutionIdByThreadId');
    const requestedExecutionId = String(selectedIds[threadId] ?? '');
    const selectedExecutionId = expectedSessionExecution?.executionId
      ?? (findTaskExecution(summary, requestedExecutionId)
        ? requestedExecutionId
        : String(summary.defaultExecutionId ?? ''));
    selectedIds[threadId] = selectedExecutionId;
    // WHAT: Preserve optimistic active controls while the accepted session has no execution entity yet.
    // WHY: An earlier empty summary cannot truthfully reset a run whose admission is still settling.
    if (!awaitingExpectedSession) syncControlsFromSummary(threadId, summary);
    if (!selectedExecutionId) {
      delete recordState('threadExecutionPresentationByThreadId')[threadId];
      paintThreadLog(threadId);
      // WHAT: Re-read local task state while the accepted session is inside its bounded materialization window.
      // WHY: Execution identity is created at turn start and can legitimately follow the admission response.
      if (awaitingExpectedSession) retryDelay = 300;
      return;
    }
    const presentationResult = await requestTaskExecutionPresentation({
      projectId,
      replicaNodeId,
      executionId: selectedExecutionId,
      signal: abortController.signal,
    });
    telemetry('codex-log-presentation-settled', {
      projectId,
      replicaNodeId,
      ledgerId,
      cardId,
      threadId,
      generation,
      executionId: selectedExecutionId,
      durationMs: Date.now() - startedAt,
      outcome: 'error' in presentationResult ? 'error' : 'value',
      error: 'error' in presentationResult ? presentationResult.error : '',
    });
    if (!ownsRequest()
      || String(recordState('threadSelectedExecutionIdByThreadId')[threadId] ?? '') !== selectedExecutionId) return;
    if ('value' in presentationResult) {
      recordState('threadExecutionPresentationByThreadId')[threadId] = presentationResult.value;
      delete recordState('threadExecutionPresentationErrorByThreadId')[threadId];
    } else {
      recordState('threadExecutionPresentationErrorByThreadId')[threadId] = presentationResult.error;
      retryDelay = 1_500;
    }
    paintThreadLog(threadId);
    // WHAT: Refresh complete snapshots only while the task has active execution work.
    // WHY: Terminal history is immutable and future admissions arrive through execution-change invalidation.
    if (retryDelay === null && awaitingExpectedSession) retryDelay = 300;
    else if (retryDelay === null && summary.activeExecutionIds.length > 0) retryDelay = 900;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? '' : '';
    telemetry('codex-log-refresh-failed', {
      projectId,
      replicaNodeId,
      ledgerId,
      cardId,
      threadId,
      generation,
      durationMs: Date.now() - startedAt,
      aborted: abortController.signal.aborted,
      error: message,
      stack,
    });
    // WHAT: Install a visible scoped read error and retry after an unexpected projection failure.
    // WHY: A swallowed exception otherwise leaves the Codex Log in an indistinguishable permanent loading state.
    if (ownsRequest()) {
      recordState('threadExecutionStateErrorByThreadId')[threadId] = message;
      paintThreadLog(threadId);
      retryDelay = 1_500;
    }
  } finally {
    telemetry('codex-log-refresh-settled', {
      projectId,
      replicaNodeId,
      ledgerId,
      cardId,
      threadId,
      generation,
      durationMs: Date.now() - startedAt,
      ownsRequest: ownsRequest(),
      aborted: abortController.signal.aborted,
      retryDelay,
    });
    if (poller.abortController === abortController) poller.abortController = null;
    if (taskLogPollers.get(threadId) === poller && poller.generation === generation) {
      poller.inFlight = false;
      if (retryDelay !== null) schedule(poller, retryDelay);
    }
  }
}

function closeExecutionInvalidationWhenIdle(): void {
  if (taskLogPollers.size > 0 || !executionEvents) return;
  // WHAT: Close the shared invalidation stream when no thread log consumes it.
  // WHY: Closing the last panel must release every network and timer resource owned by the binding.
  executionEvents.close();
  executionEvents = null;
}

function installExecutionInvalidation(): void {
  if (executionEvents || typeof EventSource === 'undefined') return;
  executionEvents = new EventSource('/api/control-room-events');
  executionEvents.addEventListener('codex-execution-change', (event) => {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(String((event as MessageEvent).data ?? '{}')) as Record<string, unknown>; } catch { return; }
    const projectId = String(payload.projectId ?? '');
    const sourceCardId = String(payload.sourceCardId ?? '');
    const executionId = String(payload.executionId ?? '');
    const incomingRevision = Number(payload.revision ?? 0);
    const incomingPhase = String(payload.phase ?? '');
    // WHAT: Revalidate only pollers whose task identity matches the changed execution.
    // WHY: One execution transition must not trigger log reads for every open project.
    for (const poller of taskLogPollers.values()) {
      if (poller.identity.projectId !== projectId || poller.identity.cardId !== sourceCardId) continue;
      const summary = recordState('threadTaskExecutionStateByThreadId')[poller.identity.threadId] as TaskExecutionStateSummary | undefined;
      const installed = executionId ? findTaskExecution(summary ?? null, executionId) : null;
      // WHAT: Suppress invalidations already represented by the installed execution snapshot.
      // WHY: Event revisions are invalidation hints and cannot regress a terminal lifecycle or force redundant reads.
      if (installed && (
        (Number.isSafeInteger(incomingRevision) && incomingRevision > 0 && incomingRevision <= installed.revision)
        || !shouldAcceptReplicatedTaskState({
          domain: 'queued-execution',
          local: { phase: installed.phase, revision: installed.revision },
          incoming: { phase: incomingPhase, revision: incomingRevision },
          pendingReceipt: null,
          source: 'relay-refresh',
        })
      )) continue;
      poller.abortController?.abort();
      poller.generation += 1;
      poller.inFlight = false;
      schedule(poller, 0);
    }
  });
}

export function bindThreadCodexRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.cardId || !input.threadId) return;
  const identity = {
    projectId: input.projectId ?? projectIdFromLocation(),
    replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation(),
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    threadId: input.threadId,
    runId: input.runId,
  };
  const key = `${identity.projectId}\0${identity.replicaNodeId}\0${identity.cardId}`;
  const current = taskLogPollers.get(identity.threadId);
  const expectsAdmission = Boolean(identity.runId)
    && (input.expectedStatus === 'pending' || input.expectedStatus === 'running');
  const cachedSummary = recordState('threadTaskExecutionStateByThreadId')[identity.threadId] as TaskExecutionStateSummary | undefined;
  telemetry('codex-log-binding-resolved', {
    ...identity,
    expectedExecutionId: input.expectedExecutionId ?? '',
    expectedStatus: input.expectedStatus ?? '',
    expectsAdmission,
    forceRevalidate: input.forceRevalidate === true,
    existingPollerKey: current?.key ?? '',
    resolvedPollerKey: key,
    cachedSessionIds: cachedSummary?.sessions.map((session) => session.sessionId) ?? [],
    cachedExecutionIds: cachedSummary?.sessions.flatMap((session) => session.executions.map((execution) => execution.executionId)) ?? [],
    selectedExecutionId: String(recordState('threadSelectedExecutionIdByThreadId')[identity.threadId] ?? ''),
  });
  if (cachedSummary) syncControlsFromSummary(identity.threadId, cachedSummary);
  if (current?.key === key) {
    current.identity = identity;
    // WHAT: Renew the bounded session expectation when admission reports pending or running work.
    // WHY: Intermediate panel renders must not erase the only evidence that execution identity is still materializing.
    if (expectsAdmission) current.expectedSessionUntilMs = Date.now() + 15_000;
    if (input.forceRevalidate || (input.expectedExecutionId
      && input.expectedExecutionId !== String(recordState('threadSelectedExecutionIdByThreadId')[identity.threadId] ?? ''))) {
      if (input.expectedExecutionId) recordState('threadSelectedExecutionIdByThreadId')[identity.threadId] = input.expectedExecutionId;
      current.abortController?.abort();
      current.generation += 1;
      current.inFlight = false;
      schedule(current, 0);
    }
    const orphaned = !cachedSummary && !current.inFlight && current.timer === null;
    // WHAT: Restart an idle same-task reader only when no summary, request, or timer exists.
    // WHY: Browser state can outlive the server without multiplying local reads or relay-backed replica reads.
    if (orphaned) {
      current.generation += 1;
      schedule(current, 0);
    }
    return;
  }
  if (current?.timer) clearTimeout(current.timer);
  current?.abortController?.abort();
  if (input.expectedExecutionId) recordState('threadSelectedExecutionIdByThreadId')[identity.threadId] = input.expectedExecutionId;
  const poller: TaskLogPoller = {
    key,
    generation: 1,
    identity,
    timer: null,
    inFlight: false,
    abortController: null,
    expectedSessionUntilMs: expectsAdmission ? Date.now() + 15_000 : 0,
  };
  taskLogPollers.set(identity.threadId, poller);
  installExecutionInvalidation();
  schedule(poller, 0);
}

export function unbindThreadCodexRunLog(input: ThreadCodexRunLogIdentity): void {
  const poller = taskLogPollers.get(input.threadId);
  telemetry('codex-log-unbind-requested', {
    projectId: input.projectId ?? projectIdFromLocation(),
    replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation(),
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    threadId: input.threadId,
    runId: input.runId,
    installedPollerKey: poller?.key ?? '',
  });
  if (!poller) return;
  poller.generation += 1;
  if (poller.timer) clearTimeout(poller.timer);
  poller.abortController?.abort();
  taskLogPollers.delete(input.threadId);
  closeExecutionInvalidationWhenIdle();
  stopThreadCodexRunClock(input.threadId);
}
