/**
 * WHAT: Commits prepared epoch-4 projects through one durable node transaction.
 * WHY: A killed migration must resume as deterministic rollback instead of leaving a mixed-epoch catalog.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { chmod, copyFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { canonicalJson } from './task-current-state-codec.js';
import { createTaskCurrentStatePersistence } from './task-current-state-persistence.js';
import { createTaskCurrentStateStore } from './task-current-state-store.js';
import type {
  TaskCurrentStateMigrationBuild,
  TaskCurrentStateMigrationPlan,
  TaskCurrentStateMigrationSnapshot,
} from './task-current-state-migration.js';

type TransactionPhase = 'inventory' | 'backup-verified' | 'shadow-valid' | 'commit-started' | 'committing' | 'complete' | 'verified' | 'rolled-back';

type ArchivedSnapshot = TaskCurrentStateMigrationSnapshot & { archiveFile: string };
type TransactionSidecar = { file: string; archiveFile: string; wasPresent: boolean; applied: boolean };
type TransactionProject = {
  projectId: string;
  liveRoot: string;
  shadowDecisionOsRoot: string;
  shadowRoot: string;
  rollbackRoot: string;
  sourceFingerprint: string;
  stateArchived: boolean;
  stateInstalled: boolean;
  sidecars: TransactionSidecar[];
};

type TransactionJournal = {
  version: 1;
  runId: string;
  phase: TransactionPhase;
  createdAt: string;
  updatedAt: string;
  backupRoot: string;
  sourceManifest: string;
  admissionMarker?: string;
  projects: TransactionProject[];
  error?: string;
};

export type TaskCurrentStateMigrationTransactionResult = {
  version: 2;
  runId: string;
  phase: 'verified';
  backupRoot: string;
  nodeId?: string;
  targetEpoch?: number;
  defaultAssignedNodeId?: string;
  catalogRoot?: string;
  projects: Array<{ projectId: string; backup: string; root: string; baselineRoot: string; report: string }>;
};

export class TaskCurrentStateMigrationInterruption extends Error {
  constructor(message = 'task_current_state_migration_interrupted') {
    super(message);
    this.name = 'TaskCurrentStateMigrationInterruption';
  }
}

function inside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { highWaterMark: 256 * 1024 })) hash.update(chunk);
  return hash.digest('hex');
}

function journalFile(backupRoot: string): string {
  return resolve(backupRoot, 'transaction.json');
}

async function durableJson(file: string, value: unknown): Promise<void> {
  await createTaskCurrentStatePersistence(dirname(file)).atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function persistJournal(journal: TransactionJournal): Promise<void> {
  journal.updatedAt = new Date().toISOString();
  await durableJson(journalFile(journal.backupRoot), journal);
  if (journal.admissionMarker) {
    await durableJson(journal.admissionMarker, {
      version: 1,
      runId: journal.runId,
      phase: journal.phase,
      backupRoot: journal.backupRoot,
      updatedAt: journal.updatedAt,
      error: journal.error ?? '',
    });
  }
}

function archiveFileFor(plan: TaskCurrentStateMigrationPlan, snapshot: TaskCurrentStateMigrationSnapshot, backupRoot: string): string {
  if (inside(plan.decisionOsRoot, snapshot.file)) {
    return resolve(backupRoot, 'projects', plan.projectId, 'decision-os', relative(plan.decisionOsRoot, snapshot.file));
  }
  const sourceIndex = plan.sourceStateRoots.findIndex((root) => inside(root, snapshot.file));
  if (sourceIndex >= 0) return resolve(backupRoot, 'projects', plan.projectId, 'source-state-roots', String(sourceIndex), relative(plan.sourceStateRoots[sourceIndex], snapshot.file));
  throw new Error(`task_migration_archive_source_unowned:${snapshot.file}`);
}

async function archivePlans(plans: TaskCurrentStateMigrationPlan[], backupRoot: string): Promise<ArchivedSnapshot[]> {
  const archived: ArchivedSnapshot[] = [];
  for (const plan of plans) {
    for (const snapshot of plan.sourceSnapshots) {
      const archiveFile = snapshot.archive ? archiveFileFor(plan, snapshot, backupRoot) : '';
      if (archiveFile) {
        await mkdir(dirname(archiveFile), { recursive: true });
        await copyFile(snapshot.file, archiveFile);
        await chmod(archiveFile, snapshot.mode);
        if (statSync(archiveFile).size !== snapshot.bytes || await sha256(archiveFile) !== snapshot.hash) {
          throw new Error(`task_migration_backup_verification_failed:${snapshot.file}`);
        }
      }
      archived.push({ ...snapshot, archiveFile });
    }
  }
  return archived;
}

function sidecarArchive(archived: ArchivedSnapshot[], file: string): string {
  return archived.find((entry) => entry.file === file && entry.archiveFile)?.archiveFile ?? '';
}

async function rollbackJournal(journal: TransactionJournal): Promise<void> {
  for (const project of [...journal.projects].reverse()) {
    for (const sidecar of [...project.sidecars].reverse()) {
      if (!sidecar.applied) continue;
      if (sidecar.wasPresent) {
        if (!sidecar.archiveFile || !existsSync(sidecar.archiveFile)) throw new Error(`task_migration_rollback_sidecar_missing:${sidecar.file}`);
        await createTaskCurrentStatePersistence(dirname(sidecar.file)).atomicWrite(sidecar.file, readFileSync(sidecar.archiveFile));
      } else {
        await createTaskCurrentStatePersistence(dirname(sidecar.file)).durableRemove(sidecar.file);
      }
      sidecar.applied = false;
      await persistJournal(journal);
    }
    if (project.stateInstalled && existsSync(project.liveRoot)) {
      const failedRoot = `${project.liveRoot}.failed-${journal.runId}`;
      await rm(failedRoot, { recursive: true, force: true });
      await rename(project.liveRoot, failedRoot);
      project.stateInstalled = false;
      await persistJournal(journal);
      await rm(failedRoot, { recursive: true, force: true });
    }
    if (project.stateArchived && existsSync(project.rollbackRoot)) {
      await mkdir(dirname(project.liveRoot), { recursive: true });
      await rename(project.rollbackRoot, project.liveRoot);
      project.stateArchived = false;
      await persistJournal(journal);
    }
    await rm(project.shadowDecisionOsRoot, { recursive: true, force: true });
  }
  journal.phase = 'rolled-back';
  await persistJournal(journal);
}

export async function recoverTaskCurrentStateMigrationTransaction(backupRoot: string): Promise<'verified' | 'rolled-back' | 'absent'> {
  const file = journalFile(resolve(backupRoot));
  if (!existsSync(file)) return 'absent';
  const journal = JSON.parse(readFileSync(file, 'utf8')) as TransactionJournal;
  if (journal.version !== 1 || journal.backupRoot !== resolve(backupRoot)) throw new Error('invalid_task_migration_transaction_journal');
  if (journal.phase === 'verified') {
    await persistJournal(journal);
    return 'verified';
  }
  if (journal.phase !== 'rolled-back') await rollbackJournal(journal);
  return 'rolled-back';
}

async function verifyTransactionEvidence(backupRoot: string, allowedPhases: TransactionPhase[]): Promise<TaskCurrentStateMigrationTransactionResult> {
  const root = resolve(backupRoot);
  const journal = JSON.parse(readFileSync(journalFile(root), 'utf8')) as TransactionJournal;
  if (journal.version !== 1 || !allowedPhases.includes(journal.phase)) throw new Error('task_migration_transaction_not_verified');
  const sourceManifest = JSON.parse(readFileSync(journal.sourceManifest, 'utf8')) as { entries?: ArchivedSnapshot[] };
  if (!Array.isArray(sourceManifest.entries)) throw new Error('invalid_task_migration_source_manifest');
  for (const snapshot of sourceManifest.entries.filter((entry) => entry.archiveFile)) {
    if (!existsSync(snapshot.archiveFile) || statSync(snapshot.archiveFile).size !== snapshot.bytes || await sha256(snapshot.archiveFile) !== snapshot.hash) {
      throw new Error(`task_migration_backup_verification_failed:${snapshot.file}`);
    }
  }
  const result = JSON.parse(readFileSync(resolve(root, 'node-migration-report.json'), 'utf8')) as TaskCurrentStateMigrationTransactionResult;
  if (result.version !== 2 || result.phase !== 'verified' || result.runId !== journal.runId || result.projects.length !== journal.projects.length) {
    throw new Error('invalid_task_migration_node_report');
  }
  for (const project of result.projects) {
    const format = JSON.parse(readFileSync(resolve(project.root, 'format.json'), 'utf8')) as { stateSchema?: unknown; baselineEpoch?: unknown; baselineRoot?: unknown };
    const report = JSON.parse(readFileSync(project.report, 'utf8')) as { root?: unknown; missingObjects?: unknown; journalCount?: unknown };
    const store = createTaskCurrentStateStore({ decisionOsRoot: dirname(dirname(project.root)), projectId: project.projectId });
    if (format.stateSchema !== 4 || format.baselineEpoch !== 4 || format.baselineRoot !== project.baselineRoot) throw new Error(`task_migration_live_format_invalid:${project.projectId}`);
    if (report.root !== store.rootHash() || report.missingObjects !== 0 || report.journalCount !== 0 || store.diagnostics().journalCount !== 0) {
      throw new Error(`task_migration_live_verification_failed:${project.projectId}`);
    }
  }
  return result;
}

export async function verifyTaskCurrentStateMigrationTransaction(backupRoot: string): Promise<TaskCurrentStateMigrationTransactionResult> {
  return verifyTransactionEvidence(backupRoot, ['verified']);
}

export async function runTaskCurrentStateMigrationTransaction(input: {
  backupRoot: string;
  plans: TaskCurrentStateMigrationPlan[];
  build: (plan: TaskCurrentStateMigrationPlan, shadowDecisionOsRoot: string, backup: string) => Promise<TaskCurrentStateMigrationBuild>;
  reportMetadata?: Pick<TaskCurrentStateMigrationTransactionResult, 'nodeId' | 'targetEpoch' | 'defaultAssignedNodeId' | 'catalogRoot'>;
  checkpoint?: (event: { phase: TransactionPhase | 'state-archive-intent' | 'state-install-intent' | 'state-installed' | 'sidecar-intent' | 'sidecar-applied'; projectId?: string; file?: string }) => void | Promise<void>;
  admissionMarker?: string;
}): Promise<TaskCurrentStateMigrationTransactionResult> {
  const backupRoot = resolve(input.backupRoot);
  if (existsSync(backupRoot)) {
    const recovered = await recoverTaskCurrentStateMigrationTransaction(backupRoot);
    if (recovered === 'verified') return verifyTaskCurrentStateMigrationTransaction(backupRoot);
    throw new Error('task_migration_recovered_interrupted_transaction');
  }
  const runId = randomUUID();
  await mkdir(dirname(backupRoot), { recursive: true });
  await mkdir(backupRoot, { recursive: false });
  const sourceManifest = resolve(backupRoot, 'source-manifest.json');
  const journal: TransactionJournal = {
    version: 1,
    runId,
    phase: 'inventory',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    backupRoot,
    sourceManifest,
    ...(input.admissionMarker ? { admissionMarker: resolve(input.admissionMarker) } : {}),
    projects: [],
  };
  await persistJournal(journal);
  await input.checkpoint?.({ phase: 'inventory' });
  let builds: TaskCurrentStateMigrationBuild[] = [];
  try {
    const archived = await archivePlans(input.plans, backupRoot);
    await durableJson(sourceManifest, {
      version: 1,
      runId,
      sourceFingerprint: createHash('sha256').update(canonicalJson(input.plans.map((plan) => ({ projectId: plan.projectId, sourceFingerprint: plan.sourceFingerprint })))).digest('hex'),
      entries: archived,
      complete: true,
    });
    journal.phase = 'backup-verified';
    journal.projects = input.plans.map((plan) => {
      const shadowDecisionOsRoot = resolve(dirname(plan.decisionOsRoot), `.decision-os-epoch4-shadow-${runId}-${plan.projectId}`);
      return {
        projectId: plan.projectId,
        liveRoot: plan.activeRoot,
        shadowDecisionOsRoot,
        shadowRoot: resolve(shadowDecisionOsRoot, 'task-state', plan.projectId),
        rollbackRoot: resolve(plan.decisionOsRoot, 'task-state-rollback', runId, plan.projectId),
        sourceFingerprint: plan.sourceFingerprint,
        stateArchived: false,
        stateInstalled: false,
        sidecars: plan.sidecars.map((sidecar) => ({
          file: sidecar.file,
          archiveFile: sidecarArchive(archived, sidecar.file),
          wasPresent: sidecar.before !== null,
          applied: false,
        })),
      };
    });
    await persistJournal(journal);
    await input.checkpoint?.({ phase: 'backup-verified' });

    builds = [];
    for (let index = 0; index < input.plans.length; index += 1) {
      builds.push(await input.build(input.plans[index], journal.projects[index].shadowDecisionOsRoot, backupRoot));
    }
    journal.phase = 'shadow-valid';
    await persistJournal(journal);
    await input.checkpoint?.({ phase: 'shadow-valid' });

    for (const build of builds) {
      const { verifyTaskCurrentStateMigrationPlan } = await import('./task-current-state-migration.js');
      await verifyTaskCurrentStateMigrationPlan(build.plan);
    }
    journal.phase = 'commit-started';
    await persistJournal(journal);
    await input.checkpoint?.({ phase: 'commit-started' });
    journal.phase = 'committing';
    await persistJournal(journal);
    await input.checkpoint?.({ phase: 'committing' });

    for (let index = 0; index < builds.length; index += 1) {
      const build = builds[index];
      const project = journal.projects[index];
      await mkdir(dirname(project.rollbackRoot), { recursive: true });
      if (existsSync(project.rollbackRoot)) throw new Error(`task_migration_local_rollback_exists:${project.projectId}`);
      if (existsSync(project.liveRoot)) {
        project.stateArchived = true;
        await persistJournal(journal);
        await input.checkpoint?.({ phase: 'state-archive-intent', projectId: project.projectId });
        await rename(project.liveRoot, project.rollbackRoot);
      }
      await mkdir(dirname(project.liveRoot), { recursive: true });
      project.stateInstalled = true;
      await persistJournal(journal);
      await input.checkpoint?.({ phase: 'state-install-intent', projectId: project.projectId });
      await rename(project.shadowRoot, project.liveRoot);
      await input.checkpoint?.({ phase: 'state-installed', projectId: project.projectId });
      for (let sidecarIndex = 0; sidecarIndex < build.plan.sidecars.length; sidecarIndex += 1) {
        const sidecar = build.plan.sidecars[sidecarIndex];
        project.sidecars[sidecarIndex].applied = true;
        await persistJournal(journal);
        await input.checkpoint?.({ phase: 'sidecar-intent', projectId: project.projectId, file: sidecar.file });
        if (sidecar.value === null) await createTaskCurrentStatePersistence(dirname(sidecar.file)).durableRemove(sidecar.file);
        else await createTaskCurrentStatePersistence(dirname(sidecar.file)).atomicWrite(sidecar.file, sidecar.value);
        await input.checkpoint?.({ phase: 'sidecar-applied', projectId: project.projectId, file: sidecar.file });
      }
    }
    journal.phase = 'complete';
    await persistJournal(journal);
    await input.checkpoint?.({ phase: 'complete' });

    const result: TaskCurrentStateMigrationTransactionResult = {
      version: 2,
      runId,
      phase: 'verified',
      backupRoot,
      ...input.reportMetadata,
      projects: builds.map((build) => ({
        projectId: build.plan.projectId,
        backup: backupRoot,
        root: build.plan.activeRoot,
        baselineRoot: build.baselineRoot,
        report: resolve(build.plan.activeRoot, 'migration-report.json'),
      })),
    };
    await durableJson(resolve(backupRoot, 'node-migration-report.json'), result);
    await verifyTransactionEvidence(backupRoot, ['complete']);
    journal.phase = 'verified';
    await persistJournal(journal);
    await input.checkpoint?.({ phase: 'verified' });
    await verifyTaskCurrentStateMigrationTransaction(backupRoot);
    for (const project of journal.projects) await rm(project.shadowDecisionOsRoot, { recursive: true, force: true });
    return result;
  } catch (error) {
    journal.error = error instanceof Error ? `${error.name}:${error.message}` : String(error);
    if (error instanceof TaskCurrentStateMigrationInterruption) {
      await persistJournal(journal);
      throw error;
    }
    try { await rollbackJournal(journal); }
    catch (rollbackError) {
      journal.error = `${journal.error};rollback:${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`;
      await persistJournal(journal);
    }
    throw error;
  }
}
