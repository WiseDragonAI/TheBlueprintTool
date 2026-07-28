/**
 * WHAT: Projects one client-owned execution request over a Control Room task.
 * WHY: Launches must move immediately to Exec while exact request identity fences canonical reconciliation.
 */
import { taskIdentity } from './optimistic-task-projection.js';

export function controlRoomTaskForExecution(projection, detail) {
  return (projection?.allTasks ?? []).find((task) => (
    String(task.projectId ?? '') === String(detail.projectId ?? '')
    && String(task.ledgerId ?? '') === String(detail.ledgerId ?? '')
    && (
      String(task.cardId ?? '') === String(detail.cardId ?? '')
      || (task.subtasks ?? []).some((subtask) => String(subtask.cardId ?? '') === String(detail.cardId ?? ''))
    )
  )) ?? null;
}

export function createOptimisticExecutionIntent(task, detail) {
  const acceptedAt = String(detail.acceptedAt || new Date().toISOString());
  const executorNodeId = String(task.assignedNodeId || '');
  const optimisticTask = {
    ...task,
    status: 'task-execution',
    executionStatus: 'preparing',
    executionSince: acceptedAt,
    executionTime: Date.parse(acceptedAt),
    executionNodeId: executorNodeId,
    executionNodeLabel: task.assignedNodeLabel || executorNodeId,
    codexStatus: 'preparing',
    codexQueued: false,
    codexProcessing: false,
    transcribingBeforeLaunch: detail.kind === 'voice',
    execution: {
      executionId: '',
      requestId: String(detail.requestId),
      phase: 'preparing',
      phaseSince: acceptedAt,
      revision: 0,
      executorNodeId,
    },
  };
  return {
    requestId: String(detail.requestId),
    executionId: '',
    revision: 0,
    task: optimisticTask,
  };
}

export function applyOptimisticExecutionIntent(projection, intent) {
  const identity = taskIdentity(intent.task);
  for (const collection of ['queue', 'exec', 'backlog', 'done', 'allTasks']) {
    projection[collection] = (projection[collection] ?? []).filter((task) => taskIdentity(task) !== identity);
  }
  projection.exec = [intent.task, ...(projection.exec ?? [])];
  projection.allTasks = [intent.task, ...(projection.allTasks ?? [])];
  return projection;
}

export function optimisticExecutionConfirmed(intent, serverTask) {
  const execution = serverTask?.execution;
  if (!execution || String(execution.requestId ?? '') !== intent.requestId) return false;
  const revision = Number(execution.revision ?? 0);
  return Number.isSafeInteger(revision) && revision >= intent.revision;
}

export function removeAcknowledgedExecutionIntent(intents, detail) {
  const clientRequestId = String(detail?.clientRequestId ?? detail?.requestId ?? '');
  for (const [identity, intent] of intents) {
    if (intent.requestId !== clientRequestId) continue;
    intents.delete(identity);
    return true;
  }
  return false;
}
