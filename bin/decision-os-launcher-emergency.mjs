/**
 * WHAT: Keeps health and incident diagnostics online when the TypeScript server child cannot run.
 * WHY: Import, loader, and pre-entrypoint failures occur before the backend can start its own emergency server.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const maximumIncidents = 100;

function decisionOsRootFrom(start) {
  let current = resolve(start);
  while (true) {
    const candidate = resolve(current, '.decision-os');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return resolve(start, '.decision-os');
    current = parent;
  }
}

function emptyLedger() {
  return { version: 1, updatedAt: '', incidents: [] };
}

function validLedger(value) {
  return value && value.version === 1 && Array.isArray(value.incidents);
}

function writeAtomic(file, document) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function readLedger(file) {
  if (!existsSync(file)) return emptyLedger();
  try {
    const document = JSON.parse(readFileSync(file, 'utf8'));
    if (!validLedger(document)) throw new Error('invalid_launcher_incident_ledger');
    return document;
  } catch (error) {
    const observedAt = new Date().toISOString();
    const backup = `${file}.corrupt-${observedAt.replace(/[:.]/g, '-')}`;
    try { renameSync(file, backup); } catch { /* The original remains available when backup creation fails. */ }
    const message = error instanceof Error ? error.message : String(error);
    return {
      version: 1,
      updatedAt: observedAt,
      incidents: [{
        id: `launcher-incident-${randomUUID()}`,
        fingerprint: createHash('sha256').update(`launcher-incident-ledger\0${message}`).digest('hex'),
        status: 'paused',
        severity: 'fatal',
        scope: 'server-launcher',
        component: 'decision-os-launcher',
        operation: 'read-launcher-incident-ledger',
        code: 'launcher_incident_ledger_corrupt',
        message,
        stack: error instanceof Error ? String(error.stack ?? '').slice(0, 16_000) : '',
        context: { backup },
        firstObservedAt: observedAt,
        lastObservedAt: observedAt,
        occurrences: 1,
        resolvedAt: '',
      }],
    };
  }
}

function recordIncident(file, input) {
  const document = readLedger(file);
  const observedAt = new Date().toISOString();
  const error = input.error instanceof Error ? input.error : new Error(String(input.error));
  const fingerprint = createHash('sha256').update(JSON.stringify({
    scope: 'server-launcher',
    operation: input.operation,
    code: input.code,
    message: error.message,
  })).digest('hex');
  let incident = document.incidents.find((entry) => entry.status === 'paused' && entry.fingerprint === fingerprint);
  if (!incident) {
    incident = {
      id: `launcher-incident-${randomUUID()}`,
      fingerprint,
      status: 'paused',
      severity: 'fatal',
      scope: 'server-launcher',
      component: 'decision-os-launcher',
      operation: input.operation,
      code: input.code,
      message: error.message.slice(0, 2_000),
      stack: String(error.stack ?? '').slice(0, 16_000),
      context: input.context,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      occurrences: 0,
      resolvedAt: '',
    };
    document.incidents.push(incident);
  }
  incident.lastObservedAt = observedAt;
  incident.occurrences += 1;
  document.incidents = document.incidents.slice(-maximumIncidents);
  document.updatedAt = observedAt;
  writeAtomic(file, document);
  return incident;
}

export function launcherEmergencyHealthPayload(input) {
  return {
    ok: true,
    status: 'degraded',
    startupPaused: true,
    launcherEmergency: true,
    releaseSha: String(input.releaseIdentity?.releaseSha ?? ''),
    processStartedAt: String(input.releaseIdentity?.processStartedAt ?? new Date().toISOString()),
    deliveryProtocol: Number(input.releaseIdentity?.deliveryProtocol ?? 0),
    activeReleasePointer: String(input.releaseIdentity?.activeReleasePointer ?? 'unbootstrapped'),
    incidentLedger: input.incidentLedger,
    incidentPersistenceError: input.incidentPersistenceError,
    activeIncidentCount: input.activeIncidentCount,
  };
}

export function startLauncherEmergencyServer(input) {
  const decisionOsRoot = decisionOsRootFrom(input.cwd);
  const incidentFile = resolve(decisionOsRoot, 'runtime-incidents.json');
  let incident;
  let incidentPersistenceError = '';
  try {
    incident = recordIncident(incidentFile, {
      operation: 'run-server-child',
      code: input.code,
      error: input.error,
      context: {
        cwd: input.cwd,
        host: input.host,
        port: input.port,
        childExitCode: input.childExitCode ?? null,
        childSignal: input.childSignal ?? '',
        restartAttempts: input.restartAttempts ?? 0,
        restartDelaysMs: input.restartDelaysMs ?? [],
      },
    });
  } catch (error) {
    incidentPersistenceError = error instanceof Error ? error.message : String(error);
    const observedAt = new Date().toISOString();
    incident = {
      id: `launcher-incident-${randomUUID()}`,
      fingerprint: '',
      status: 'paused',
      severity: 'fatal',
      scope: 'server-launcher',
      component: 'decision-os-launcher',
      operation: 'run-server-child',
      code: input.code,
      message: input.error instanceof Error ? input.error.message : String(input.error),
      stack: input.error instanceof Error ? String(input.error.stack ?? '').slice(0, 16_000) : '',
      context: { incidentPersistenceError },
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      occurrences: 1,
      resolvedAt: '',
    };
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET' && (path === '/api/health' || path === '/api/diagnostics/incidents')) {
      let document;
      try { document = readLedger(incidentFile); }
      catch { document = { version: 1, updatedAt: incident.lastObservedAt, incidents: [incident] }; }
      response.end(JSON.stringify({
        ...launcherEmergencyHealthPayload({
          releaseIdentity: input.releaseIdentity,
          incidentLedger: incidentFile,
          incidentPersistenceError,
          activeIncidentCount: document.incidents.filter((entry) => entry.status === 'paused').length,
        }),
        ...(path === '/api/diagnostics/incidents' ? { incidents: document.incidents } : {}),
      }));
      return;
    }
    response.statusCode = 503;
    response.end(JSON.stringify({ ok: false, error: 'server-launcher-paused', incidentId: incident.id, scope: incident.scope }));
  });
  server.on('error', (error) => {
    try {
      recordIncident(incidentFile, {
        operation: 'listen-launcher-emergency',
        code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'launcher_emergency_listen_error',
        error,
        context: { cwd: input.cwd, host: input.host, port: input.port },
      });
    } catch (recordError) {
      process.stderr.write(`${JSON.stringify({ launcherEmergency: false, error: recordError instanceof Error ? recordError.message : String(recordError) })}\n`);
    }
    process.exitCode = 1;
  });
  server.listen(input.port, input.host, () => {
    process.stdout.write(`${JSON.stringify({ server: 'launcher-emergency', ok: false, degraded: true, url: `http://${input.host}:${input.port}`, incidentId: incident.id })}\n`);
  });
  return { server, incident, incidentFile };
}
