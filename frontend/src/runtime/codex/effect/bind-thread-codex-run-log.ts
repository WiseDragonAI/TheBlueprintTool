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
import { taskExecutionDisplayStatus } from '../helper/task-execution-display-status.js';
import { requestTaskExecutionPresentation, requestTaskExecutionState } from './request-task-execution-state.js';
import { syncThreadCodexRunControls } from '../../thread/effect/sync-thread-codex-run-controls.js';
import { stopThreadCodexRunClock } from './sync-thread-codex-run-clock.js';
import type { ThreadCodexRunLogIdentity } from './thread-codex-run-log-identity-types.js';

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
    const selectedExecutionId = findTaskExecution(summary, requestedExecutionId)
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
