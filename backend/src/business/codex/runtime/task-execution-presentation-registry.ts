/**
 * WHAT: Owns local and replicated task-execution presentation projections.
 * WHY: Presentation hydration and federation transport are Codex runtime concerns, not HTTP server composition state.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import type { TaskExecutionPresentation, TaskExecutionPresentationEvent } from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { buildTaskExecutionPresentation } from '../helper/task-execution-presentation.js';
import {
  applyTaskExecutionPresentationUpdate,
  isTaskExecutionPresentationEvent,
  replicatedTaskExecutionPresentation,
} from '../helper/replicated-task-execution-presentation.js';
import { createDeliveryHttpRequestScope } from '../../delivery/helper/delivery-http-boundary.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';

type AnyRecord = Record<string, unknown>;
type Execution = NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;
type Projection = {
  events: readonly TaskExecutionPresentationEvent[];
  hydrated: boolean;
};

export function createTaskExecutionPresentationRegistry(input: {
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
}): {
  applyEvents: (change: {
    projectId: string;
    executionId: string;
    executorNodeId: string;
    update: { reset: boolean; events: readonly TaskExecutionPresentationEvent[] };
    hydrated?: boolean;
  }) => Projection;
  events: (projectId: string, executionId: string, executorNodeId: string) => readonly TaskExecutionPresentationEvent[];
  hydrateTerminalArtifacts: (
    projectId: string,
    executorNodeId: string,
    execution: Execution | null,
    recordFailure: (input: AnyRecord) => void,
  ) => void;
  locallyHydrated: (state: Pick<ProjectTaskState, 'executions'>, execution: Execution) => TaskExecutionPresentation | null;
  presentation: (projectId: string, executionId: string, executorNodeId: string) => Projection | null;
  publishEvents: (change: {
    projectId: string;
    executionId: string;
    events: readonly TaskExecutionPresentationEvent[];
    reset?: boolean;
  }) => void;
  remotePresentation: (request: {
    projectId: string;
    execution: Execution;
    request: IncomingMessage;
    response: ServerResponse;
  }) => Promise<
    | { ok: true; presentation: TaskExecutionPresentation }
    | { ok: false; statusCode: number; body: string }
  >;
  replicated: (execution: Execution, projection: Projection) => TaskExecutionPresentation;
  setHydrated: (projectId: string, executionId: string, executorNodeId: string, events: readonly TaskExecutionPresentationEvent[]) => void;
} {
  const projections = new Map<string, Projection>();
  const terminalHydrations = new Map<string, Promise<void>>();
  const key = (projectId: string, executionId: string, executorNodeId: string): string => (
    `${projectId}\0${executionId}\0${executorNodeId}`
  );
  const applyEvents = (change: {
    projectId: string;
    executionId: string;
    executorNodeId: string;
    update: { reset: boolean; events: readonly TaskExecutionPresentationEvent[] };
    hydrated?: boolean;
  }): Projection => {
    const projectionKey = key(change.projectId, change.executionId, change.executorNodeId);
    const current = projections.get(projectionKey);
    const projection = {
      events: applyTaskExecutionPresentationUpdate(current?.events ?? [], change.update),
      hydrated: change.hydrated ?? current?.hydrated ?? change.update.reset,
    };
    projections.set(projectionKey, projection);
    return projection;
  };
  const setHydrated = (
    projectId: string,
    executionId: string,
    executorNodeId: string,
    events: readonly TaskExecutionPresentationEvent[],
  ): void => {
    projections.set(key(projectId, executionId, executorNodeId), { events, hydrated: true });
  };
  const locallyHydrated = (
    state: Pick<ProjectTaskState, 'executions'>,
    execution: Execution,
  ): TaskExecutionPresentation | null => {
    if (!['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.lifecycle.phase)) return null;
    const heads = [execution.artifacts.jsonl, execution.artifacts.stderr].filter((head) => head !== null);
    if (heads.some((head) => !existsSync(input.contentStore.objectFile(head.hash)))) return null;
    const runtime: AnyRecord = {
      taskExecutionNodeId: input.federation()?.localOwner().ownerNodeId ?? 'local',
      taskExecutionArtifactFile: (hash: string) => /^[a-f0-9]{64}$/i.test(hash)
        ? input.contentStore.objectFile(hash)
        : '',
    };
    const result = buildTaskExecutionPresentation({
      executionId: execution.metadata.executionId,
      state,
      runtime,
    });
    return 'presentation' in result ? result.presentation : null;
  };
  const remotePresentation = async (requestInput: {
    projectId: string;
    execution: Execution;
    request: IncomingMessage;
    response: ServerResponse;
  }): Promise<
    | { ok: true; presentation: TaskExecutionPresentation }
    | { ok: false; statusCode: number; body: string }
  > => {
    const executionId = requestInput.execution.metadata.executionId;
    const executorNodeId = requestInput.execution.lifecycle.executorNodeId;
    const federation = input.federation();
    if (!federation) {
      return {
        ok: false,
        statusCode: 503,
        body: JSON.stringify({ ok: false, error: 'assigned_node_unreachable', executionId, executorNodeId }),
      };
    }
    const requestScope = createDeliveryHttpRequestScope({
      request: requestInput.request,
      response: requestInput.response,
      timeoutMs: 10_000,
    });
    try {
      const remote = await federation.request(
        executorNodeId,
        `/api/internal/task-executions/${encodeURIComponent(executionId)}/presentation?projectId=${encodeURIComponent(requestInput.projectId)}`,
        { timeoutMs: 10_000, signal: requestScope.signal },
      );
      if (remote.status < 200 || remote.status >= 300) {
        return { ok: false, statusCode: remote.status || 502, body: remote.body.toString('utf8') };
      }
      const presentation = JSON.parse(remote.body.toString('utf8') || '{}') as TaskExecutionPresentation;
      if (presentation.execution?.executionId !== executionId
        || !Array.isArray(presentation.events)
        || !presentation.events.every(isTaskExecutionPresentationEvent)) {
        return {
          ok: false,
          statusCode: 502,
          body: JSON.stringify({ ok: false, error: 'task_execution_remote_response_invalid', executionId }),
        };
      }
      const projectionKey = key(requestInput.projectId, executionId, executorNodeId);
      const events = applyTaskExecutionPresentationUpdate(presentation.events, {
        reset: false,
        events: projections.get(projectionKey)?.events ?? [],
      });
      projections.set(projectionKey, { events, hydrated: true });
      return { ok: true, presentation: { ...presentation, events } };
    } catch (error) {
      return {
        ok: false,
        statusCode: requestScope.signal.aborted ? 504 : 502,
        body: JSON.stringify({
          ok: false,
          error: requestScope.signal.aborted ? 'task_execution_read_timeout' : 'task_execution_remote_request_failed',
          executionId,
          message: error instanceof Error ? error.message : String(error),
        }),
      };
    } finally {
      requestScope.dispose();
    }
  };
  const publishEvents = (change: {
    projectId: string;
    executionId: string;
    events: readonly TaskExecutionPresentationEvent[];
    reset?: boolean;
  }): void => {
    if (!change.projectId || !change.executionId) return;
    const federation = input.federation();
    const executorNodeId = federation?.localOwner().ownerNodeId ?? 'local';
    applyEvents({
      projectId: change.projectId,
      executionId: change.executionId,
      executorNodeId,
      update: { reset: change.reset === true, events: change.events },
    });
    if (!federation) return;
    const chunks = Array.from(
      { length: Math.max(1, Math.ceil(change.events.length / 128)) },
      (_, index) => change.events.slice(index * 128, (index + 1) * 128),
    );
    chunks.forEach((events, index) => {
      federation.publishExecutionObservation(change.projectId, {
        executionId: change.executionId,
        presentation: {
          reset: change.reset === true && index === 0,
          events,
        },
      });
    });
  };
  const hydrateTerminalArtifacts = (
    projectId: string,
    executorNodeId: string,
    execution: Execution | null,
    recordFailure: (input: AnyRecord) => void,
  ): void => {
    const federation = input.federation();
    if (!execution
      || !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.lifecycle.phase)
      || executorNodeId === federation?.localOwner().ownerNodeId
      || !federation?.nodes().some((node) => node.nodeId === executorNodeId && node.online)) return;
    const heads = [execution.artifacts.jsonl, execution.artifacts.stderr].filter((head) => (
      head !== null && !existsSync(input.contentStore.objectFile(head.hash))
    ));
    if (heads.length === 0) return;
    const hydrationKey = `${projectId}\0${execution.metadata.executionId}\0${executorNodeId}`;
    if (terminalHydrations.has(hydrationKey)) return;
    const hydration = Promise.all(heads.map(async (head) => {
      const result = await federation.requestToFile(
        executorNodeId,
        `/api/federation/content-object?projectId=${encodeURIComponent(projectId)}&hash=${encodeURIComponent(head.hash)}`,
        input.contentStore.objectFile(head.hash),
        head.hash,
      );
      if (result.status !== 200) {
        throw new Error(`terminal_execution_artifact_fetch_failed:${result.status}`);
      }
    })).then(() => undefined).catch((error: unknown) => {
      recordFailure({
        scope: `terminal-execution-artifact:${projectId}:${execution.metadata.executionId}`,
        component: 'task-execution-artifact-cache',
        operation: 'hydrate-terminal-execution-artifacts',
        error,
        context: { projectId, executionId: execution.metadata.executionId, executorNodeId },
      });
    }).finally(() => {
      terminalHydrations.delete(hydrationKey);
    });
    terminalHydrations.set(hydrationKey, hydration);
  };
  return {
    applyEvents,
    events: (projectId, executionId, executorNodeId) => (
      projections.get(key(projectId, executionId, executorNodeId))?.events ?? []
    ),
    hydrateTerminalArtifacts,
    locallyHydrated,
    presentation: (projectId, executionId, executorNodeId) => (
      projections.get(key(projectId, executionId, executorNodeId)) ?? null
    ),
    publishEvents,
    remotePresentation,
    replicated: (execution, projection) => replicatedTaskExecutionPresentation(execution, projection.events),
    setHydrated,
  };
}
