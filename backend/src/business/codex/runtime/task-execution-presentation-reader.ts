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
  taskExecutionProcess,
  taskExecutionState,
} from '../helper/task-execution-runtime.js';
import { unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import type { createTaskExecutionPresentationRegistry } from './task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;

export function createTaskExecutionPresentationReader(input: {
  presentationRegistry: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  request: IncomingMessage;
  response: ServerResponse;
  recordFailure: (input: AnyRecord) => void;
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
    const retained = input.presentationRegistry.locallyHydrated(state, execution);
    // WHAT: Rebuild a settled presentation from canonical project artifacts before executor routing.
    // WHY: Durable local evidence survives both the live runtime and in-memory registry across restart.
    if (retained) {
      input.presentationRegistry.setHydrated(
        execution.metadata.projectId,
        executionId,
        executorNodeId,
        retained.events,
      );
      return { statusCode: 200, body: JSON.stringify(retained) };
    }
    if (executorNodeId !== localExecutorNodeId) {
      const projection = input.presentationRegistry.presentation(
        execution.metadata.projectId,
        executionId,
        executorNodeId,
      );
      if (!projection?.hydrated) {
        input.presentationRegistry.hydrateTerminalArtifacts(
          execution.metadata.projectId,
          executorNodeId,
          execution,
          input.recordFailure,
        );
        input.presentationRegistry.hydrateRemotePresentation(
          execution.metadata.projectId,
          execution,
          input.recordFailure,
        );
        return {
          statusCode: 200,
          body: JSON.stringify(input.presentationRegistry.replicated(
            execution,
            projection ?? { events: [], hydrated: false },
            'hydrating',
          )),
        };
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

  const providerSessionId = (executionId: string): string | null => {
    const runtime = input.runtimeForExecution(executionId) ?? input.runtime;
    return taskExecutionProcess(runtime, executionId)?.providerSessionId ?? null;
  };

  return { presentation, providerSessionId, queuePosition, state };
}
