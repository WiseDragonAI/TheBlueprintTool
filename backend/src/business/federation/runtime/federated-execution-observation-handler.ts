/**
 * WHAT: Validates and projects federated execution, presentation, and pipeline observations.
 * WHY: Relay observation validation is a federation runtime boundary independent from connector construction.
 */
import type { ServerResponse } from 'node:http';
import { isTaskExecutionPresentationUpdate } from '../../codex/helper/replicated-task-execution-presentation.js';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;
type Frame = {
  projectId: string;
  from: string;
  payload?: {
    executionId?: string;
    observation?: TaskExecutionObservation | null;
    presentation?: unknown;
    pipeline?: AnyRecord;
  };
};

export function createFederatedExecutionObservationHandler(input: {
  clients: Set<ServerResponse>;
  executionObservations: Map<string, TaskExecutionObservation>;
  executionState: (projectId: string, ownerNodeId: string) => Pick<ProjectTaskState, 'executions'> | null;
  invalidateProject: (projectId: string) => void;
  pipelinePresentations: Map<string, AnyRecord>;
  presentationRegistry: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  recordStoppedOperation: (input: AnyRecord) => void;
  sourceOwnsProject: (projectId: string, nodeId: string) => boolean;
}): (frame: Frame) => void {
  return (frame): void => {
    const executionId = String(frame.payload?.executionId ?? '').trim();
    const key = `${frame.projectId}\0${executionId}\0${frame.from}`;
    if (!executionId || !frame.projectId || !frame.from) return;
    const record = input.executionState(frame.projectId, frame.from)?.executions.find(executionId) ?? null;
    let changed = false;
    const hasObservation = Object.prototype.hasOwnProperty.call(frame.payload, 'observation');
    const observation = frame.payload?.observation;
    const now = Date.now();
    const observedAt = observation ? Date.parse(observation.observedAt) : Number.NaN;
    const expiresAt = observation ? Date.parse(observation.expiresAt) : Number.NaN;
    if (hasObservation && observation === null) {
      input.executionObservations.delete(key);
      changed = true;
    } else if (hasObservation && observation
      && observation.executionId === executionId
      && observation.executorNodeId === frame.from
      && (observation.phase === 'starting' || observation.phase === 'running')
      && Number.isSafeInteger(observation.revision) && observation.revision >= 1
      && Number.isFinite(observedAt) && observedAt <= now + 5_000
      && Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + 60_000
      && expiresAt > observedAt && expiresAt - observedAt <= 60_000) {
      input.executionObservations.set(key, observation);
      changed = true;
    } else if (hasObservation) {
      input.recordStoppedOperation({
        scope: `federation-execution-observation:${frame.projectId}:${frame.from}`,
        component: 'federation-execution-observation',
        operation: 'validate-execution-observation',
        error: new Error('invalid_federated_execution_observation'),
        context: { projectId: frame.projectId, nodeId: frame.from, executionId },
      });
    }
    if (frame.payload?.presentation !== undefined) {
      if ((!record || record.lifecycle.executorNodeId === frame.from)
        && isTaskExecutionPresentationUpdate(frame.payload.presentation)) {
        input.presentationRegistry.applyEvents({
          projectId: frame.projectId,
          executionId,
          executorNodeId: frame.from,
          update: frame.payload.presentation,
        });
        changed = true;
      } else {
        input.recordStoppedOperation({
          scope: `federation-execution-presentation:${frame.projectId}:${frame.from}`,
          component: 'federation-execution-presentation',
          operation: 'validate-execution-presentation',
          error: new Error('invalid_federated_execution_presentation'),
          context: { projectId: frame.projectId, nodeId: frame.from, executionId },
        });
      }
    }
    if (frame.payload?.pipeline !== undefined) {
      const pipeline = frame.payload.pipeline;
      const result = pipeline.result as AnyRecord | undefined;
      const run = result?.run;
      let bytes = Number.POSITIVE_INFINITY;
      try { bytes = Buffer.byteLength(JSON.stringify(result)); } catch {}
      if (input.sourceOwnsProject(frame.projectId, frame.from)
        && typeof pipeline.runId === 'string'
        && pipeline.runId.length > 0
        && pipeline.runId.length <= 256
        && result && typeof result === 'object' && !Array.isArray(result)
        && run && typeof run === 'object' && !Array.isArray(run)
        && String((run as AnyRecord).id ?? '') === pipeline.runId
        && bytes <= 256 * 1024) {
        input.pipelinePresentations.set(
          `${frame.projectId}\0${pipeline.runId}\0${frame.from}`,
          structuredClone(result),
        );
        changed = true;
      } else {
        input.recordStoppedOperation({
          scope: `federation-pipeline-presentation:${frame.projectId}:${frame.from}`,
          component: 'federation-pipeline-presentation',
          operation: 'validate-pipeline-presentation',
          error: new Error('invalid_federated_pipeline_presentation'),
          context: {
            projectId: frame.projectId,
            nodeId: frame.from,
            pipelineRunId: String(pipeline?.runId ?? ''),
          },
        });
      }
    }
    if (!changed) return;
    input.invalidateProject(frame.projectId);
    for (const client of input.clients) {
      client.write(`event: codex-execution-change\ndata: ${JSON.stringify({
        remote: true,
        projectId: frame.projectId,
        nodeId: frame.from,
        executionId,
        taskId: record?.metadata.taskId ?? '',
        sourceCardId: record?.metadata.sourceCardId ?? '',
        phase: record?.lifecycle.phase ?? '',
        revision: record?.lifecycle.revision ?? 0,
      })}\n\n`);
    }
  };
}
