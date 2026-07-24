/**
 * WHAT: Converts every registered project through one offline node transaction.
 * WHY: Workstation and phone must never expose a mixed epoch after failure or interruption.
 */
import { existsSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { mkdir, open, rm, statfs } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { readProjectRegistry } from '../../server/helper/project-registry.js';
import {
  buildTaskCurrentStateMigrationShadow,
  prepareTaskCurrentStateMigrationPlan,
} from '../helper/task-current-state-migration.js';
import {
  recoverTaskCurrentStateMigrationTransaction,
  runTaskCurrentStateMigrationTransaction,
  verifyTaskCurrentStateMigrationTransaction,
} from '../helper/task-current-state-migration-transaction.js';

export type NodeTaskMigrationResult = {
  version: 2;
  runId: string;
  phase: 'verified';
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
  catalogRoot: string;
  backupRoot: string;
  projects: Array<{ projectId: string; relativePath: string; root: string; baselineRoot: string; report: string; backup: string }>;
};

export type NodeTaskMigrationPlanReport = {
  version: 1;
  catalogRoot: string;
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
  projectCount: number;
  archiveBytes: number;
  referencedWorkspaceBytes: number;
  projects: Array<{
    projectId: string;
    relativePath: string;
    sourceFingerprint: string;
    archiveBytes: number;
    referencedWorkspaceBytes: number;
    sidecarCount: number;
  }>;
};

function cutoverId(): string {
  return new Date().toISOString().replaceAll(':', '-');
}

function inside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function registeredProjects(catalogRoot: string, registry: NonNullable<ReturnType<typeof readProjectRegistry>>): Array<{ projectId: string; relativePath: string; decisionOsRoot: string; tasksLedgerFile: string }> {
  const realRoots = new Set<string>();
  return Object.values(registry.projects).map((entry) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(entry.id)) throw new Error(`invalid_task_migration_project_id:${entry.id}`);
    const registeredRoot = resolve(catalogRoot, entry.relativePath);
    const registeredRelative = relative(catalogRoot, registeredRoot);
    if (!registeredRelative || registeredRelative === '..' || registeredRelative.startsWith('../') || isAbsolute(registeredRelative)) {
      throw new Error(`node_task_migration_project_registration_outside_catalog:${entry.id}`);
    }
    // WHAT: Admit a registered symlink after validating its lexical catalog entry and project identity.
    // WHY: The Workstation catalog intentionally registers Ardaria on an external mounted filesystem.
    const projectRoot = realpathSync(registeredRoot);
    if (realRoots.has(projectRoot)) throw new Error(`node_task_migration_duplicate_project_root:${entry.id}`);
    realRoots.add(projectRoot);
    const decisionOsRoot = resolve(projectRoot, '.decision-os');
    const identity = JSON.parse(readFileSync(resolve(decisionOsRoot, 'project.json'), 'utf8')) as { id?: unknown };
    if (String(identity.id ?? '') !== entry.id) throw new Error(`node_task_migration_project_identity_mismatch:${entry.id}`);
    const state = JSON.parse(readFileSync(resolve(decisionOsRoot, 'state.json'), 'utf8')) as { ledgers?: unknown[]; tabs?: unknown[] };
    const ledgers = Array.isArray(state.ledgers) ? state.ledgers : Array.isArray(state.tabs) ? state.tabs : [];
    const tasks = ledgers.find((ledger) => ledger && typeof ledger === 'object' && String((ledger as Record<string, unknown>).id ?? '') === 'tasks') as Record<string, unknown> | undefined;
    if (!tasks) throw new Error(`node_task_migration_tasks_ledger_missing:${entry.id}`);
    const tasksLedgerFile = resolve(decisionOsRoot, String(tasks.ledgerFile ?? '').replace(/^\/?\.decision-os\//, ''));
    const ledgerRelative = relative(decisionOsRoot, tasksLedgerFile);
    if (!ledgerRelative || ledgerRelative.startsWith('..') || isAbsolute(ledgerRelative)) throw new Error(`node_task_migration_tasks_file_outside_project:${entry.id}`);
    if (!existsSync(tasksLedgerFile)) throw new Error(`node_task_migration_tasks_file_missing:${entry.id}`);
    return { projectId: entry.id, relativePath: entry.relativePath, decisionOsRoot, tasksLedgerFile };
  }).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function assertCatalogOffline(catalogRoot: string, projects: ReturnType<typeof registeredProjects>): void {
  if (!existsSync('/proc')) return;
  const ownedRoots = [catalogRoot, ...projects.map((project) => dirname(project.decisionOsRoot))];
  for (const name of readdirSync('/proc').filter((entry) => /^\d+$/.test(entry))) {
    const pid = Number(name);
    if (pid === process.pid) continue;
    try {
      const cwd = realpathSync(readlinkSync(`/proc/${name}/cwd`));
      if (!ownedRoots.some((root) => cwd === root || inside(root, cwd))) continue;
      const command = readFileSync(`/proc/${name}/cmdline`, 'utf8').replaceAll('\0', ' ');
      if (/decision-os-server|backend\/src\/server\.ts/.test(command)) throw new Error(`node_task_migration_server_online:${pid}`);
      if (/codex(?:\s|$).*exec|start-card-skill-process/.test(command)) throw new Error(`node_task_migration_child_online:${pid}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('node_task_migration_')) throw error;
    }
  }
}

async function acquireMigrationLock(masterDecisionOsRoot: string): Promise<() => Promise<void>> {
  const lockFile = resolve(masterDecisionOsRoot, 'runtime', 'epoch-4-migration.lock');
  await mkdir(dirname(lockFile), { recursive: true });
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(lockFile, 'wx', 0o600);
  } catch (error) {
    let owner = 0;
    try { owner = Number((JSON.parse(readFileSync(lockFile, 'utf8')) as { pid?: unknown }).pid ?? 0); } catch { /* Invalid lock remains owned. */ }
    let active = owner > 0;
    if (active) try { process.kill(owner, 0); } catch { active = false; }
    if (active || owner === 0) throw new Error(`node_task_migration_locked:${owner || 'unknown'}`);
    await rm(lockFile, { force: true });
    try { handle = await open(lockFile, 'wx', 0o600); }
    catch (retryError) { throw new Error(`node_task_migration_locked:${retryError instanceof Error ? retryError.message : String(retryError)}`); }
  }
  await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  await handle.sync();
  return async () => {
    await handle.close();
    await rm(lockFile, { force: true });
  };
}

async function assertBackupCapacity(backupRoot: string, archiveBytes: number): Promise<void> {
  let probe = dirname(backupRoot);
  while (!existsSync(probe)) {
    const parent = dirname(probe);
    if (parent === probe) throw new Error('node_task_migration_backup_parent_missing');
    probe = parent;
  }
  const capacity = await statfs(probe, { bigint: true });
  const available = capacity.bavail * capacity.bsize;
  const required = BigInt(Math.ceil(archiveBytes * 1.25));
  if (available < required) throw new Error(`node_task_migration_backup_capacity_insufficient:${available}:${required}`);
}

async function nodeContext(input: {
  catalogRoot: string;
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(input.nodeId)) throw new Error('invalid_task_migration_node_id');
  const catalogRoot = realpathSync(resolve(input.catalogRoot));
  const masterDecisionOsRoot = resolve(catalogRoot, '.decision-os');
  const settings = JSON.parse(readFileSync(resolve(masterDecisionOsRoot, '.settings.json'), 'utf8')) as { federationNodeId?: unknown };
  if (String(settings.federationNodeId ?? '') !== input.nodeId) throw new Error('node_task_migration_node_identity_mismatch');
  const registry = readProjectRegistry(masterDecisionOsRoot);
  if (!registry) throw new Error('node_task_migration_requires_project_registry_v2');
  return { catalogRoot, masterDecisionOsRoot, projects: registeredProjects(catalogRoot, registry) };
}

async function prepareNodePlans(input: {
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
}, projects: ReturnType<typeof registeredProjects>) {
  const plans = [];
  for (const project of projects) {
    plans.push(await prepareTaskCurrentStateMigrationPlan({
      decisionOsRoot: project.decisionOsRoot,
      projectId: project.projectId,
      nodeId: input.nodeId,
      targetEpoch: input.targetEpoch,
      defaultAssignedNodeId: input.defaultAssignedNodeId,
      tasksLedgerFile: project.tasksLedgerFile,
    }));
  }
  return plans;
}

export async function planNodeTaskCurrentStateMigration(input: {
  catalogRoot: string;
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
}): Promise<NodeTaskMigrationPlanReport> {
  const context = await nodeContext(input);
  const plans = await prepareNodePlans(input, context.projects);
  const projects = plans.map((plan, index) => ({
    projectId: plan.projectId,
    relativePath: context.projects[index].relativePath,
    sourceFingerprint: plan.sourceFingerprint,
    archiveBytes: plan.sourceSnapshots.filter((entry) => entry.archive).reduce((sum, entry) => sum + entry.bytes, 0),
    referencedWorkspaceBytes: plan.manifest.resources.reduce((sum, entry) => sum + entry.bytes, 0),
    sidecarCount: plan.sidecars.length,
  }));
  return {
    version: 1,
    catalogRoot: context.catalogRoot,
    nodeId: input.nodeId,
    targetEpoch: input.targetEpoch,
    defaultAssignedNodeId: input.defaultAssignedNodeId,
    projectCount: projects.length,
    archiveBytes: projects.reduce((sum, project) => sum + project.archiveBytes, 0),
    referencedWorkspaceBytes: projects.reduce((sum, project) => sum + project.referencedWorkspaceBytes, 0),
    projects,
  };
}

export async function migrateNodeTaskCurrentState(input: {
  catalogRoot: string;
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
  backupRoot?: string;
}): Promise<NodeTaskMigrationResult> {
  const { catalogRoot, masterDecisionOsRoot, projects } = await nodeContext(input);
  const backupRoot = resolve(input.backupRoot ?? resolve(dirname(catalogRoot), `${basename(catalogRoot)}-decision-os-node-migration-rollback`, `${cutoverId()}-${input.nodeId}`));
  const backupRelative = relative(catalogRoot, backupRoot);
  if (!backupRelative || (!backupRelative.startsWith('..') && !isAbsolute(backupRelative))) throw new Error('node_task_migration_backup_must_be_outside_catalog');

  if (existsSync(backupRoot)) {
    const recovered = await recoverTaskCurrentStateMigrationTransaction(backupRoot);
    if (recovered !== 'verified') throw new Error('node_task_migration_recovered_interrupted_transaction');
    const existing = await verifyTaskCurrentStateMigrationTransaction(backupRoot);
    const relativePaths = new Map(projects.map((project) => [project.projectId, project.relativePath]));
    return {
      ...existing,
      nodeId: existing.nodeId ?? input.nodeId,
      targetEpoch: existing.targetEpoch ?? input.targetEpoch,
      defaultAssignedNodeId: existing.defaultAssignedNodeId ?? input.defaultAssignedNodeId,
      catalogRoot: existing.catalogRoot ?? catalogRoot,
      projects: existing.projects.map((project) => ({ ...project, relativePath: relativePaths.get(project.projectId) ?? '' })),
    };
  }

  assertCatalogOffline(catalogRoot, projects);
  const releaseLock = await acquireMigrationLock(masterDecisionOsRoot);
  try {
    // WHAT: Prepare the complete catalog before creating backup or shadow state.
    // WHY: A semantic defect in project seven must leave projects one through six byte-identical.
    const plans = await prepareNodePlans(input, projects);
    await assertBackupCapacity(backupRoot, plans.flatMap((plan) => plan.sourceSnapshots).filter((entry) => entry.archive).reduce((sum, entry) => sum + entry.bytes, 0));
    const migrated = await runTaskCurrentStateMigrationTransaction({
      backupRoot,
      plans,
      build: buildTaskCurrentStateMigrationShadow,
      admissionMarker: resolve(masterDecisionOsRoot, 'runtime', 'epoch-4-migration-admission.json'),
      reportMetadata: {
        nodeId: input.nodeId,
        targetEpoch: input.targetEpoch,
        defaultAssignedNodeId: input.defaultAssignedNodeId,
        catalogRoot,
      },
    });
    const relativePaths = new Map(projects.map((project) => [project.projectId, project.relativePath]));
    return {
      ...migrated,
      nodeId: input.nodeId,
      targetEpoch: input.targetEpoch,
      defaultAssignedNodeId: input.defaultAssignedNodeId,
      catalogRoot,
      projects: migrated.projects.map((project) => ({ ...project, relativePath: relativePaths.get(project.projectId) ?? '' })),
    };
  } finally {
    await releaseLock();
  }
}
