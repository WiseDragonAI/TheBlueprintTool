/**
 * WHAT: Owns one task-execution admission router per local project.
 * WHY: Remote admission and scheduler wake-up are Codex runtime coordination, not HTTP concerns.
 */
import type { TaskEntityChange } from '../../task-state/helper/task-current-state-types.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import {
  TaskExecutionAdmissionError,
  createTaskExecutionRouter,
  isTaskExecutionReceipt,
  type TaskExecutionRouter,
} from '../helper/task-execution-router.js';
import type { LocalTaskRuntime } from '../../task-state/runtime/local-task-runtime.js';
import type { IncidentSupervisor } from '../../server/runtime/incident-supervisor.js';

type AnyRecord = Record<string, unknown>;
type ProjectionEntityChange = {
  entityType: TaskEntityChange['entityType'];
  entityId: string;
};

function remoteAdmissionError(
  body: AnyRecord,
  nodeId: string,
  status: number,
): TaskExecutionAdmissionError {
  const remoteCode = String(body.error ?? 'task_execution_remote_admission_failed');
  const code = remoteCode === 'owner_offline' || remoteCode === 'federation_request_timeout'
    ? 'assigned_node_unreachable'
    : remoteCode;
  return new TaskExecutionAdmissionError(code, code !== remoteCode ? 503 : status || 502, {
    assignedNodeId: nodeId,
    ...(code !== remoteCode ? { remoteError: remoteCode } : {}),
    ...(body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? body.context as AnyRecord
      : {}),
  });
}

function parseRemoteBody(body: Buffer, nodeId: string, status: number): AnyRecord {
  try {
    return JSON.parse(body.toString('utf8') || '{}') as AnyRecord;
  } catch {
    throw new TaskExecutionAdmissionError(
      'task_execution_remote_response_invalid',
      502,
      { assignedNodeId: nodeId, remoteStatus: status },
    );
  }
}

export function createTaskExecutionRouterRegistry(input: {
  capacity: () => number;
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
  incidentSupervisor: IncidentSupervisor;
  invalidateProject: (projectId: string, entities: readonly ProjectionEntityChange[]) => void;
  localNodeId: () => string;
  localTaskRuntime: LocalTaskRuntime;
  schedule: () => Promise<AnyRecord>;
}) {
  const routers = new Map<string, TaskExecutionRouter>();

  const forProject = (project: DecisionOsProject): TaskExecutionRouter => {
    const existing = routers.get(project.id);
    if (existing) return existing;
    const router = createTaskExecutionRouter({
      projectId: project.id,
      state: () => input.localTaskRuntime.stateForProject(project),
      localNodeId: input.localNodeId,
      peer: (nodeId) => input.federation()?.nodes().find((node) => node.nodeId === nodeId) ?? null,
      localCapacity: input.capacity,
      dispatchRemote: async (nodeId, launch) => {
        const federation = input.federation();
        if (!federation) {
          throw new TaskExecutionAdmissionError(
            'assigned_node_unreachable',
            503,
            { assignedNodeId: nodeId },
          );
        }
        const remote = await federation.request(
          nodeId,
          `/p/${encodeURIComponent(project.id)}/api/internal/task-executions/admit`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: Buffer.from(JSON.stringify(launch)),
          },
        );
        const body = parseRemoteBody(remote.body, nodeId, remote.status);
        if (remote.status < 200 || remote.status >= 300 || body.ok === false) {
          throw remoteAdmissionError(body, nodeId, remote.status);
        }
        if (!isTaskExecutionReceipt(body.receipt)) {
          throw new TaskExecutionAdmissionError(
            'task_execution_remote_response_invalid',
            502,
            { assignedNodeId: nodeId, remoteStatus: remote.status },
          );
        }
        return body.receipt;
      },
      dispatchRemoteBatch: async (nodeId, launches, context) => {
        const federation = input.federation();
        if (!federation) {
          throw new TaskExecutionAdmissionError(
            'assigned_node_unreachable',
            503,
            { assignedNodeId: nodeId },
          );
        }
        const remote = await federation.request(
          nodeId,
          `/p/${encodeURIComponent(project.id)}/api/internal/task-executions/admit-batch`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: Buffer.from(JSON.stringify({
              requests: launches,
              pipelineRun: context.pipelineRun,
            })),
          },
        );
        const body = parseRemoteBody(remote.body, nodeId, remote.status);
        if (remote.status < 200 || remote.status >= 300 || body.ok === false) {
          throw remoteAdmissionError(body, nodeId, remote.status);
        }
        const receipts = Array.isArray(body.receipts) ? body.receipts : [];
        if (receipts.length !== launches.length || !receipts.every(isTaskExecutionReceipt)) {
          throw new TaskExecutionAdmissionError(
            'task_execution_remote_response_invalid',
            502,
            { assignedNodeId: nodeId, remoteStatus: remote.status },
          );
        }
        return receipts;
      },
      onCommitted: (record) => {
        input.invalidateProject(project.id, [{
          entityType: 'execution',
          entityId: record.metadata.executionId,
        }]);
        if (!input.incidentSupervisor.pausedBackgroundComponents.has('codex-process-scheduler')) {
          void input.schedule().catch((error: unknown) => {
            input.incidentSupervisor.recordBackgroundFailure(
              'codex-process-scheduler',
              'schedule-after-task-execution-admission',
              error,
              {
                projectId: project.id,
                executionId: record.metadata.executionId,
              },
            );
          });
        }
      },
      onFailure: (error, context) => {
        input.incidentSupervisor.recordStoppedOperation({
          scope: `codex-execution-admission:${project.id}:${String(context.executionId ?? 'unknown')}`,
          component: 'task-execution-router',
          operation: String(context.operation ?? 'task-execution-admission'),
          error,
          context: { projectId: project.id, ...context },
        });
      },
    });
    routers.set(project.id, router);
    return router;
  };

  return { forProject, routers };
}
