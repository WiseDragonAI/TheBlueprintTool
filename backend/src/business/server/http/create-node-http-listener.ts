/**
 * WHAT: Owns the Node HTTP listener, request failure translation, and listen startup.
 * WHY: Socket lifecycle and transport errors must not be interleaved with application assembly.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { telemetry } from '@backend/telemetry/harness.js';
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import { RuntimeScopePausedError, type RuntimeIncident } from '../helper/runtime-incident-ledger.js';

export function createNodeHttpListener(input: {
  handleRequest: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
  host: string;
  onClose: () => void;
  onListening: (port: number) => void;
  port: number;
  recordIncident: (incident: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    code?: string;
    context?: Record<string, unknown>;
    severity?: RuntimeIncident['severity'];
  }) => RuntimeIncident;
  recordStoppedOperation: (operation: {
    scope: string;
    component: string;
    operation: string;
    error: unknown;
    context: Record<string, unknown>;
  }) => string;
  startupTasks: readonly Promise<void>[];
}) {
  const server = createServer((request, response) => {
    void input.handleRequest(request, response).catch((error: unknown) => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const paused = error instanceof RuntimeScopePausedError;
      const bootstrapIncomplete = isTaskStateBootstrapGate(error);
      const scope = `http-request:${request.method ?? 'UNKNOWN'}:${requestUrl.pathname}`;
      let incidentId = '';
      let incidentCode = 'runtime_error';
      if (paused) {
        incidentId = error.incidentId;
        incidentCode = error.code;
      } else if (bootstrapIncomplete) {
        incidentId = input.recordStoppedOperation({
          scope,
          component: 'http-server',
          operation: 'handle-request',
          error,
          context: { method: request.method ?? '', path: requestUrl.pathname },
        });
        incidentCode = 'task_state_bootstrap_incomplete';
      } else {
        const incident = input.recordIncident({
          scope,
          component: 'http-server',
          operation: 'handle-request',
          error,
          context: { method: request.method ?? '', path: requestUrl.pathname },
        });
        incidentId = incident.id;
        incidentCode = incident.code;
      }
      telemetry('http-request-failed', {
        method: request.method ?? '',
        path: requestUrl.pathname,
        statusCode: paused || bootstrapIncomplete ? 503 : 500,
        incidentId,
        code: incidentCode,
      });
      if (response.writableEnded) return;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.statusCode = paused || bootstrapIncomplete ? 503 : 500;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        ok: false,
        error: paused
          ? 'runtime-scope-paused'
          : bootstrapIncomplete
            ? 'task-state-bootstrap-incomplete'
            : 'internal-runtime-error',
        incidentId,
        scope: paused ? error.scope : scope,
      }));
    });
  });

  server.on('close', input.onClose);
  server.on('listening', () => {
    const address = server.address();
    input.onListening(address && typeof address === 'object' ? address.port : input.port);
  });
  server.on('error', (error: Error & { code?: string }) => {
    input.recordIncident({
      severity: 'fatal',
      scope: 'server-listener',
      component: 'http-server',
      operation: 'listen',
      code: error.code ?? 'server_listen_error',
      error,
      context: { host: input.host, port: input.port },
    });
  });
  // WHAT: Open HTTP after synchronous local-state construction without awaiting project recovery tasks.
  // WHY: Execution recovery is project-scoped background work and must not gate cards, health, or diagnostics.
  try {
    server.listen(input.port, input.host);
  } catch (error) {
    input.recordIncident({
      severity: 'fatal',
      scope: 'server-listener',
      component: 'http-server',
      operation: 'listen',
      error,
      context: { host: input.host, port: input.port },
    });
  }
  return server;
}
