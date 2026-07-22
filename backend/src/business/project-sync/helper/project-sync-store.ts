/** Durable, restart-safe project synchronization runs and origin locks. */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { projectSyncPhases, type ProjectSyncEvidence, type ProjectSyncPhase, type ProjectSyncPreparationPhase, type ProjectSyncRun } from './project-sync-types.js';

type StoreDocument = { version: 1; runs: Record<string, ProjectSyncRun>; locks: Record<string, string> };
const terminal = new Set<ProjectSyncPhase>(['complete', 'failed']);
const transitions: Record<ProjectSyncPhase, ProjectSyncPhase[]> = {
  requested: ['preflight', 'failed'],
  preflight: ['source_publish', 'failed'],
  source_publish: ['initiator_reconcile', 'failed'],
  initiator_reconcile: ['source_finalize', 'failed'],
  source_finalize: ['complete', 'failed'],
  complete: [],
  failed: ['requested', 'preflight'],
};

export class ProjectSyncStoreCorruptionError extends Error {
  readonly code = 'project_sync_store_corrupt';
  constructor(readonly file: string, cause: unknown) {
    super(`Could not read the durable project synchronization store ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function createProjectSyncStore(input: { decisionOsRoot: string; now?: () => Date }) {
  const file = resolve(input.decisionOsRoot, 'project-sync', 'runs.json');
  const now = input.now ?? (() => new Date());
  let document: StoreDocument;
  let corruptionError: ProjectSyncStoreCorruptionError | null = null;
  try {
    document = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as StoreDocument : { version: 1, runs: {}, locks: {} };
    if (!document || document.version !== 1 || !document.runs || typeof document.runs !== 'object' || Array.isArray(document.runs) || !document.locks || typeof document.locks !== 'object' || Array.isArray(document.locks)) {
      throw new Error('Expected a version 1 store with run and lock objects.');
    }
    for (const [syncId, run] of Object.entries(document.runs)) {
      if (!run || typeof run !== 'object' || run.syncId !== syncId || !projectSyncPhases.includes(run.phase) || typeof run.updatedAt !== 'string' || !Number.isFinite(Date.parse(run.updatedAt)) || typeof run.originFingerprint !== 'string') {
        throw new Error(`Invalid project synchronization run: ${syncId}.`);
      }
    }
    for (const [originFingerprint, syncId] of Object.entries(document.locks)) {
      if (!originFingerprint || typeof syncId !== 'string' || !syncId) throw new Error(`Invalid project synchronization lock: ${originFingerprint}.`);
    }
  } catch (error) {
    corruptionError = new ProjectSyncStoreCorruptionError(file, error);
    document = { version: 1, runs: {}, locks: {} };
  }
  document.locks ??= {};
  for (const run of Object.values(document.runs ?? {})) {
    run.sourceProjectName ||= run.sourceProjectId;
    run.sourceProjectColor ||= '#38d9e8';
    run.preparationPhase ||= run.taskProjectId && run.masterCardId && run.pipelineRunId ? 'attached' : 'pending';
  }
  const assertHealthy = (): void => {
    if (corruptionError) throw corruptionError;
  };
  const persist = (): void => {
    assertHealthy();
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`);
    renameSync(temporary, file);
  };
  return {
    file,
    corruptionError,
    list(): ProjectSyncRun[] { return Object.values(document.runs).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    read(syncId: string): ProjectSyncRun | null { return document.runs[syncId] ?? null; },
    attachTask(syncId: string, value: Pick<ProjectSyncRun, 'initiatorProjectId' | 'taskProjectId' | 'ledgerId' | 'masterCardId' | 'pipelineRunId'>): ProjectSyncRun {
      assertHealthy();
      const run = document.runs[syncId];
      if (!run) throw new Error('Unknown project synchronization run.');
      Object.assign(run, value, { preparationPhase: 'attached', updatedAt: now().toISOString() });
      persist();
      return run;
    },
    setPreparationPhase(syncId: string, preparationPhase: ProjectSyncPreparationPhase): ProjectSyncRun {
      assertHealthy();
      const run = document.runs[syncId];
      if (!run) throw new Error('Unknown project synchronization run.');
      run.preparationPhase = preparationPhase;
      run.updatedAt = now().toISOString();
      persist();
      return run;
    },
    admit(value: Omit<ProjectSyncRun, 'syncId' | 'phase' | 'createdAt' | 'updatedAt' | 'evidence' | 'error' | 'taskProjectId' | 'ledgerId' | 'masterCardId' | 'pipelineRunId' | 'preparationPhase'>): { run: ProjectSyncRun; duplicate: boolean } {
      assertHealthy();
      const duplicate = Object.values(document.runs).find((run) => run.phase !== 'complete' && run.idempotencyKey === value.idempotencyKey)
        ?? Object.values(document.runs).find((run) => !terminal.has(run.phase) && run.originFingerprint === value.originFingerprint);
      if (duplicate) return { run: duplicate, duplicate: true };
      if (document.locks[value.originFingerprint]) throw new Error('Repository origin already has an active synchronization run.');
      const timestamp = now().toISOString();
      const run: ProjectSyncRun = {
        ...value,
        syncId: randomUUID(),
        taskProjectId: '',
        ledgerId: '',
        masterCardId: '',
        pipelineRunId: '',
        preparationPhase: 'pending',
        phase: 'requested',
        createdAt: timestamp,
        updatedAt: timestamp,
        evidence: {},
        error: null,
      };
      document.runs[run.syncId] = run;
      document.locks[run.originFingerprint] = run.syncId;
      persist();
      return { run, duplicate: false };
    },
    restart(syncId: string): ProjectSyncRun {
      assertHealthy();
      const run = document.runs[syncId];
      if (!run || run.phase !== 'failed') throw new Error('Only a failed project synchronization can be retried.');
      const attached = Boolean(run.taskProjectId && run.masterCardId && run.pipelineRunId);
      const owner = document.locks[run.originFingerprint];
      if (owner && owner !== syncId) throw new Error('Repository origin already has an active synchronization run.');
      document.locks[run.originFingerprint] = syncId;
      run.phase = attached ? 'preflight' : 'requested';
      if (!attached) run.preparationPhase = 'pending';
      run.updatedAt = now().toISOString();
      run.error = null;
      persist();
      return run;
    },
    transition(syncId: string, phase: ProjectSyncPhase, evidence?: ProjectSyncEvidence, error?: ProjectSyncRun['error']): ProjectSyncRun {
      assertHealthy();
      const run = document.runs[syncId];
      if (!run) throw new Error('Unknown project synchronization run.');
      if (!projectSyncPhases.includes(phase)) throw new Error('Unknown project synchronization phase.');
      if (!transitions[run.phase].includes(phase)) throw new Error(`Invalid project synchronization transition: ${run.phase} -> ${phase}.`);
      if (run.phase === 'failed' && phase === 'preflight') {
        const owner = document.locks[run.originFingerprint];
        if (owner && owner !== syncId) throw new Error('Repository origin already has an active synchronization run.');
        document.locks[run.originFingerprint] = syncId;
      }
      run.phase = phase;
      run.updatedAt = now().toISOString();
      if (evidence) run.evidence[phase] = evidence;
      run.error = error ?? null;
      if (terminal.has(phase) && document.locks[run.originFingerprint] === syncId) delete document.locks[run.originFingerprint];
      persist();
      return run;
    },
    acquireLock(originFingerprint: string, syncId: string): void {
      assertHealthy();
      const owner = document.locks[originFingerprint];
      if (owner && owner !== syncId) throw new Error('Repository origin already has an active synchronization run.');
      document.locks[originFingerprint] = syncId;
      persist();
    },
    releaseLock(originFingerprint: string, syncId: string): void {
      assertHealthy();
      if (document.locks[originFingerprint] === syncId) {
        delete document.locks[originFingerprint];
        persist();
      }
    },
  };
}

export type ProjectSyncStore = ReturnType<typeof createProjectSyncStore>;
