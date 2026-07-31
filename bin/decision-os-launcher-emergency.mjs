/**
 * WHAT: Keeps health and incident diagnostics online when the TypeScript server child cannot run.
 * WHY: Import, loader, and pre-entrypoint failures occur before the backend can start its own emergency server.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const maximumIncidents = 500;
const maximumObservationsPerIncident = 1_000;
const incidentHistoryWindowMs = 24 * 60 * 60 * 1_000;

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
  return { version: 2, updatedAt: '', historyTruncatedBefore: '', incidents: [] };
}

function validIsoTimestamp(value) {
  // WHAT: Reject non-string launcher observations before parsing durable history.
  // WHY: The emergency writer must enforce the same deterministic version-2 timestamp contract as the backend writer.
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validLegacyIncident(incident) {
  return incident && typeof incident === 'object'
    && typeof incident.id === 'string'
    && typeof incident.fingerprint === 'string'
    && (incident.status === 'paused' || incident.status === 'resolved')
    && typeof incident.scope === 'string'
    && typeof incident.code === 'string'
    && typeof incident.message === 'string'
    && Number.isInteger(incident.occurrences);
}

function validCurrentIncident(incident) {
  return validLegacyIncident(incident)
    && Array.isArray(incident.observations)
    && incident.observations.every(validIsoTimestamp)
    && typeof incident.legacyHistoryBefore === 'string'
    && (!incident.legacyHistoryBefore || validIsoTimestamp(incident.legacyHistoryBefore));
}

function validLedger(value) {
  // WHAT: Reject non-object launcher ledger roots before version dispatch.
  // WHY: Invalid durable bytes must enter the preservation boundary rather than becoming empty state.
  if (!value || typeof value !== 'object') return false;
  // WHAT: Keep readable version-1 incidents untouched until a valid launcher write occurs.
  // WHY: Lifetime counts cannot be expanded into truthful historical timestamps.
  if (value.version === 1) return Array.isArray(value.incidents) && value.incidents.every(validLegacyIncident);
  // WHAT: Require observations and loss markers on every current launcher document.
  // WHY: Normal and launcher-emergency writers must reject the same malformed version-2 history.
  if (value.version === 2) {
    return typeof value.updatedAt === 'string'
      && (!value.updatedAt || validIsoTimestamp(value.updatedAt))
      && typeof value.historyTruncatedBefore === 'string'
      && (!value.historyTruncatedBefore || validIsoTimestamp(value.historyTruncatedBefore))
      && Array.isArray(value.incidents)
      && value.incidents.every(validCurrentIncident);
  }
  return false;
}

function laterHistoryWatermark(current, candidate) {
  // WHAT: Ignore a launcher loss boundary that is not a canonical ISO timestamp.
  // WHY: Invalid markers cannot define the end of partial rolling totals.
  if (!validIsoTimestamp(candidate)) return current;
  // WHAT: Advance the launcher watermark to the latest discarded observation.
  // WHY: Every possibly lost event must leave the inclusive window before totals become exact.
  if (!current || candidate > current) return candidate;
  return current;
}

function writableLedger(document, observedAt) {
  // WHAT: Reuse a validated current launcher document as the write target.
  // WHY: Version 2 already contains the shared bounded occurrence contract.
  if (document.version === 2) return document;
  const incidents = document.incidents.map((incident) => {
    let observations = [];
    // WHAT: Preserve only the legacy last occurrence that has a truthful timestamp.
    // WHY: Duplicating its lifetime count would fabricate a dated history.
    if (validIsoTimestamp(incident.lastObservedAt)) observations = [incident.lastObservedAt];
    let legacyHistoryBefore = '';
    // WHAT: Bound unrepresented legacy occurrences by their latest possible observation time.
    // WHY: Owner-scoped legacy totals remain partial only while that boundary intersects the window.
    if (incident.occurrences > observations.length) legacyHistoryBefore = observations.at(-1) ?? observedAt;
    return { ...incident, observations, legacyHistoryBefore };
  });
  return { version: 2, updatedAt: document.updatedAt, historyTruncatedBefore: '', incidents };
}

function pruneExpiredHistory(document, observedAt) {
  const cutoff = new Date(Date.parse(observedAt) - incidentHistoryWindowMs).toISOString();
  // WHAT: Prune every launcher incident against one shared emergency write timestamp.
  // WHY: Emergency persistence must expose the same inclusive window across all incidents.
  for (const incident of document.incidents) {
    // WHAT: Keep launcher observations at the inclusive cutoff and remove only older evidence.
    // WHY: Emergency and normal mode must count the same rolling 24-hour interval.
    incident.observations = incident.observations.filter((entry) => entry >= cutoff);
    // WHAT: Expire legacy uncertainty only after its latest possible occurrence leaves the window.
    // WHY: The cutoff timestamp itself remains countable evidence.
    if (incident.legacyHistoryBefore && incident.legacyHistoryBefore < cutoff) incident.legacyHistoryBefore = '';
  }
  // WHAT: Expire global launcher truncation only after every discarded occurrence leaves the window.
  // WHY: Current totals must not remain permanently partial after bounded evidence loss ages out.
  if (document.historyTruncatedBefore && document.historyTruncatedBefore < cutoff) document.historyTruncatedBefore = '';
}

function latestIncidentHistoryBoundary(incident) {
  return [incident.legacyHistoryBefore, ...incident.observations]
    .filter(validIsoTimestamp)
    .sort()
    .at(-1) ?? '';
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
      version: 2,
      updatedAt: observedAt,
      historyTruncatedBefore: '',
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
        observations: [observedAt],
        legacyHistoryBefore: '',
      }],
    };
  }
}

function recordIncident(file, input) {
  const observedAt = new Date().toISOString();
  const document = writableLedger(readLedger(file), observedAt);
  pruneExpiredHistory(document, observedAt);
  const error = input.error instanceof Error ? input.error : new Error(String(input.error));
  const fingerprint = createHash('sha256').update(JSON.stringify({
    scope: 'server-launcher',
    operation: input.operation,
    code: input.code,
    message: error.message,
  })).digest('hex');
  let incident = document.incidents.find((entry) => entry.status === 'paused' && entry.fingerprint === fingerprint);
  // WHAT: Create one current-schema launcher incident when no paused fingerprint can absorb the occurrence.
  // WHY: Coalesced evidence must share an incident while distinct failures retain separate context and messages.
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
      observations: [],
      legacyHistoryBefore: '',
    };
    document.incidents.push(incident);
  }
  incident.lastObservedAt = observedAt;
  incident.occurrences += 1;
  incident.observations.push(observedAt);
  // WHAT: Bound launcher observations and retain the latest discarded timestamp as global loss evidence.
  // WHY: Emergency coalescing must not silently turn a capped rolling total into an exact count.
  if (incident.observations.length > maximumObservationsPerIncident) {
    const discarded = incident.observations.splice(0, incident.observations.length - maximumObservationsPerIncident);
    document.historyTruncatedBefore = laterHistoryWatermark(document.historyTruncatedBefore, discarded.at(-1) ?? '');
  }
  const ordered = document.incidents.sort((left, right) => left.lastObservedAt.localeCompare(right.lastObservedAt));
  const evictedIncidents = ordered.slice(0, Math.max(0, ordered.length - maximumIncidents));
  // WHAT: Mark every whole incident removed by the launcher document cap.
  // WHY: Silent recent eviction would make the global rolling total look exact.
  for (const evicted of evictedIncidents) {
    document.historyTruncatedBefore = laterHistoryWatermark(
      document.historyTruncatedBefore,
      latestIncidentHistoryBoundary(evicted),
    );
  }
  document.incidents = ordered.slice(-maximumIncidents);
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
    observedAt: String(input.observedAt ?? new Date().toISOString()),
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
      observations: [observedAt],
      legacyHistoryBefore: '',
    };
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    response.setHeader('cache-control', 'no-store');
    response.setHeader('content-type', 'application/json');
    // WHAT: Serve health and incident diagnostics from the launcher-owned emergency listener.
    // WHY: A child startup failure must retain the same evaluation anchor and history contract as normal mode.
    if (request.method === 'GET' && (path === '/api/health' || path === '/api/diagnostics/incidents')) {
      const observedAt = new Date().toISOString();
      let document;
      try { document = readLedger(incidentFile); }
      catch {
        // WHAT: Fall back to the in-memory current incident when the emergency ledger cannot be re-read.
        // WHY: Diagnostic availability must survive a secondary persistence failure without changing response shape.
        document = {
          version: 2,
          updatedAt: incident.lastObservedAt,
          historyTruncatedBefore: '',
          incidents: [incident],
        };
      }
      // WHAT: Expose no global truncation time when a readable legacy document has not yet been upgraded.
      // WHY: The legacy version itself identifies incomplete history without inventing a document loss timestamp.
      const historyTruncatedBefore = document.version === 2 ? document.historyTruncatedBefore : '';
      response.end(JSON.stringify({
        ...launcherEmergencyHealthPayload({
          releaseIdentity: input.releaseIdentity,
          observedAt,
          incidentLedger: incidentFile,
          incidentPersistenceError,
          activeIncidentCount: document.incidents.filter((entry) => entry.status === 'paused').length,
        }),
        // WHAT: Attach durable occurrence evidence and completeness markers only to launcher diagnostics.
        // WHY: The health response keeps its existing compact role while diagnostics remains the single incident source.
        ...(path === '/api/diagnostics/incidents' ? {
          incidentHistoryVersion: document.version,
          historyTruncatedBefore,
          incidents: document.incidents,
        } : {}),
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
