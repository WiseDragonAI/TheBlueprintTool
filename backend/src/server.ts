/**
 * WHAT: Starts the backend root block HTTP server.
 * WHY: Operators need a direct runtime entrypoint for the implemented server controller.
 */
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { startHttpServerController } from '@backend/business/server/controller/start-http-server-controller.js';
import { decisionOsReleaseHealthIdentity, readDecisionOsSettings } from '@backend/business/server/helper/read-decision-os-settings.js';
import { createRuntimeIncidentLedger } from '@backend/business/server/helper/runtime-incident-ledger.js';

async function main(): Promise<void> {
  const runtime_state: Record<string, unknown> = {};
  let port = Number(process.env.PORT ?? 4173);
  let host = String(process.env.HOST ?? '127.0.0.1');
  try {
    const startupSettings = readDecisionOsSettings({ runtime_state });
    const settings = startupSettings.settings as Record<string, unknown>;
    port = Number(process.env.PORT ?? settings.port ?? 4173);
    host = String(process.env.HOST ?? settings.host ?? '127.0.0.1');

    const result = await startHttpServerController({
      action_payload: { mode: 'serve', port, host },
      runtime_state
    });
    console.log(JSON.stringify({ server: 'backend', ok: result.ok, url: `http://${host}:${port}` }));
  } catch (error) {
    const decisionOsRoot = resolve(process.cwd(), '.decision-os');
    const incidents = createRuntimeIncidentLedger({ decisionOsRoot });
    const incident = incidents.record({
      severity: 'fatal',
      scope: 'server-startup',
      component: 'server-entrypoint',
      operation: 'initialize-server',
      error,
      context: { cwd: process.cwd(), host, port },
    });
    const emergencyServer = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      response.setHeader('cache-control', 'no-store');
      response.setHeader('content-type', 'application/json');
      // WHAT: Keep health and incident diagnostics available from the backend emergency listener.
      // WHY: Startup failure containment must expose the same evaluation-time contract as the normal server.
      if (request.method === 'GET' && (path === '/api/health' || path === '/api/diagnostics/incidents')) {
        const observedAt = new Date().toISOString();
        const snapshot = incidents.snapshot();
        // WHAT: Expose no document truncation marker for a readable version-1 emergency snapshot.
        // WHY: Legacy history has no truthful global loss timestamp until a valid write upgrades it.
        const historyTruncatedBefore = snapshot.version === 2 ? snapshot.historyTruncatedBefore : '';
        response.end(JSON.stringify({
          ok: true,
          status: 'degraded',
          startupPaused: true,
          observedAt,
          ...decisionOsReleaseHealthIdentity(runtime_state.decisionOsSettings),
          incidentLedger: incidents.file,
          activeIncidentCount: snapshot.incidents.filter((entry) => entry.status === 'paused').length,
          // WHAT: Return versioned occurrence evidence only from the established incident diagnostics route.
          // WHY: Emergency health remains compact while diagnostics exposes the complete normal-mode schema.
          ...(path === '/api/diagnostics/incidents' ? {
            incidentHistoryVersion: snapshot.version,
            historyTruncatedBefore,
            incidents: snapshot.incidents,
          } : {}),
        }));
        return;
      }
      response.statusCode = 503;
      response.end(JSON.stringify({ ok: false, error: 'server-startup-paused', incidentId: incident.id, scope: incident.scope }));
    });
    emergencyServer.on('error', (listenerError: Error & { code?: string }) => {
      incidents.record({
        severity: 'fatal',
        scope: 'server-listener',
        component: 'server-entrypoint',
        operation: 'listen-emergency-server',
        code: listenerError.code,
        error: listenerError,
        context: { host, port },
      });
    });
    emergencyServer.listen(port, host, () => {
      console.log(JSON.stringify({ server: 'backend', ok: false, degraded: true, url: `http://${host}:${port}`, incidentId: incident.id }));
    });
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ server: 'backend', ok: false, fatal: true, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
