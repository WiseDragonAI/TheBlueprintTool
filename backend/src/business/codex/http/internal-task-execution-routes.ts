import type { IncomingMessage, ServerResponse } from 'node:http';
import { cancelTaskExecutionLocally } from '../helper/cancel-task-execution.js';
import { readCardSkillRunController } from '../controller/read-card-skill-run-controller.js';
import { buildTaskExecutionPresentation } from '../helper/task-execution-presentation.js';
import { taskExecutionPresentationHttpResult } from '../helper/task-execution-presentation-http-result.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';

type RuntimeRecord = Record<string, unknown>;
type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;

type InternalTaskExecutionRoutesInput = {
  artifactFile: (projectId: string, requesterNodeId: string, hash: string) => string;
  authenticateNode: (nodeId: string) => boolean;
  baseRuntime: (executionId: string, projectId: string) => RuntimeRecord;
  localNodeId: string;
  request: IncomingMessage;
  response: ServerResponse;
  stateForProject: (projectId: string, requesterNodeId: string) => ExecutionState | null;
  url: URL;
};

function bindExecutionRuntime(input: {
  artifactFile: (hash: string) => string;
  baseRuntime: RuntimeRecord;
  localNodeId: string;
  state: ExecutionState;
}): RuntimeRecord {
  const runtime = Object.create(input.baseRuntime) as RuntimeRecord;
  Object.defineProperty(runtime, 'taskExecutionState', {
    value: input.state,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(runtime, 'taskExecutionNodeId', {
    value: input.localNodeId,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(runtime, 'taskExecutionArtifactFile', {
    value: input.artifactFile,
    configurable: true,
    enumerable: false,
  });
  return runtime;
}

function authenticate(input: InternalTaskExecutionRoutesInput): string {
  const requesterNodeId = String(input.request.headers['x-decision-os-federation-node'] ?? '').trim();
  if (requesterNodeId && input.authenticateNode(requesterNodeId)) return requesterNodeId;
  input.response.statusCode = 403;
  input.response.setHeader('content-type', 'application/json');
  input.response.end(JSON.stringify({ ok: false, error: 'federation_node_authentication_failed' }));
  return '';
}

export async function handleInternalTaskExecutionRoutes(
  input: InternalTaskExecutionRoutesInput,
): Promise<{ handled: boolean }> {
  const { request, response } = input;
  const requestPath = input.url.pathname;
  const route = requestPath.match(
    /^\/api\/internal\/task-executions\/([^/]+)\/(presentation|status|cancel)$/,
  );
  if (!route) return { handled: false };
  if ((route[2] === 'cancel' && request.method !== 'POST')
    || (route[2] !== 'cancel' && request.method !== 'GET')) {
    return { handled: false };
  }

  const requesterNodeId = authenticate(input);
  if (!requesterNodeId) return { handled: true };
  const executionId = decodeRouteSegment(route[1]);
  let projectId = input.url.searchParams.get('projectId') ?? '';

  if (route[2] === 'cancel') {
    let body: RuntimeRecord;
    try {
      body = JSON.parse((await readRequestBuffer(request)).toString('utf8') || '{}') as RuntimeRecord;
    } catch {
      response.statusCode = 400;
      response.end(JSON.stringify({ ok: false, error: 'invalid_json', executionId }));
      return { handled: true };
    }
    projectId = String(body.projectId ?? '').trim();
  }

  const state = projectId ? input.stateForProject(projectId, requesterNodeId) : null;
  const execution = state?.executions.find(executionId) ?? null;
  if (!state || (route[2] !== 'cancel' && !execution)) {
    response.statusCode = route[2] === 'cancel' ? 503 : 404;
    response.end(JSON.stringify({
      ok: false,
      error: route[2] === 'cancel'
        ? 'task_execution_state_unavailable'
        : 'task_execution_not_found',
      executionId,
    }));
    return { handled: true };
  }
  if (execution && execution.lifecycle.executorNodeId !== input.localNodeId) {
    response.statusCode = 409;
    response.end(JSON.stringify({
      ok: false,
      error: 'task_execution_wrong_executor',
      executionId,
      executorNodeId: execution.lifecycle.executorNodeId,
    }));
    return { handled: true };
  }

  const runtime = bindExecutionRuntime({
    artifactFile: (hash) => input.artifactFile(projectId, requesterNodeId, hash),
    baseRuntime: input.baseRuntime(executionId, projectId),
    localNodeId: input.localNodeId,
    state,
  });
  response.setHeader('content-type', 'application/json');

  if (route[2] === 'presentation') {
    const result = buildTaskExecutionPresentation({ executionId, state, runtime });
    const httpResult = taskExecutionPresentationHttpResult(executionId, result);
    response.statusCode = httpResult.statusCode;
    response.end(httpResult.body);
    return { handled: true };
  }
  if (route[2] === 'status') {
    const result = await readCardSkillRunController({
      action_payload: {
        runId: execution!.metadata.sessionId,
        ledgerId: execution!.metadata.ledgerId,
        cardId: execution!.metadata.ownerCardId,
        since: input.url.searchParams.get('since') ?? '0',
      },
      runtime_state: runtime,
    });
    response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
    response.end(JSON.stringify(result));
    return { handled: true };
  }
  const result = await cancelTaskExecutionLocally({ runtime, executionId });
  response.statusCode = result.statusCode;
  response.end(JSON.stringify(result));
  return { handled: true };
}
