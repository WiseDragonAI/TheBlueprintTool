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
      && input.requestPath !== '/api/diagnostics/incidents'
      && input.requestPath !== '/api/diagnostics/frontend-telemetry-config')
    || input.request.method !== 'GET') {
    return HTTP_ROUTE_NEXT;
  }

  const observedAt = new Date().toISOString();
  const settings = input.settings && typeof input.settings === 'object'
    ? input.settings as Record<string, unknown>
    : {};
  // WHAT: Serve only the browser telemetry enablement contract on its dedicated configuration route.
  // WHY: The frontend must discover the opt-in without receiving backend credentials or unrelated settings.
  if (input.requestPath === '/api/diagnostics/frontend-telemetry-config') {
    input.response.setHeader('cache-control', 'no-store');
    input.response.setHeader('content-type', 'application/json');
    input.response.end(JSON.stringify({
      ok: true,
      enabled: settings.frontendTelemetryWebSocketEnabled === true,
      endpoint: '/api/diagnostics/frontend-telemetry',
    }));
    return HTTP_ROUTE_HANDLED;
  }
  const incidentSnapshot = input.incidentLedger.snapshot();
  // WHAT: Expose no document truncation marker for a legacy version-1 snapshot.
  // WHY: Legacy uncertainty is identified by its version and must not be represented as a fabricated loss timestamp.
  const historyTruncatedBefore = incidentSnapshot.version === 2 ? incidentSnapshot.historyTruncatedBefore : '';
  const activeIncidents = incidentSnapshot.incidents.filter((incident) => incident.status === 'paused');
  const runtimeInterrupted = activeIncidents.some((incident) => incident.scope === 'server-runtime')
    || input.incidentSupervisor.pausedTaskProjects.size > 0
    || input.incidentSupervisor.pausedFederatedTaskProjects.size > 0
    || input.incidentSupervisor.pausedBackgroundComponents.size > 0
    || input.incidentSupervisor.pausedProjectWatchers.size > 0
    || input.incidentSupervisor.pausedProjectRuntimes.size > 0
    || input.incidentSupervisor.pausedFederationRepairs.size > 0;
  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  input.response.end(JSON.stringify({
    ok: true,
    status: runtimeInterrupted ? 'degraded' : 'ready',
    observedAt,
    ...decisionOsReleaseHealthIdentity(settings),
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
    pausedFederationRepairProjectIds: [...input.incidentSupervisor.pausedFederationRepairs.keys()].sort(),
    // WHAT: Include durable occurrence history and its completeness markers only on the existing incident endpoint.
    // WHY: Health retains its compact interruption contract while diagnostics remains the single incident evidence source.
    ...(input.requestPath === '/api/diagnostics/incidents'
      ? {
        incidentHistoryVersion: incidentSnapshot.version,
        historyTruncatedBefore,
        incidents: incidentSnapshot.incidents,
      }
      : {}),
  }));
  return HTTP_ROUTE_HANDLED;
}
