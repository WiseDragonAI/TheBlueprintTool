/**
 * WHAT: Reads local and replicated task-execution presentations through one Codex-owned boundary.
 * WHY: HTTP composition must not own presentation hydration, executor routing, or queue projection.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { buildTaskExecutionPresentation } from '../helper/task-execution-presentation.js';
import { taskExecutionPresentationHttpResult } from '../helper/task-execution-presentation-http-result.js';
import {
  taskExecutionNodeId,
  taskExecutionState,
} from '../helper/task-execution-runtime.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import type { createTaskExecutionPresentationRegistry } from './task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;

export function createTaskExecutionPresentationReader(input: {
  presentationRegistry: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: AnyRecord;
  runtimeForExecution(executionId: string): AnyRecord | null;
}) {
  const state = taskExecutionState(input.runtime);

  const presentation = async (
    executionId: string,
  ): Promise<{ body: string; statusCode: number }> => {
    const execution = state?.executions.find(executionId) ?? null;
    if (!state || !execution) {
      return {
        statusCode: 404,
        body: JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }),
      };
    }
    const executorNodeId = execution.lifecycle.executorNodeId;
    const localExecutorNodeId = taskExecutionNodeId(input.runtime);
    if (executorNodeId !== localExecutorNodeId) {
      const projection = input.presentationRegistry.presentation(
        execution.metadata.projectId,
        executionId,
        executorNodeId,
      );
      if (!projection?.hydrated) {
        const hydrated = input.presentationRegistry.locallyHydrated(state, execution);
        if (hydrated) {
          input.presentationRegistry.setHydrated(
            execution.metadata.projectId,
            executionId,
            executorNodeId,
            hydrated.events,
          );
          return { statusCode: 200, body: JSON.stringify(hydrated) };
        }
        const remote = await input.presentationRegistry.remotePresentation({
          projectId: execution.metadata.projectId,
          execution,
          request: input.request,
          response: input.response,
        });
        return 'presentation' in remote
          ? {
            statusCode: 200,
            body: JSON.stringify(input.presentationRegistry.replicated(execution, {
              events: remote.presentation.events,
              hydrated: true,
            })),
          }
          : { statusCode: remote.statusCode, body: remote.body };
      }
      return {
        statusCode: 200,
        body: JSON.stringify(input.presentationRegistry.replicated(execution, projection)),
      };
    }
    const presentationRuntime = input.runtimeForExecution(executionId) ?? input.runtime;
    const projection = input.presentationRegistry.presentation(
      execution.metadata.projectId,
      executionId,
      localExecutorNodeId,
    );
    const result = projection?.hydrated
      ? {
        ok: true as const,
        presentation: input.presentationRegistry.replicated(execution, projection),
      }
      : buildTaskExecutionPresentation({
        executionId,
        state,
        runtime: presentationRuntime,
      });
    if ('presentation' in result && !projection?.hydrated) {
      input.presentationRegistry.setHydrated(
        execution.metadata.projectId,
        executionId,
        localExecutorNodeId,
        result.presentation.events,
      );
    }
    const http = taskExecutionPresentationHttpResult(executionId, result);
    return { statusCode: http.statusCode, body: http.body };
  };

  const queuePosition = (
    record: ReturnType<ProjectTaskState['executions']['find']>,
  ): number => unifiedCodexQueuePosition({
    decisionOsRoot: String(input.runtime.decisionOsRoot ?? ''),
    id: record?.metadata.executionId ?? '',
    createdAt: record?.metadata.requestedAt ?? '',
    runtime: input.runtime,
  });

  return { presentation, queuePosition, state };
}
