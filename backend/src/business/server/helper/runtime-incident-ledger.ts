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
};

type IncidentDocument = { version: 1; updatedAt: string; incidents: RuntimeIncident[] };
type IncidentInput = {
  severity?: RuntimeIncident['severity'];
  scope: string;
  component: string;
  operation: string;
  code?: string;
  error: unknown;
  context?: Record<string, unknown>;
};

const emptyDocument = (): IncidentDocument => ({ version: 1, updatedAt: '', incidents: [] });
const isIncidentDocument = (value: unknown): value is IncidentDocument => {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<IncidentDocument>;
  return document.version === 1 && Array.isArray(document.incidents) && document.incidents.every((incident) => (
    Boolean(incident) && typeof incident === 'object'
    && typeof incident.id === 'string'
    && typeof incident.fingerprint === 'string'
    && (incident.status === 'paused' || incident.status === 'resolved')
    && typeof incident.scope === 'string'
    && typeof incident.code === 'string'
    && typeof incident.message === 'string'
    && Number.isInteger(incident.occurrences)
  ));
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
  now?: () => Date;
  protectedScopes?: () => Iterable<string>;
}) {
  const file = resolve(input.file ?? resolve(input.decisionOsRoot, 'runtime-incidents.json'));
  const maxIncidents = Math.max(10, input.maxIncidents ?? 500);
  const now = input.now ?? (() => new Date());
  let persistenceBlockedReason = '';
  let pendingRecoveryDocument: IncidentDocument | null = null;
  let persistenceFailureReported = false;

  const reportPersistenceFailure = (error: unknown, scope: string): void => {
    const normalized = normalizedError(error);
    telemetry('runtime-incident-ledger-write-failed', { file, scope, code: normalized.code, message: normalized.message });
    if (persistenceFailureReported) return;
    persistenceFailureReported = true;
    try { console.error(JSON.stringify({ runtimeIncidentLedgerWriteFailed: true, file, scope, code: normalized.code, message: normalized.message })); }
    catch { /* A last-resort diagnostic transport cannot affect server control flow. */ }
  };

  const persist = (document: IncidentDocument): void => {
    if (persistenceBlockedReason) throw new Error(persistenceBlockedReason);
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, file);
      pendingRecoveryDocument = null;
      persistenceFailureReported = false;
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  };

  const read = (): IncidentDocument => {
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
      const document: IncidentDocument = {
        version: 1,
        updatedAt: observedAt,
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
    const document = read();
    const existing = document.incidents.find((entry) => entry.status === 'paused' && entry.fingerprint === incidentFingerprint);
    const incident: RuntimeIncident = existing ?? {
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
    };
    incident.lastObservedAt = observedAt;
    incident.occurrences += 1;
    incident.context = boundedContext({ ...incident.context, ...incidentInput.context });
    if (!existing) document.incidents.push(incident);
    const protectedScopes = new Set(input.protectedScopes?.() ?? []);
    const ordered = document.incidents.sort((left, right) => left.lastObservedAt.localeCompare(right.lastObservedAt));
    const protectedIncidents = ordered.filter((entry) => entry.status === 'paused' && protectedScopes.has(entry.scope));
    const remainingCapacity = Math.max(0, maxIncidents - protectedIncidents.length);
    const unprotectedHistory = ordered.filter((entry) => !protectedIncidents.includes(entry));
    const retainedHistory = remainingCapacity > 0 ? unprotectedHistory.slice(-remainingCapacity) : [];
    // WHAT: Retain every incident that owns live admission before bounded diagnostic history.
    // WHY: Evicting active evidence can make recovery impossible while the in-memory scope remains paused.
    document.incidents = [...protectedIncidents, ...retainedHistory]
      .sort((left, right) => left.lastObservedAt.localeCompare(right.lastObservedAt));
    document.updatedAt = observedAt;
    try {
      persist(document);
    } catch (persistenceError) {
      reportPersistenceFailure(persistenceError, incident.scope);
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
      const document = read();
      const resolvedAt = now().toISOString();
      const resolved: RuntimeIncident[] = [];
      for (const incident of document.incidents) {
        if (incident.status !== 'paused' || incident.scope !== scope) continue;
        incident.status = 'resolved';
        incident.resolvedAt = resolvedAt;
        incident.context = boundedContext({ ...incident.context, resolution: boundedText(resolution, 2_000) });
        resolved.push(structuredClone(incident));
      }
      if (resolved.length === 0) return [];
      document.updatedAt = resolvedAt;
      try { persist(document); }
      catch (error) {
        reportPersistenceFailure(error, scope);
        return [];
      }
      telemetry('runtime-incident-resolved', { scope, incidentIds: resolved.map((incident) => incident.id), resolvedAt });
      return resolved;
    },
  };
}

export type RuntimeIncidentLedger = ReturnType<typeof createRuntimeIncidentLedger>;
