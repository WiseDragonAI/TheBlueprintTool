/**
 * WHAT: Admits requests through failsafe, project-scope, remote, and global routes in preserved order.
 * WHY: Diagnostics and remote ownership must be decided before any local project runtime is constructed.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DecisionOsProject } from '../helper/project-catalog.js';
import {
  isGlobalProjectEndpoint,
  isProjectSensitiveEndpoint,
  parseProjectUrlScope,
  type ProjectUrlScope,
} from '../helper/project-url-scope.js';
import { handleRuntimeRecoveryRoute } from './runtime-recovery-route.js';
import { handleDiagnosticReadRoutes } from './diagnostic-routes.js';
import { handleDeliveryRoutes } from '../../delivery/http/delivery-routes.js';
import { handleInternalTaskExecutionRoutes } from '../../codex/http/internal-task-execution-routes.js';
import { handleRemoteProjectGateway } from '../../federation/http/remote-project-gateway.js';
import { handleMarkdownTargetRoutes } from '../../content-authoring/http/markdown-target-routes.js';
import { handleFederatedExecutionAdmissionRoutes } from '../../codex/http/federated-execution-admission-routes.js';
import { handleNodeMessageRoutes } from '../../federation/http/node-message-routes.js';
import { handleGitReviewRoutes } from '../../git-review/http/git-review-routes.js';
import { handleControlRoomRoutes } from './control-room-routes.js';

type RecoveryInput = Parameters<typeof handleRuntimeRecoveryRoute>[0];
type DiagnosticInput = Parameters<typeof handleDiagnosticReadRoutes>[0];
type DeliveryInput = Parameters<typeof handleDeliveryRoutes>[0];
type InternalInput = Parameters<typeof handleInternalTaskExecutionRoutes>[0];
type RemoteInput = Parameters<typeof handleRemoteProjectGateway>[0];
type MarkdownInput = Parameters<typeof handleMarkdownTargetRoutes>[0];
type AdmissionInput = Parameters<typeof handleFederatedExecutionAdmissionRoutes>[0];
type NodeMessageInput = Parameters<typeof handleNodeMessageRoutes>[0];
type ControlRoomInput = Parameters<typeof handleControlRoomRoutes>[0];

export type AdmittedProjectRequest = {
  activeProject: DecisionOsProject | null;
  projectScope: ProjectUrlScope | null;
  projects: DecisionOsProject[];
  requestPath: string;
  requestUrl: URL;
  url: string;
};

export async function handleGlobalRequestStage(input: {
  controlRoom: Omit<ControlRoomInput, 'projectScope' | 'projects' | 'request' | 'requestUrl' | 'response' | 'url'>;
  delivery: Omit<DeliveryInput, 'request' | 'response' | 'url'>;
  diagnostics: Omit<DiagnosticInput, 'request' | 'requestPath' | 'response'>;
  federationLocalNodeId: () => string;
  gitReview: Omit<Parameters<typeof handleGitReviewRoutes>[0], 'activeProject' | 'request' | 'requestUrl' | 'response' | 'url'>;
  internalExecution: Omit<InternalInput, 'request' | 'response' | 'url'>;
  markdown: Omit<MarkdownInput, 'projectId' | 'projectRoot' | 'request' | 'requestPath' | 'response' | 'scopedPath'>;
  masterDecisionOsRoot: string;
  nodeMessages: Omit<NodeMessageInput, 'projectScoped' | 'projects' | 'request' | 'response' | 'url'>;
  projectAdmission: Omit<AdmissionInput, 'project' | 'projectScoped' | 'request' | 'response' | 'url'>;
  projects: () => DecisionOsProject[];
  recovery: Omit<RecoveryInput, 'request' | 'response' | 'url'>;
  remoteGateway: Omit<RemoteInput, 'ownerNodeId' | 'projectId' | 'remoteProject' | 'request' | 'response' | 'scopedPath' | 'url'> & {
    remoteProject(ownerNodeId: string, projectId: string): RemoteInput['remoteProject'];
  };
  request: IncomingMessage;
  resolveProject(projectId: string): DecisionOsProject | null;
  response: ServerResponse;
}): Promise<{ handled: true } | { handled: false; request: AdmittedProjectRequest }> {
  const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
  const requestPath = requestUrl.pathname;
  const recovery = await handleRuntimeRecoveryRoute({
    ...input.recovery,
    request: input.request,
    response: input.response,
    url: requestPath,
  });
  if (recovery.handled) return { handled: true };
  const diagnostics = handleDiagnosticReadRoutes({
    ...input.diagnostics,
    request: input.request,
    requestPath,
    response: input.response,
  });
  if (diagnostics.handled) return { handled: true };
  const delivery = await handleDeliveryRoutes({
    ...input.delivery,
    request: input.request,
    response: input.response,
    url: requestPath,
  });
  if (delivery.handled) return { handled: true };
  const projectScope = parseProjectUrlScope(requestPath);
  if (requestPath.startsWith('/p/') && !projectScope) {
    input.response.statusCode = 400;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, error: 'Malformed project URL.' }));
    return { handled: true };
  }
  const projects = input.projects();
  const activeProject = projectScope
    ? input.resolveProject(projectScope.projectId)
    : projects.length === 1 && isProjectSensitiveEndpoint(requestPath)
      && !isGlobalProjectEndpoint(requestPath)
      ? projects[0]!
      : null;
  const internal = await handleInternalTaskExecutionRoutes({
    ...input.internalExecution,
    request: input.request,
    response: input.response,
    url: requestUrl,
  });
  if (internal.handled) return { handled: true };
  const requestedReplicaNodeId = String(input.request.headers['x-decision-os-replica-node']
    ?? (input.request.method === 'GET' ? requestUrl.searchParams.get('replica') : '')
    ?? '').trim();
  const localNodeId = input.federationLocalNodeId();
  if (projectScope && !activeProject && requestedReplicaNodeId && requestedReplicaNodeId !== localNodeId) {
    await handleRemoteProjectGateway({
      ...input.remoteGateway,
      ownerNodeId: requestedReplicaNodeId,
      projectId: projectScope.projectId,
      remoteProject: input.remoteGateway.remoteProject(requestedReplicaNodeId, projectScope.projectId),
      request: input.request,
      response: input.response,
      scopedPath: projectScope.scopedPath,
      url: requestUrl,
    });
    return { handled: true };
  }
  const url = projectScope && isProjectSensitiveEndpoint(projectScope.scopedPath)
    ? projectScope.scopedPath
    : requestPath;
  if (requestPath === '/api/federation/task-replica') {
    input.response.statusCode = 404;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, error: 'The hydrated task replica endpoint has been retired.' }));
    return { handled: true };
  }
  if (projectScope && !activeProject) {
    input.response.statusCode = 404;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, error: 'Unknown project id.' }));
    return { handled: true };
  }
  if (projectScope && activeProject && !activeProject.available) {
    input.response.statusCode = 503;
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({ ok: false, error: activeProject.diagnostic, projectId: activeProject.id }));
    return { handled: true };
  }
  const markdown = handleMarkdownTargetRoutes({
    ...input.markdown,
    projectId: projectScope?.projectId,
    projectRoot: activeProject?.decisionOsRoot,
    request: input.request,
    requestPath,
    response: input.response,
    scopedPath: projectScope?.scopedPath,
  });
  if (markdown.handled) return { handled: true };
  const admission = await handleFederatedExecutionAdmissionRoutes({
    ...input.projectAdmission,
    project: activeProject,
    projectScoped: Boolean(projectScope),
    request: input.request,
    response: input.response,
    url,
  });
  if (admission.handled) return { handled: true };
  const nodeMessages = await handleNodeMessageRoutes({
    ...input.nodeMessages,
    projectScoped: Boolean(projectScope),
    projects,
    request: input.request,
    response: input.response,
    url,
  });
  if (nodeMessages.handled) return { handled: true };
  const gitReview = await handleGitReviewRoutes({
    ...input.gitReview,
    activeProject,
    request: input.request,
    requestUrl,
    response: input.response,
    url,
  });
  if (gitReview.handled) return { handled: true };
  const controlRoom = handleControlRoomRoutes({
    ...input.controlRoom,
    projectScope,
    projects,
    request: input.request,
    requestUrl,
    response: input.response,
    url,
  });
  if (controlRoom.handled) return { handled: true };
  if (input.request.method === 'GET') {
    const query = (input.request.url ?? '').includes('?')
      ? `?${(input.request.url ?? '').split('?').slice(1).join('?')}`
      : '';
    let destination = '';
    if (requestPath === '/control-room' || projectScope?.scopedPath === '/control-room') destination = `/${query}`;
    if (projectScope?.scopedPath === '/projects') destination = `/projects${query}`;
    if (projectScope?.scopedPath.startsWith('/projects/')) destination = `${projectScope.scopedPath}${query}`;
    if (destination) {
      input.response.statusCode = 302;
      input.response.setHeader('location', destination);
      input.response.end();
      return { handled: true };
    }
  }
  return {
    handled: false,
    request: { activeProject, projectScope, projects, requestPath, requestUrl, url },
  };
}
