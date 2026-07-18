/** Durable, restart-safe project synchronization runs and origin locks. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { projectSyncPhases, type ProjectSyncEvidence, type ProjectSyncPhase, type ProjectSyncRun } from './project-sync-types.js';

type StoreDocument = { version: 1; runs: Record<string, ProjectSyncRun>; locks: Record<string, string> };
const terminal = new Set<ProjectSyncPhase>(['complete', 'failed']);
const transitions: Record<ProjectSyncPhase, ProjectSyncPhase[]> = {
  requested: ['preflight', 'failed'],
  preflight: ['source_publish', 'failed'],
  source_publish: ['initiator_reconcile', 'failed'],
  initiator_reconcile: ['source_finalize', 'failed'],
  source_finalize: ['complete', 'failed'],
  complete: [],
  failed: ['preflight'],
};

export function createProjectSyncStore(input: { decisionOsRoot: string; now?: () => Date }) {
  const file = resolve(input.decisionOsRoot, 'project-sync', 'runs.json');
  const now = input.now ?? (() => new Date());
  let document: StoreDocument;
  try { document = JSON.parse(readFileSync(file, 'utf8')) as StoreDocument; }
  catch { document = { version: 1, runs: {}, locks: {} }; }
  document.locks ??= {};
  const persist = (): void => {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`);
    renameSync(temporary, file);
  };
  return {
    file,
    list(): ProjectSyncRun[] { return Object.values(document.runs).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    read(syncId: string): ProjectSyncRun | null { return document.runs[syncId] ?? null; },
    attachTask(syncId: string, value: Pick<ProjectSyncRun, 'initiatorProjectId' | 'taskProjectId' | 'ledgerId' | 'masterCardId' | 'pipelineRunId'>): ProjectSyncRun {
      const run = document.runs[syncId];
      if (!run) throw new Error('Unknown project synchronization run.');
      Object.assign(run, value, { updatedAt: now().toISOString() });
      persist();
      return run;
    },
    admit(value: Omit<ProjectSyncRun, 'syncId' | 'phase' | 'createdAt' | 'updatedAt' | 'evidence' | 'error' | 'taskProjectId' | 'ledgerId' | 'masterCardId' | 'pipelineRunId'>): { run: ProjectSyncRun; duplicate: boolean } {
      const duplicate = Object.values(document.runs).find((run) => run.idempotencyKey === value.idempotencyKey)
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
    transition(syncId: string, phase: ProjectSyncPhase, evidence?: ProjectSyncEvidence, error?: ProjectSyncRun['error']): ProjectSyncRun {
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
      const owner = document.locks[originFingerprint];
      if (owner && owner !== syncId) throw new Error('Repository origin already has an active synchronization run.');
      document.locks[originFingerprint] = syncId;
      persist();
    },
    releaseLock(originFingerprint: string, syncId: string): void {
      if (document.locks[originFingerprint] === syncId) {
        delete document.locks[originFingerprint];
        persist();
      }
    },
  };
}

export type ProjectSyncStore = ReturnType<typeof createProjectSyncStore>;
