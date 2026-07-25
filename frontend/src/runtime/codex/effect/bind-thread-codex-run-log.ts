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
import type { CardSkillRunSummary } from './request-card-skill-run-status.js';
import { bindCardSkillRunLogConsumer, unbindCardSkillRunLogConsumer } from './poll-card-skill-run.js';
import { requestTaskExecutionPresentation, requestTaskExecutionState } from './request-task-execution-state.js';
import { syncThreadCodexRunControls } from '../../thread/effect/sync-thread-codex-run-controls.js';
import { stopThreadCodexRunClock } from './sync-thread-codex-run-clock.js';

export { syncThreadCodexRunClock } from './sync-thread-codex-run-clock.js';

type ThreadCodexRunLogIdentity = {
  projectId?: string;
  replicaNodeId?: string;
  ledgerId: string;
  cardId: string;
  threadId: string;
  runId: string;
  expectedExecutionId?: string;
  expectedStatus?: CardSkillRunSummary['status'];
  forceRevalidate?: boolean;
};

type TaskLogPoller = {
  key: string;
  generation: number;
  identity: Required<Pick<ThreadCodexRunLogIdentity, 'projectId' | 'replicaNodeId' | 'ledgerId' | 'cardId' | 'threadId' | 'runId'>>;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  abortController: AbortController | null;
};

const taskLogPollers = new Map<string, TaskLogPoller>();
let executionEvents: EventSource | null = null;

function recordState(name: string): Record<string, any> {
  // WHAT: Repair execution-presentation state maps when an older browser session is restored.
  // WHY: Epoch 4 cutover must not require clearing local UI state.
  if (!state[name] || typeof state[name] !== 'object' || Array.isArray(state[name])) state[name] = {};
  return state[name] as Record<string, any>;
}

function executionFor(summary: TaskExecutionStateSummary, executionId: string): TaskExecutionStateItem | null {
  for (const session of summary.sessions) {
    const execution = session.executions.find((candidate) => candidate.executionId === executionId);
    if (execution) return execution;
  }
  return null;
}

function statusForPhase(phase: string): 'pending' | 'running' | 'complete' | 'failed' | 'cancelled' {
  if (phase === 'preparing' || phase === 'queued') return 'pending';
  if (phase === 'starting' || phase === 'running' || phase === 'cancelling') return 'running';
  if (phase === 'succeeded') return 'complete';
  if (phase === 'cancelled') return 'cancelled';
  return 'failed';
}

