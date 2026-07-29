import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import {
  TaskExecutionAdmissionError,
  type TaskExecutionLaunchRequest,
  type TaskExecutionRouter,
} from '../helper/task-execution-router.js';
import {
  installRemotePipelineRun,
  removeInstalledRemotePipelineRun,
} from '../helper/install-remote-pipeline-run.js';

type AnyRecord = Record<string, unknown>;

export async function handleFederatedExecutionAdmissionRoutes(input: {
  authenticateNode: (nodeId: string) => boolean;
  project: DecisionOsProject | null;
  projectScoped: boolean;
  recordFailure: (input: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: AnyRecord;
  }) => string;
  request: IncomingMessage;
  response: ServerResponse;
  router: (project: DecisionOsProject) => TaskExecutionRouter;
  runtime: (project: DecisionOsProject) => AnyRecord;
  url: string;
}): Promise<{ handled: boolean }> {
  const route = input.projectScoped
    && input.project
    && (input.url === '/api/internal/task-executions/admit'
      || input.url === '/api/internal/task-executions/admit-batch')
    && input.request.method === 'POST';
  if (!route || !input.project) return { handled: false };

  input.response.setHeader('content-type', 'application/json');
  const requesterNodeId = String(
    input.request.headers['x-decision-os-federation-node'] ?? '',
  ).trim();
  if (!requesterNodeId || !input.authenticateNode(requesterNodeId)) {
    input.response.statusCode = 403;
    input.response.end(JSON.stringify({
      ok: false,
      error: 'federation_node_authentication_failed',
    }));
    return { handled: true };
  }

  let installedPipelineRunId = '';
  try {
    const body = JSON.parse(
      (await readRequestBuffer(input.request)).toString('utf8') || '{}',
    ) as AnyRecord;
    const batch = input.url.endsWith('/admit-batch');
    const requests = Array.isArray(body.requests)
      ? body.requests as TaskExecutionLaunchRequest[]
      : [];
    if (batch) {
      try {
        const installed = installRemotePipelineRun({
          decisionOsRoot: input.project.decisionOsRoot,
          runtime: input.runtime(input.project),
          run: body.pipelineRun as CodexPipelineRun,
          requests,
        });
        if (installed.installed) installedPipelineRunId = installed.run.id;
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'task_execution_pipeline_manifest_invalid';
        const code = message.split(':')[0] || 'task_execution_pipeline_manifest_invalid';
        throw new TaskExecutionAdmissionError(
          code,
          code.endsWith('_conflict') ? 409 : 400,
          { pipelineRunId: String((body.pipelineRun as AnyRecord | undefined)?.id ?? '') },
          message,
        );
      }
    }
    const router = input.router(input.project);
    const receipts = batch
      ? await router.admitLocalBatch(requests)
      : [await router.admitLocal(body as TaskExecutionLaunchRequest)];
    input.response.statusCode = 202;
    input.response.end(JSON.stringify(batch
      ? { ok: true, receipts }
      : { ok: true, receipt: receipts[0] }));
  } catch (error) {
    if (installedPipelineRunId) {
      try {
        removeInstalledRemotePipelineRun({
          decisionOsRoot: input.project.decisionOsRoot,
          runId: installedPipelineRunId,
        });
      } catch (cleanupError) {
        input.recordFailure({
          scope: `task-execution-manifest-cleanup:${input.project.id}:${installedPipelineRunId}`,
          component: 'task-execution-router',
          operation: 'remove-rejected-remote-pipeline-manifest',
          error: cleanupError,
          context: {
            projectId: input.project.id,
            requesterNodeId,
            pipelineRunId: installedPipelineRunId,
          },
        });
      }
    }
    const expected = error instanceof TaskExecutionAdmissionError;
    const syntax = error instanceof SyntaxError;
    input.response.statusCode = expected ? error.statusCode : syntax ? 400 : 500;
    const incidentId = !expected && !syntax
      ? input.recordFailure({
        scope: `task-execution-admission:${input.project.id}:${requesterNodeId}`,
        component: 'task-execution-router',
        operation: 'admit-federated-task-execution',
        error,
        context: { projectId: input.project.id, requesterNodeId },
      })
      : '';
    input.response.end(JSON.stringify({
      ok: false,
      error: expected
        ? error.code
        : syntax
          ? 'invalid_json'
          : 'task_execution_admission_failed',
      ...(expected ? { context: error.context } : {}),
      ...(incidentId ? { incidentId } : {}),
    }));
  }
  return { handled: true };
}
