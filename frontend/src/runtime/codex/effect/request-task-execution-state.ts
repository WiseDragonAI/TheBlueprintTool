/**
 * WHAT: Requests the task hierarchy and one exact execution presentation.
 * WHY: The Codex Log must not query sessions, merge cursors, or interpret backend artifact layout.
 */
import type {
  TaskExecutionPresentation,
  TaskExecutionStateSummary,
} from '../../../../../shared/schemas/task-execution-presentation-types.js';
import { projectReplicaRequestPath, replicaRequestInit } from '../../project/helper/project-request-scope.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export type TaskExecutionReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function requestJson<T>(input: {
  path: string;
  projectId: string;
  replicaNodeId: string;
  signal?: AbortSignal;
}): Promise<TaskExecutionReadResult<T>> {
  const startedAt = Date.now();
  const abort = new AbortController();
  const forwardAbort = (): void => abort.abort(input.signal?.reason);
  if (input.signal?.aborted) forwardAbort();
  else input.signal?.addEventListener('abort', forwardAbort, { once: true });
  // WHAT: Bound every log read independently from the long-lived execution.
  // WHY: An unavailable executor must fail only the selected panel and release browser resources.
  const timeout = globalThis.setTimeout(() => abort.abort(new Error('task_execution_read_timeout')), 15_000);
  if (typeof timeout === 'object' && timeout && 'unref' in timeout) timeout.unref();
  try {
    const response = await fetch(
      projectReplicaRequestPath(input.path, input.projectId, input.replicaNodeId),
      replicaRequestInit({ cache: 'no-store', signal: abort.signal }, input.replicaNodeId),
    );
    telemetry('task-execution-http-settled', {
      path: input.path,
      projectId: input.projectId,
      replicaNodeId: input.replicaNodeId,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || body.ok === false) {
      return { ok: false, error: String(body.error ?? `Request failed with HTTP ${response.status}.`) };
    }
    return { ok: true, value: body as T };
  } catch (error) {
    telemetry('task-execution-http-failed', {
      path: input.path,
      projectId: input.projectId,
      replicaNodeId: input.replicaNodeId,
      durationMs: Date.now() - startedAt,
      aborted: abort.signal.aborted,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack ?? '' : '',
    });
    return {
      ok: false,
      error: error instanceof Error && error.name === 'AbortError'
        ? 'Task execution request timed out.'
        : error instanceof Error ? error.message : 'Task execution request failed.',
    };
  } finally {
    input.signal?.removeEventListener('abort', forwardAbort);
    globalThis.clearTimeout(timeout);
  }
}

export function requestTaskExecutionState(input: {
  projectId: string;
  replicaNodeId?: string;
  taskId: string;
  signal?: AbortSignal;
}): Promise<TaskExecutionReadResult<TaskExecutionStateSummary>> {
  return requestJson({
    path: `/api/tasks/${encodeURIComponent(input.taskId)}/execution-state`,
    projectId: input.projectId,
    replicaNodeId: String(input.replicaNodeId ?? ''),
    signal: input.signal,
  });
}

export function requestTaskExecutionPresentation(input: {
  projectId: string;
  replicaNodeId?: string;
  executionId: string;
  signal?: AbortSignal;
}): Promise<TaskExecutionReadResult<TaskExecutionPresentation>> {
  return requestJson({
    path: `/api/task-executions/${encodeURIComponent(input.executionId)}`,
    projectId: input.projectId,
    replicaNodeId: String(input.replicaNodeId ?? ''),
    signal: input.signal,
  });
}
