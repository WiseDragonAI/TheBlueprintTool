/**
 * WHAT: Persists bounded, coalesced runtime incidents for server and project fault boundaries.
 * WHY: A recoverable subsystem failure must pause its scope without crashing the catalog or growing logs forever.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';

export type RuntimeIncident = {
  id: string;
  fingerprint: string;
  status: 'paused' | 'resolved';
  severity: 'warning' | 'error' | 'fatal';
  scope: string;
  component: string;
  operation: string;
  code: string;
  message: string;
  stack: string;
  context: Record<string, unknown>;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrences: number;
  resolvedAt: string;
  observations?: string[];
  legacyHistoryBefore?: string;
};

type LegacyIncidentDocument = { version: 1; updatedAt: string; incidents: RuntimeIncident[] };
type CurrentRuntimeIncident = RuntimeIncident & { observations: string[]; legacyHistoryBefore: string };
type CurrentIncidentDocument = {
  version: 2;
  updatedAt: string;
  historyTruncatedBefore: string;
  incidents: CurrentRuntimeIncident[];
};
export type IncidentDocument = LegacyIncidentDocument | CurrentIncidentDocument;
type IncidentInput = {
  severity?: RuntimeIncident['severity'];
  scope: string;
  component: string;
  operation: string;
  code?: string;
  error: unknown;
  context?: Record<string, unknown>;
};

const incidentHistoryWindowMs = 24 * 60 * 60 * 1_000;
const defaultMaximumObservationsPerIncident = 1_000;
const emptyDocument = (): CurrentIncidentDocument => ({
  version: 2,
  updatedAt: '',
  historyTruncatedBefore: '',
  incidents: [],
});
const validIsoTimestamp = (value: unknown): value is string => {
  // WHAT: Reject non-string observation values before parsing them as durable timestamps.
  // WHY: Version 2 must never admit an observation that cannot participate in a deterministic rolling window.
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};
const isLegacyIncident = (incident: unknown): incident is RuntimeIncident => (
  Boolean(incident) && typeof incident === 'object'
  && typeof (incident as RuntimeIncident).id === 'string'
  && typeof (incident as RuntimeIncident).fingerprint === 'string'
  && ((incident as RuntimeIncident).status === 'paused' || (incident as RuntimeIncident).status === 'resolved')
  && typeof (incident as RuntimeIncident).scope === 'string'
  && typeof (incident as RuntimeIncident).code === 'string'
  && typeof (incident as RuntimeIncident).message === 'string'
  && Number.isInteger((incident as RuntimeIncident).occurrences)
);
const isCurrentIncident = (incident: unknown): incident is CurrentRuntimeIncident => (
  isLegacyIncident(incident)
  && Array.isArray(incident.observations)
  && incident.observations.every(validIsoTimestamp)
  && typeof incident.legacyHistoryBefore === 'string'
  && (!incident.legacyHistoryBefore || validIsoTimestamp(incident.legacyHistoryBefore))
);
const isIncidentDocument = (value: unknown): value is IncidentDocument => {
  // WHAT: Reject non-object ledger roots before reading version-specific fields.
  // WHY: Corrupt durable state must enter the preservation boundary instead of being treated as an empty ledger.
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<IncidentDocument>;
  // WHAT: Keep the existing readable version-1 boundary without manufacturing dated occurrences during reads.
  // WHY: Legacy lifetime counts do not contain enough evidence to reconstruct one timestamp per historical failure.
  if (document.version === 1) return Array.isArray(document.incidents) && document.incidents.every(isLegacyIncident);
  // WHAT: Validate every version-2 observation and loss marker before accepting the document.
  // WHY: Malformed history would otherwise produce exact-looking rolling totals from invalid durable evidence.
  if (document.version === 2) {
    return typeof document.updatedAt === 'string'
      && (!document.updatedAt || validIsoTimestamp(document.updatedAt))
      && typeof document.historyTruncatedBefore === 'string'
      && (!document.historyTruncatedBefore || validIsoTimestamp(document.historyTruncatedBefore))
      && Array.isArray(document.incidents)
      && document.incidents.every(isCurrentIncident);
  }
  return false;
};
const boundedText = (value: unknown, limit: number): string => String(value ?? '').slice(0, limit);

function normalizedError(error: unknown): { code: string; message: string; stack: string } {
  if (error instanceof Error) {
    const coded = error as Error & { code?: unknown };
    return {
      code: boundedText(coded.code ?? error.message.split(':', 1)[0] ?? 'runtime_error', 160),
      message: boundedText(error.message || error.name, 2_000),
      stack: boundedText(error.stack ?? '', 16_000),
    };
  }
  return { code: 'runtime_error', message: boundedText(error, 2_000), stack: '' };
}

function boundedContext(context: Record<string, unknown> = {}): Record<string, unknown> {
  try {
    const serialized = JSON.stringify(context, (_key, value) => typeof value === 'bigint' ? String(value) : value);
    if (serialized.length <= 32_000) return JSON.parse(serialized) as Record<string, unknown>;
    return { truncated: true, preview: serialized.slice(0, 32_000) };
  } catch {
    return { serializationError: true };
  }
}

function fingerprint(input: { scope: string; component: string; operation: string; code: string; message: string }): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function laterHistoryWatermark(current: string, candidate: string): string {
  // WHAT: Ignore a loss boundary that cannot represent an actual ISO timestamp.
  // WHY: An invalid watermark cannot define when a rolling total becomes exact again.
  if (!validIsoTimestamp(candidate)) return current;
  // WHAT: Install the first valid loss boundary or advance it to the latest discarded observation.
  // WHY: Totals remain partial until every potentially lost event has left the inclusive rolling window.
  if (!current || candidate > current) return candidate;
  return current;
}

function writableDocument(document: IncidentDocument, observedAt: string): CurrentIncidentDocument {
  // WHAT: Reuse a validated current document without rewriting its evidence during reads.
  // WHY: Version 2 already carries the complete bounded occurrence contract.
  if (document.version === 2) return document;
  const incidents = document.incidents.map((incident): CurrentRuntimeIncident => {
    let observations: string[] = [];
    // WHAT: Preserve the one dated occurrence that a legacy incident actually recorded.
    // WHY: Repeating the legacy lifetime count at the last timestamp would invent a false event timeline.
    if (validIsoTimestamp(incident.lastObservedAt)) observations = [incident.lastObservedAt];
    let legacyHistoryBefore = '';
    // WHAT: Mark legacy occurrences that have no individual timestamp through their latest possible boundary.
    // WHY: Consumers need an owner-specific lower bound until all unrepresented legacy evidence is outside the window.
    if (incident.occurrences > observations.length) {
      legacyHistoryBefore = observations.at(-1) ?? observedAt;
    }
    return {
      ...incident,
      observations,
      legacyHistoryBefore,
    };
  });
  return {
    version: 2,
    updatedAt: document.updatedAt,
    historyTruncatedBefore: '',
    incidents,
  };
}

function pruneExpiredHistory(document: CurrentIncidentDocument, observedAt: string): void {
  const cutoff = new Date(Date.parse(observedAt) - incidentHistoryWindowMs).toISOString();
  // WHAT: Prune each incident independently against the shared write timestamp.
  // WHY: Every retained incident must expose the same inclusive rolling window after persistence.
  for (const incident of document.incidents) {
    // WHAT: Retain observations exactly at the cutoff and remove only strictly older events.
    // WHY: The rolling 24-hour requirement defines an inclusive lower boundary.
    incident.observations = incident.observations.filter((entry) => entry >= cutoff);
    // WHAT: Clear owner-scoped legacy uncertainty only after its latest possible event is strictly outside the window.
    // WHY: A marker at the inclusive cutoff can still hide a countable occurrence.
    if (incident.legacyHistoryBefore && incident.legacyHistoryBefore < cutoff) incident.legacyHistoryBefore = '';
  }
  // WHAT: Clear document-wide truncation only after every discarded event is strictly outside the window.
  // WHY: Observation-cap and whole-incident loss must stop making current totals partial once it cannot intersect them.
  if (document.historyTruncatedBefore && document.historyTruncatedBefore < cutoff) document.historyTruncatedBefore = '';
}

function latestIncidentHistoryBoundary(incident: CurrentRuntimeIncident): string {
  return [incident.legacyHistoryBefore, ...incident.observations]
    .filter(validIsoTimestamp)
    .sort()
    .at(-1) ?? '';
}

export class RuntimeScopePausedError extends Error {
  readonly code = 'runtime_scope_paused';
  readonly statusCode = 503;

  constructor(readonly scope: string, readonly incidentId: string) {
    super(`Runtime scope ${scope} is paused by incident ${incidentId}.`);
    this.name = 'RuntimeScopePausedError';
  }
}

export function createRuntimeIncidentLedger(input: {
  decisionOsRoot: string;
  file?: string;
  maxIncidents?: number;
  maxObservationsPerIncident?: number;
  now?: () => Date;
  protectedScopes?: () => Iterable<string>;
}) {
  const file = resolve(input.file ?? resolve(input.decisionOsRoot, 'runtime-incidents.json'));
  const pendingFile = resolve(input.decisionOsRoot, 'runtime', 'runtime-incidents.pending.json');
  const maxIncidents = Math.max(10, input.maxIncidents ?? 500);
  const maxObservationsPerIncident = Math.max(1, input.maxObservationsPerIncident ?? defaultMaximumObservationsPerIncident);
  const now = input.now ?? (() => new Date());
  let persistenceBlockedReason = '';
  let pendingRecoveryDocument: CurrentIncidentDocument | null = null;
  let persistenceFailureReported = false;

  const writePendingDocument = (document: CurrentIncidentDocument): void => {
    const temporary = `${pendingFile}.${process.pid}.${randomUUID()}.tmp`;
    try {
      mkdirSync(dirname(pendingFile), { recursive: true });
      writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, pendingFile);
    } catch (error) {
      rmSync(temporary, { force: true });
      reportPersistenceFailure(error, 'runtime-incident-ledger-pending');
    }
  };

  const retainPersistenceFailure = (
    document: CurrentIncidentDocument,
    persistenceError: unknown,
    failedScope: string,
  ): void => {
    const observedAt = now().toISOString();
    const normalized = normalizedError(persistenceError);
    const scope = 'runtime-incident-ledger';
    const code = 'runtime_incident_ledger_write_failed';
    const message = 'Runtime incident ledger primary persistence failed.';
    const incidentFingerprint = fingerprint({
      scope,
      component: 'runtime-incident-ledger',
      operation: 'persist',
      code,
      message,
    });
    const existing = document.incidents.find((entry) => (
      entry.status === 'paused' && entry.fingerprint === incidentFingerprint
    ));
    const incident = existing ?? {
      id: `incident-${randomUUID()}`,
      fingerprint: incidentFingerprint,
      status: 'paused' as const,
      severity: 'fatal' as const,
      scope,
      component: 'runtime-incident-ledger',
      operation: 'persist',
      code,
      message,
      stack: normalized.stack,
      context: {},
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      occurrences: 0,
      resolvedAt: '',
      observations: [],
      legacyHistoryBefore: '',
    };
    incident.lastObservedAt = observedAt;
    incident.occurrences += 1;
    incident.observations.push(observedAt);
    // WHAT: Bound repeated diagnostic-storage failure timestamps to the standard incident observation limit.
    // WHY: A prolonged primary-ledger outage must not make the fallback document grow without limit.
    if (incident.observations.length > maxObservationsPerIncident) {
      const discarded = incident.observations.splice(
        0,
        incident.observations.length - maxObservationsPerIncident,
      );
      document.historyTruncatedBefore = laterHistoryWatermark(
        document.historyTruncatedBefore,
        discarded.at(-1) ?? '',
      );
    }
    incident.context = boundedContext({
      ...incident.context,
      file,
      pendingFile,
      failedScope,
      persistenceCode: normalized.code,
      persistenceMessage: normalized.message,
    });
    // WHAT: Add the diagnostic-storage incident to the pending authority exactly once per fingerprint.
    // WHY: Recursive calls to record() would attempt the same failed primary persistence boundary again.
    if (!existing) document.incidents.push(incident);
    document.updatedAt = observedAt;
    pendingRecoveryDocument = document;
    writePendingDocument(document);
    reportPersistenceFailure(persistenceError, failedScope);
  };

  const reportPersistenceFailure = (error: unknown, scope: string): void => {
    const normalized = normalizedError(error);
    telemetry('runtime-incident-ledger-write-failed', { file, scope, code: normalized.code, message: normalized.message });
    if (persistenceFailureReported) return;
    persistenceFailureReported = true;
    try { console.error(JSON.stringify({ runtimeIncidentLedgerWriteFailed: true, file, scope, code: normalized.code, message: normalized.message })); }
    catch { /* A last-resort diagnostic transport cannot affect server control flow. */ }
  };

  const persist = (document: CurrentIncidentDocument): void => {
    if (persistenceBlockedReason) throw new Error(persistenceBlockedReason);
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, file);
      pendingRecoveryDocument = null;
      rmSync(pendingFile, { force: true });
      persistenceFailureReported = false;
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  };

  const read = (): IncidentDocument => {
    // WHAT: Serve pending incident evidence before the older primary ledger.
    // WHY: A failed primary write must remain visible to diagnostics and survive process restart through the bounded fallback file.
    if (pendingRecoveryDocument) return pendingRecoveryDocument;
    // WHAT: Restore the emergency fallback before consulting the stale primary ledger after process restart.
    // WHY: The fallback contains incidents that the failed primary persistence boundary never committed.
    if (existsSync(pendingFile)) {
      try {
        const pending: unknown = JSON.parse(readFileSync(pendingFile, 'utf8'));
        // WHAT: Reject a structurally invalid fallback document before making it diagnostic authority.
        // WHY: Emergency persistence cannot weaken the primary incident-ledger validation contract.
        if (!isIncidentDocument(pending)) throw new Error('Unsupported pending runtime incident ledger format.');
        pendingRecoveryDocument = writableDocument(pending, now().toISOString());
        return pendingRecoveryDocument;
      } catch (error) {
        reportPersistenceFailure(error, 'runtime-incident-ledger-pending-read');
      }
    }
    if (!existsSync(file)) return pendingRecoveryDocument ?? emptyDocument();
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      if (!isIncidentDocument(parsed)) throw new Error('Unsupported runtime incident ledger format.');
      return parsed;
    } catch (error) {
      const observedAt = now().toISOString();
      const backupFile = `${file}.corrupt-${observedAt.replaceAll(':', '-')}-${randomUUID()}`;
      try {
        renameSync(file, backupFile);
        persistenceBlockedReason = '';
      } catch (backupError) {
        persistenceBlockedReason = `Runtime incident ledger is corrupt and could not be preserved: ${normalizedError(backupError).message}`;
      }
      const normalized = normalizedError(error);
      const incidentFingerprint = fingerprint({
        scope: 'runtime-incident-ledger',
        component: 'runtime-incident-ledger',
        operation: 'read',
        code: 'runtime_incident_ledger_corrupt',
        message: normalized.message,
      });
      const document: CurrentIncidentDocument = {
        version: 2,
        updatedAt: observedAt,
        historyTruncatedBefore: '',
        incidents: [{
          id: `incident-${randomUUID()}`,
          fingerprint: incidentFingerprint,
          status: 'paused',
          severity: 'fatal',
          scope: 'runtime-incident-ledger',
          component: 'runtime-incident-ledger',
          operation: 'read',
          code: 'runtime_incident_ledger_corrupt',
          message: normalized.message,
          stack: normalized.stack,
          context: boundedContext({ file, backupFile: persistenceBlockedReason ? '' : backupFile, persistenceBlockedReason }),
          firstObservedAt: observedAt,
          lastObservedAt: observedAt,
          occurrences: 1,
          resolvedAt: '',
          observations: [observedAt],
          legacyHistoryBefore: '',
        }],
      };
      pendingRecoveryDocument = document;
      if (!persistenceBlockedReason) {
        try { persist(document); }
        catch (writeError) { reportPersistenceFailure(writeError, 'runtime-incident-ledger'); }
      }
      telemetry('runtime-incident-ledger-corrupt', {
        file,
        backupFile: persistenceBlockedReason ? '' : backupFile,
        persistenceBlockedReason,
      });
      return document;
    }
  };

  const record = (incidentInput: IncidentInput): RuntimeIncident => {
    const observedAt = now().toISOString();
    const error = normalizedError(incidentInput.error);
    const code = boundedText(incidentInput.code ?? error.code, 160) || 'runtime_error';
    const incidentFingerprint = fingerprint({
      scope: incidentInput.scope,
      component: incidentInput.component,
      operation: incidentInput.operation,
      code,
      message: error.message,
    });
    const document = writableDocument(read(), observedAt);
    pruneExpiredHistory(document, observedAt);
    const existing = document.incidents.find((entry) => entry.status === 'paused' && entry.fingerprint === incidentFingerprint);
    const incident: CurrentRuntimeIncident = existing ?? {
      id: `incident-${randomUUID()}`,
      fingerprint: incidentFingerprint,
      status: 'paused',
      severity: incidentInput.severity ?? 'error',
      scope: boundedText(incidentInput.scope, 500),
      component: boundedText(incidentInput.component, 240),
      operation: boundedText(incidentInput.operation, 240),
      code,
      message: error.message,
      stack: error.stack,
      context: boundedContext(incidentInput.context),
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      occurrences: 0,
      resolvedAt: '',
      observations: [],
      legacyHistoryBefore: '',
    };
    incident.lastObservedAt = observedAt;
    incident.occurrences += 1;
    incident.observations.push(observedAt);
    // WHAT: Discard only the oldest excess observations and advance the global loss watermark to their latest timestamp.
    // WHY: The per-incident cap must stay bounded without presenting an undercount as exact inside the rolling window.
    if (incident.observations.length > maxObservationsPerIncident) {
      const discarded = incident.observations.splice(0, incident.observations.length - maxObservationsPerIncident);
      document.historyTruncatedBefore = laterHistoryWatermark(
        document.historyTruncatedBefore,
        discarded.at(-1) ?? '',
      );
    }
    incident.context = boundedContext({ ...incident.context, ...incidentInput.context });
    // WHAT: Add a newly fingerprinted incident after its first dated observation has been attached.
    // WHY: Existing incidents are already owned by the current document and must not be duplicated.
    if (!existing) document.incidents.push(incident);
    const protectedScopes = new Set(input.protectedScopes?.() ?? []);
    const ordered = document.incidents.sort((left, right) => left.lastObservedAt.localeCompare(right.lastObservedAt));
    const protectedIncidents = ordered.filter((entry) => entry.status === 'paused' && protectedScopes.has(entry.scope));
    const remainingCapacity = Math.max(0, maxIncidents - protectedIncidents.length);
    const unprotectedHistory = ordered.filter((entry) => !protectedIncidents.includes(entry));
    const retainedHistory = remainingCapacity > 0 ? unprotectedHistory.slice(-remainingCapacity) : [];
    const retainedIds = new Set([...protectedIncidents, ...retainedHistory].map((entry) => entry.id));
    const evictedIncidents = ordered.filter((entry) => !retainedIds.has(entry.id));
    // WHAT: Advance the global watermark across every incident removed by whole-document retention.
    // WHY: Recent events can be lost even when each retained incident remains below its own observation cap.
    for (const evicted of evictedIncidents) {
      document.historyTruncatedBefore = laterHistoryWatermark(
        document.historyTruncatedBefore,
        latestIncidentHistoryBoundary(evicted),
      );
    }
    // WHAT: Retain every incident that owns live admission before bounded diagnostic history.
    // WHY: Evicting active evidence can make recovery impossible while the in-memory scope remains paused.
    document.incidents = [...protectedIncidents, ...retainedHistory]
      .sort((left, right) => left.lastObservedAt.localeCompare(right.lastObservedAt));
    document.updatedAt = observedAt;
    try {
      persist(document);
    } catch (persistenceError) {
      retainPersistenceFailure(document, persistenceError, incident.scope);
    }
    telemetry('runtime-incident', {
      incidentId: incident.id,
      fingerprint: incident.fingerprint,
      severity: incident.severity,
      scope: incident.scope,
      component: incident.component,
      operation: incident.operation,
      code: incident.code,
      occurrences: incident.occurrences,
      firstObservedAt: incident.firstObservedAt,
      lastObservedAt: incident.lastObservedAt,
    });
    return structuredClone(incident);
  };

  return {
    file,
    record,
    snapshot(): IncidentDocument {
      return structuredClone(read());
    },
    active(scope = ''): RuntimeIncident[] {
      return read().incidents.filter((incident) => incident.status === 'paused' && (!scope || incident.scope === scope));
    },
    resolveScope(scope: string, resolution = ''): RuntimeIncident[] {
      const resolvedAt = now().toISOString();
      const document = writableDocument(read(), resolvedAt);
      pruneExpiredHistory(document, resolvedAt);
      const resolved: RuntimeIncident[] = [];
      for (const incident of document.incidents) {
        // WHAT: Resolve only paused incidents owned by the requested scope.
        // WHY: Recovery of one scope must not mutate unrelated or already settled incident evidence.
        if (incident.status !== 'paused' || incident.scope !== scope) continue;
        incident.status = 'resolved';
        incident.resolvedAt = resolvedAt;
        incident.context = boundedContext({ ...incident.context, resolution: boundedText(resolution, 2_000) });
        resolved.push(structuredClone(incident));
      }
      // WHAT: Avoid a no-op write when the requested scope has no active incident.
      // WHY: A read-only recovery attempt must not upgrade or rewrite durable legacy state.
      if (resolved.length === 0) return [];
      document.updatedAt = resolvedAt;
      try { persist(document); }
      catch (error) {
        retainPersistenceFailure(document, error, scope);
        return [];
      }
      telemetry('runtime-incident-resolved', { scope, incidentIds: resolved.map((incident) => incident.id), resolvedAt });
      return resolved;
    },
    recoverPersistence(resolution = ''): RuntimeIncident[] {
      const document = writableDocument(read(), now().toISOString());
      const resolvedAt = now().toISOString();
      const resolved: RuntimeIncident[] = [];
      for (const incident of document.incidents) {
        // WHAT: Resolve only the diagnostic-storage scope during explicit persistence recovery.
        // WHY: Restoring the ledger must not settle the application incidents whose writes were being preserved.
        if (incident.status !== 'paused' || incident.scope !== 'runtime-incident-ledger') continue;
        incident.status = 'resolved';
        incident.resolvedAt = resolvedAt;
        incident.context = boundedContext({ ...incident.context, resolution: boundedText(resolution, 2_000) });
        resolved.push(structuredClone(incident));
      }
      // WHAT: Require an active persistence incident before rewriting the primary ledger.
      // WHY: A recovery request must not become an unrelated no-op durable mutation.
      if (resolved.length === 0) return [];
      document.updatedAt = resolvedAt;
      try { persist(document); }
      catch (error) {
        retainPersistenceFailure(document, error, 'runtime-incident-ledger');
        return [];
      }
      telemetry('runtime-incident-resolved', {
        scope: 'runtime-incident-ledger',
        incidentIds: resolved.map((incident) => incident.id),
        resolvedAt,
      });
      return resolved;
    },
  };
}

export type RuntimeIncidentLedger = ReturnType<typeof createRuntimeIncidentLedger>;
