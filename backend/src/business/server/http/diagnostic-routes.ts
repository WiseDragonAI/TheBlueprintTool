/**
 * WHAT: Serves failsafe health and durable incident diagnostics.
 * WHY: Diagnostics must stay readable before project admission and global pause checks.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IncidentSupervisor } from '../runtime/incident-supervisor.js';
import type { RuntimeIncidentLedger } from '../helper/runtime-incident-ledger.js';
import { decisionOsReleaseHealthIdentity } from '../helper/read-decision-os-settings.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from './http-route.js';

export function handleDiagnosticReadRoutes(input: {
  incidentLedger: RuntimeIncidentLedger;
  incidentSupervisor: IncidentSupervisor;
  request: IncomingMessage;
  requestPath: string;
  response: ServerResponse;
  settings: unknown;
}): HttpRouteOutcome {
  if ((input.requestPath !== '/api/health'
      && input.requestPath !== '/api/diagnostics/incidents')
    || input.request.method !== 'GET') {
    return HTTP_ROUTE_NEXT;
  }

  const incidentSnapshot = input.incidentLedger.snapshot();
  const activeIncidents = incidentSnapshot.incidents.filter((incident) => incident.status === 'paused');
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  input.response.end(JSON.stringify({
    ok: true,
    status: activeIncidents.length > 0 ? 'degraded' : 'ready',
    observedAt: new Date().toISOString(),
    ...decisionOsReleaseHealthIdentity(input.settings),
    incidentLedger: input.incidentLedger.file,
    activeIncidentCount: activeIncidents.length,
    pausedTaskProjectIds: [...input.incidentSupervisor.pausedTaskProjects.keys()].sort(),
    pausedFederatedTaskProjectIds: [
      ...input.incidentSupervisor.pausedFederatedTaskProjects.keys(),
    ].sort(),
    pausedBackgroundComponents: [
      ...input.incidentSupervisor.pausedBackgroundComponents,
    ].sort(),
    pausedProjectWatcherIds: [...input.incidentSupervisor.pausedProjectWatchers].sort(),
    pausedProjectRuntimeIds: [...input.incidentSupervisor.pausedProjectRuntimes].sort(),
    ...(input.requestPath === '/api/diagnostics/incidents'
      ? { incidents: incidentSnapshot.incidents }
      : {}),
  }));
  return HTTP_ROUTE_HANDLED;
}
