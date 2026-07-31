/**
 * WHAT: Serves execution and pipeline projections for a selected remote project replica.
 * WHY: Remote execution presentation is a federation read capability, not server composition logic.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import { taskExecutionStateTaskId } from '../../codex/helper/task-execution-state-task-id.js';
import { projectTaskExecutionState } from '../../codex/helper/project-task-execution-state.js';
import { buildTaskExecutionPresentation } from '../../codex/helper/task-execution-presentation.js';
import { taskExecutionPresentationHttpResult } from '../../codex/helper/task-execution-presentation-http-result.js';
import { replicatedCardSkillRunStatus } from '../../codex/helper/replicated-card-skill-run-status.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { createTaskExecutionPresentationRegistry } from '../../codex/runtime/task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;
type Execution = NonNullable<ReturnType<ProjectTaskState['executions']['find']>>;

export async function handleRemoteExecutionRoutes(input: {
  localNodeId: string;
  ownerNodeId: string;
  pipelinePresentation: (runId: string) => AnyRecord | null;
  presentationRegistry: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  presentationRuntime: (executionId: string) => AnyRecord | null;
  recordBackgroundFailure: (operation: string, error: unknown, context: AnyRecord) => void;
  projectId: string;
  projection: AnyRecord | null;
  queuePosition: (execution: Execution) => number | null;
  request: IncomingMessage;
  response: ServerResponse;
  scopedPath: string;
  state: ProjectTaskState | null;
  url: URL;
}): Promise<{ handled: boolean }> {
  if (input.request.method !== 'GET') return { handled: false };
  const executionStateRead = input.scopedPath.match(/^\/api\/tasks\/([^/]+)\/execution-state$/);
  if (executionStateRead) {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    if (!input.state || !input.projection) {
      input.response.statusCode = 202;
      input.response.end(JSON.stringify({ ok: false, error: 'task_execution_state_synchronizing' }));
      return { handled: true };
    }
    const requestedCardId = decodeRouteSegment(executionStateRead[1]);
    const taskId = taskExecutionStateTaskId(
      input.projection.ledger as AnyRecord,
      requestedCardId,
    );
    input.response.end(JSON.stringify(projectTaskExecutionState({
      taskId,
      state: input.state,
      queuePosition: input.queuePosition,
    })));
    return { handled: true };
  }
  const presentationRead = input.scopedPath.match(/^\/api\/task-executions\/([^/]+)$/);
  if (presentationRead) {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    const executionId = decodeRouteSegment(presentationRead[1]);
    const execution = input.state?.executions.find(executionId) ?? null;
    if (!input.state || !execution) {
      input.response.statusCode = 404;
      input.response.end(JSON.stringify({ ok: false, error: 'task_execution_not_found', executionId }));
      return { handled: true };
    }
    if (execution.lifecycle.executorNodeId === input.localNodeId) {
      const runtime = input.presentationRuntime(executionId);
      const projection = input.presentationRegistry.presentation(
        input.projectId,
        executionId,
        input.localNodeId,
      );
      const result = projection?.hydrated
        ? { ok: true as const, presentation: input.presentationRegistry.replicated(execution, projection) }
        : runtime
          ? buildTaskExecutionPresentation({ executionId, state: input.state, runtime })
          : { ok: false as const, statusCode: 202, error: 'task_execution_presentation_synchronizing' };
      if ('presentation' in result && !projection?.hydrated) {
        input.presentationRegistry.setHydrated(
          input.projectId,
          executionId,
          input.localNodeId,
          result.presentation.events,
        );
      }
      const http = taskExecutionPresentationHttpResult(executionId, result);
      input.response.statusCode = http.statusCode;
      input.response.end(http.body);
      return { handled: true };
    }
    let projection = input.presentationRegistry.presentation(
      input.projectId,
      executionId,
      execution.lifecycle.executorNodeId,
    );
    if (!projection?.hydrated) {
      const hydrated = input.presentationRegistry.locallyHydrated(input.state, execution);
      // WHAT: Return a presentation rebuilt from retained project artifacts before requesting its executor.
      // WHY: Remote assignment does not invalidate locally synchronized immutable execution evidence.
      if (hydrated) {
        input.presentationRegistry.setHydrated(
          input.projectId,
          executionId,
          execution.lifecycle.executorNodeId,
          hydrated.events,
        );
        input.response.end(JSON.stringify(hydrated));
        return { handled: true };
      }
      input.presentationRegistry.hydrateRemotePresentation(
        input.projectId,
        execution,
        (failure) => input.recordBackgroundFailure(
          'hydrate-remote-execution-presentation',
          failure.error,
          failure.context as AnyRecord,
        ),
      );
      input.response.end(JSON.stringify(input.presentationRegistry.replicated(
        execution,
        projection ?? { events: [], hydrated: false },
        'hydrating',
      )));
      return { handled: true };
    }
    input.response.end(JSON.stringify(input.presentationRegistry.replicated(execution, projection)));
    return { handled: true };
  }
  const pipelineRunRead = input.scopedPath.match(/^\/api\/codex\/pipelines\/runs\/([^/]+)$/);
  if (pipelineRunRead) {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    const runId = decodeRouteSegment(pipelineRunRead[1]);
    const result = input.pipelinePresentation(runId);
    if (!result) {
      input.response.statusCode = 202;
      input.response.end(JSON.stringify({ ok: false, error: 'pipeline_presentation_synchronizing', runId }));
      return { handled: true };
    }
    input.response.end(JSON.stringify(result));
    return { handled: true };
  }
  const skillRunRead = input.scopedPath.match(/^\/api\/codex\/skills\/runs\/([^/]+)$/);
  if (!skillRunRead) return { handled: false };
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  const runId = decodeRouteSegment(skillRunRead[1]);
  const ledgerId = input.url.searchParams.get('ledgerId') ?? '';
  const cardId = input.url.searchParams.get('cardId') ?? '';
  const execution = input.state?.executions.bySessionId(runId)
    .filter((candidate) => candidate.metadata.ledgerId === ledgerId
      && (candidate.metadata.sourceCardId === cardId || candidate.metadata.ownerCardId === cardId))
    .sort((left, right) => right.metadata.requestedAt.localeCompare(left.metadata.requestedAt)
      || right.metadata.executionId.localeCompare(left.metadata.executionId))[0] ?? null;
  if (!input.state || !execution) {
    input.response.statusCode = 404;
    input.response.end(JSON.stringify({ ok: false, error: 'Execution not found.', runId }));
    return { handled: true };
  }
  const events = input.presentationRegistry.events(
    input.projectId,
    execution.metadata.executionId,
    execution.lifecycle.executorNodeId,
  );
  const hydratedEvents = events.length > 0
    ? events
    : input.presentationRegistry.locallyHydrated(input.state, execution)?.events ?? [];
  input.response.end(JSON.stringify(replicatedCardSkillRunStatus({
    runId,
    ledgerId,
    cardId,
    executions: input.state.executions.all(),
    events: hydratedEvents,
    queuePosition: null,
  })));
  return { handled: true };
}
