/**
 * WHAT: Builds the local and federated Control Room read model.
 * WHY: Projection assembly belongs to the Control Room endpoint, not server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TaskExecutionObservation } from '../../../../../shared/schemas/task-execution-types.js';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import { createTaskExecutionRepository } from '../../task-state/helper/task-execution-repository.js';
import type { ProjectSyncRun } from '../../project-sync/helper/project-sync-types.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import type { createControlRoomProjectionStore } from '../helper/control-room-projection-store.js';
import {
  controlRoomProjectionFromTaskLedger,
  withProjectSyncRuns,
} from '../helper/control-room-projection-store.js';
import { federatedControlRoomProjection } from '../helper/federated-control-room-projection.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from './http-route.js';

type AnyRecord = Record<string, unknown>;

export function handleControlRoomRoutes(input: {
  controlRoomProjectionStore: ReturnType<typeof createControlRoomProjectionStore>;
  executionObservation: (
    projectId: string,
    executionId: string,
    ownerNodeId: string,
  ) => TaskExecutionObservation | null;
  federation: ReturnType<typeof createFederationNodeConnector>;
  hydrateProject: (project: DecisionOsProject) => void;
  listProjectSyncRuns: () => ProjectSyncRun[];
  projectScope: unknown;
  projects: DecisionOsProject[];
  request: IncomingMessage;
  requestUrl: URL;
  response: ServerResponse;
  taskStoreForProject: (projectId: string, ownerNodeId: string) => TaskCurrentStateStore | null;
  url: string;
}): HttpRouteOutcome {
  if (input.projectScope || input.url !== '/api/control-room' || input.request.method !== 'GET') {
    return HTTP_ROUTE_NEXT;
  }

  for (const project of input.projects) {
    if (project.available) input.hydrateProject(project);
  }
  const projection = input.controlRoomProjectionStore.get(
    input.projects.filter((project) => project.available),
  );
  const localOwner = input.federation.localOwner();
  const remoteDiagnostics: AnyRecord[] = [];
  const remoteProjectIdentity = new Map(input.federation.remoteProjects().map((project) => [
    `${project.ownerNodeId}\0${project.localProjectId}`,
    project.originFingerprint,
  ]));
  const remoteProjections = input.requestUrl.searchParams.get('localOnly') === '1'
    ? []
    : input.federation.remoteProjects().flatMap((project) => {
      const store = input.taskStoreForProject(project.localProjectId, project.ownerNodeId);
      if (!store || store.diagnostics().entityCount === 0) return [];
      const executionRepository = createTaskExecutionRepository({
        store,
        writerId: project.ownerNodeId,
        projectId: project.localProjectId,
      });
      return [{
        projection: controlRoomProjectionFromTaskLedger({
          project: {
            ...project,
            id: project.localProjectId,
            originFingerprint: remoteProjectIdentity.get(
              `${project.ownerNodeId}\0${project.localProjectId}`,
            ) ?? project.originFingerprint,
          },
          ledger: store.projection().ledger,
          conflicts: store.projection().conflicts,
          executions: executionRepository.all(),
          executionDiagnostics: executionRepository.diagnostics(),
          executionObservationFor: (executionId) => (
            input.executionObservation(project.localProjectId, executionId, project.ownerNodeId)
          ),
        }),
        owner: {
          nodeId: project.ownerNodeId,
          nodeLabel: project.ownerNodeLabel,
          remote: true,
          online: project.online,
        },
      }];
    });
  const publicProjection = withProjectSyncRuns(federatedControlRoomProjection({
    localProjection: projection,
    localOwner: {
      nodeId: localOwner.ownerNodeId,
      nodeLabel: localOwner.ownerNodeLabel,
      remote: false,
    },
    remoteProjections,
    diagnostics: remoteDiagnostics,
  }), input.listProjectSyncRuns());
  const etag = `"${String(publicProjection.fingerprint)}"`;
  if (input.request.headers['if-none-match'] === etag) {
    input.response.statusCode = 304;
    input.response.setHeader('etag', etag);
    input.response.end();
    return HTTP_ROUTE_HANDLED;
  }
  delete publicProjection.dependencies;
  delete publicProjection.projectSlices;
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  input.response.setHeader('etag', etag);
  input.response.end(JSON.stringify(publicProjection));
  return HTTP_ROUTE_HANDLED;
}