function syncControlsFromSummary(threadId: string, summary: TaskExecutionStateSummary): void {
  if (typeof document === 'undefined') return;
  const selectedExecutionId = String(recordState('threadSelectedExecutionIdByThreadId')[threadId]
    ?? summary.defaultExecutionId
    ?? '');
  const selected = executionFor(summary, selectedExecutionId);
  const active = summary.activeExecutionIds
    .map((executionId) => executionFor(summary, executionId))
    .filter((execution): execution is TaskExecutionStateItem => Boolean(execution))
    .at(-1) ?? null;
  syncThreadCodexRunControls({
    threadId,
    status: active ? statusForPhase(active.phase) : selected ? statusForPhase(selected.phase) : 'idle',
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
  const { projectId, replicaNodeId, cardId: taskId, threadId } = poller.identity;
  let retryDelay: number | null = null;
  const ownsRequest = (): boolean => taskLogPollers.get(threadId) === poller
    && poller.generation === generation
    && poller.abortController === abortController;
  try {
    const summaryResult = await requestTaskExecutionState({
      projectId,
      replicaNodeId,
      taskId,
      signal: abortController.signal,
    });
    if (!ownsRequest()) return;
    if ('error' in summaryResult) {
      recordState('threadExecutionStateErrorByThreadId')[threadId] = summaryResult.error;
      paintThreadLog(threadId);
      retryDelay = 1_500;
      return;
    }
    const summary = summaryResult.value;
    recordState('threadTaskExecutionStateByThreadId')[threadId] = summary;
    delete recordState('threadExecutionStateErrorByThreadId')[threadId];
    const selectedIds = recordState('threadSelectedExecutionIdByThreadId');
    const requestedExecutionId = String(selectedIds[threadId] ?? '');
    const selectedExecutionId = executionFor(summary, requestedExecutionId)
      ? requestedExecutionId
      : String(summary.defaultExecutionId ?? '');
    selectedIds[threadId] = selectedExecutionId;
    syncControlsFromSummary(threadId, summary);
    if (!selectedExecutionId) {
      delete recordState('threadExecutionPresentationByThreadId')[threadId];
      paintThreadLog(threadId);
      return;
    }
    const presentationResult = await requestTaskExecutionPresentation({
      projectId,
      replicaNodeId,
      executionId: selectedExecutionId,
      signal: abortController.signal,
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
    if (retryDelay === null && summary.activeExecutionIds.length > 0) retryDelay = 900;
  } finally {
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
    const taskId = String(payload.taskId ?? '');
    // WHAT: Revalidate only pollers whose task identity matches the changed execution.
    // WHY: One execution transition must not trigger log reads for every open project.
    for (const poller of taskLogPollers.values()) {
      if (poller.identity.projectId !== projectId || poller.identity.cardId !== taskId) continue;
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
  const cachedSummary = recordState('threadTaskExecutionStateByThreadId')[identity.threadId] as TaskExecutionStateSummary | undefined;
  if (cachedSummary) syncControlsFromSummary(identity.threadId, cachedSummary);
  if (current?.key === key) {
    current.identity = identity;
    if (input.forceRevalidate || (input.expectedExecutionId
      && input.expectedExecutionId !== String(recordState('threadSelectedExecutionIdByThreadId')[identity.threadId] ?? ''))) {
      if (input.expectedExecutionId) recordState('threadSelectedExecutionIdByThreadId')[identity.threadId] = input.expectedExecutionId;
      current.abortController?.abort();
      current.generation += 1;
      current.inFlight = false;
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
  };
  taskLogPollers.set(identity.threadId, poller);
  installExecutionInvalidation();
  schedule(poller, 0);
}

export function unbindThreadCodexRunLog(input: ThreadCodexRunLogIdentity): void {
  const poller = taskLogPollers.get(input.threadId);
  if (!poller) return;
  poller.generation += 1;
  if (poller.timer) clearTimeout(poller.timer);
  poller.abortController?.abort();
  taskLogPollers.delete(input.threadId);
  closeExecutionInvalidationWhenIdle();
  stopThreadCodexRunClock(input.threadId);
}

function consumeActiveRunSummary(input: { threadId: string; runId: string; summary: CardSkillRunSummary }): void {
  if (String(recordState('threadActiveRunIdByThreadId')[input.threadId] ?? '') !== input.runId) return;
  recordState('threadActiveRunSummaryByThreadId')[input.threadId] = input.summary;
  if (String(state.threadId ?? '') !== input.threadId || typeof document === 'undefined') return;
  syncThreadCodexRunControls({
    threadId: input.threadId,
    status: input.summary.ok ? input.summary.status : 'unknown',
    active: input.summary.ok ? input.summary.active : false,
    queuePosition: input.summary.queuePosition,
  });
  paintThreadLog(input.threadId);
}

export function bindThreadCodexActiveRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  const projectId = input.projectId ?? projectIdFromLocation();
  const replicaNodeId = input.replicaNodeId ?? replicaNodeIdFromLocation();
  const activeRunIds = recordState('threadActiveRunIdByThreadId');
  const previousRunId = String(activeRunIds[input.threadId] ?? '');
  if (previousRunId && previousRunId !== input.runId) unbindCardSkillRunLogConsumer({
    projectId,
    replicaNodeId,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: previousRunId,
    consumerId: `thread-active:${input.threadId}`,
  });
  activeRunIds[input.threadId] = input.runId;
  // WHAT: Retain the legacy active-session consumer only for mutation controls during compatibility cutover.
  // WHY: Continue, cancel, and delete commands still have genuine session semantics.
  bindCardSkillRunLogConsumer({
    projectId,
    replicaNodeId,
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    expectedExecutionId: input.expectedExecutionId,
    expectedStatus: input.expectedStatus,
    forceRevalidate: input.forceRevalidate,
    consumerId: `thread-active:${input.threadId}`,
    onSummary: (summary) => consumeActiveRunSummary({ threadId: input.threadId, runId: input.runId, summary }),
  });
}

export function unbindThreadCodexActiveRunLog(input: ThreadCodexRunLogIdentity): void {
  if (!input.ledgerId || !input.cardId || !input.threadId || !input.runId) return;
  unbindCardSkillRunLogConsumer({
    projectId: input.projectId ?? projectIdFromLocation(),
    replicaNodeId: input.replicaNodeId ?? replicaNodeIdFromLocation(),
    ledgerId: input.ledgerId,
    cardId: input.cardId,
    runId: input.runId,
    consumerId: `thread-active:${input.threadId}`,
  });
  if (String(recordState('threadActiveRunIdByThreadId')[input.threadId] ?? '') === input.runId) {
    delete recordState('threadActiveRunIdByThreadId')[input.threadId];
    delete recordState('threadActiveRunSummaryByThreadId')[input.threadId];
  }
}
