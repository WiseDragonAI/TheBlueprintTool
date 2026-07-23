/**
 * WHAT: Converts every registered project on one node without federation access.
 * WHY: Workstation and phone must independently produce joinable epoch-4 state from their local files.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { readProjectRegistry } from '../../server/helper/project-registry.js';
import { migrateTaskCurrentState } from '../helper/task-current-state-migration.js';

export type NodeTaskMigrationResult = {
  version: 1;
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
  catalogRoot: string;
  backupRoot: string;
  projects: Array<{ projectId: string; relativePath: string; root: string; baselineRoot: string; report: string; backup: string }>;
};

function cutoverId(): string {
  return new Date().toISOString().replaceAll(':', '-');
}

function registeredProjects(catalogRoot: string, registry: NonNullable<ReturnType<typeof readProjectRegistry>>): Array<{ projectId: string; relativePath: string; decisionOsRoot: string; tasksLedgerFile: string }> {
  return Object.values(registry.projects).map((entry) => {
    // WHAT: Validate every registry identifier before any project migration begins.
    // WHY: Node-wide orchestration must reject path-capable identifiers before partial cutover is possible.
    if (!/^[a-zA-Z0-9_-]+$/.test(entry.id)) throw new Error(`invalid_task_migration_project_id:${entry.id}`);
    const projectRoot = realpathSync(resolve(catalogRoot, entry.relativePath));
    const projectRelative = relative(catalogRoot, projectRoot);
    if (projectRelative === '..' || projectRelative.startsWith('../') || isAbsolute(projectRelative)) throw new Error(`node_task_migration_project_outside_catalog:${entry.id}`);
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

export async function migrateNodeTaskCurrentState(input: {
  catalogRoot: string;
  nodeId: string;
  targetEpoch: number;
  defaultAssignedNodeId: string;
  backupRoot?: string;
}): Promise<NodeTaskMigrationResult> {
  if (!/^[a-zA-Z0-9_-]+$/.test(input.nodeId)) throw new Error('invalid_task_migration_node_id');
  const catalogRoot = realpathSync(resolve(input.catalogRoot));
  const masterDecisionOsRoot = resolve(catalogRoot, '.decision-os');
  const settings = JSON.parse(readFileSync(resolve(masterDecisionOsRoot, '.settings.json'), 'utf8')) as { federationNodeId?: unknown };
  if (String(settings.federationNodeId ?? '') !== input.nodeId) throw new Error('node_task_migration_node_identity_mismatch');
  const registry = readProjectRegistry(masterDecisionOsRoot);
  if (!registry) throw new Error('node_task_migration_requires_project_registry_v2');
  const projects = registeredProjects(catalogRoot, registry);
  const backupRoot = resolve(input.backupRoot ?? resolve(dirname(catalogRoot), `${basename(catalogRoot)}-decision-os-node-migration-rollback`, `${cutoverId()}-${input.nodeId}`));
  const backupRelative = relative(catalogRoot, backupRoot);
  if (!backupRelative || (!backupRelative.startsWith('..') && !isAbsolute(backupRelative))) throw new Error('node_task_migration_backup_must_be_outside_catalog');
  if (existsSync(backupRoot)) throw new Error('node_task_migration_backup_exists');
  await mkdir(backupRoot, { recursive: true });
  await cp(masterDecisionOsRoot, resolve(backupRoot, 'catalog-decision-os'), { recursive: true, force: false, errorOnExist: true });

  const migrated: NodeTaskMigrationResult['projects'] = [];
  for (const project of projects) {
    const result = await migrateTaskCurrentState({
      decisionOsRoot: project.decisionOsRoot,
      projectId: project.projectId,
      nodeId: input.nodeId,
      targetEpoch: input.targetEpoch,
      defaultAssignedNodeId: input.defaultAssignedNodeId,
      tasksLedgerFile: project.tasksLedgerFile,
      backupRoot: resolve(backupRoot, 'project-rollbacks'),
    });
    migrated.push({ projectId: project.projectId, relativePath: project.relativePath, ...result });
  }

  const result: NodeTaskMigrationResult = {
    version: 1,
    nodeId: input.nodeId,
    targetEpoch: input.targetEpoch,
    defaultAssignedNodeId: input.defaultAssignedNodeId,
    catalogRoot,
    backupRoot,
    projects: migrated,
  };
  await writeFile(resolve(backupRoot, 'node-migration-report.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
