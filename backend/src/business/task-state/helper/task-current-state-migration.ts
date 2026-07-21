/**
 * WHAT: Performs the one-time offline cutover from the retained v2 projection into causal current-state shards.
 * WHY: The server runtime must never parse, migrate, or dual-write the historical representation.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildFederationContentManifest } from '../../federation/helper/federation-content-manifest.js';
import { hydrateLedgerThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { finalizeTaskCurrentEntity } from './task-current-state-join.js';
import { createTaskCurrentStateStore } from './task-current-state-store.js';
import { createTaskContentObjectStore } from './task-content-object-store.js';
import type { TaskCurrentEntity, TaskProjectionConflict } from './task-current-state-types.js';

type MigrationProjection = { projectId?: string; ledger?: Record<string, unknown>; conflicts?: TaskProjectionConflict[] };

function projectionSource(stateRoot: string, tasksLedgerFile: string): MigrationProjection {
  const projectionFile = resolve(stateRoot, 'projection.json');
  if (existsSync(projectionFile)) {
    const projection = JSON.parse(readFileSync(projectionFile, 'utf8')) as MigrationProjection;
    if (projection.ledger && typeof projection.ledger === 'object') return projection;
  }
  return { ledger: JSON.parse(readFileSync(tasksLedgerFile, 'utf8')) as Record<string, unknown>, conflicts: [] };
}

function conflictEntities(projectId: string, conflicts: TaskProjectionConflict[]): TaskCurrentEntity[] {
  const grouped = new Map<string, TaskProjectionConflict[]>();
  for (const conflict of conflicts) {
    const key = `${conflict.entityType}\u0000${conflict.entityId}`;
    const values = grouped.get(key) ?? [];
    values.push(conflict);
    grouped.set(key, values);
  }
  return [...grouped.values()].map((values) => {
    const first = values[0];
    const clock = Object.fromEntries(['baseline', ...values.flatMap((conflict, conflictIndex) => conflict.candidates.map((_candidate, candidateIndex) => `migration-${conflictIndex}-${candidateIndex}`))].map((replicaId) => [replicaId, 1]));
    return finalizeTaskCurrentEntity({
      version: 2,
      projectId,
      entityType: first.entityType,
      entityId: first.entityId,
      replication: 'active',
      fields: Object.fromEntries(values.map((conflict, conflictIndex) => [conflict.path, {
        clock,
        candidates: conflict.candidates.map((candidate, candidateIndex) => ({
          dot: { replicaId: `migration-${conflictIndex}-${candidateIndex}`, counter: 1 },
          operation: candidate.operation,
          ...(Object.hasOwn(candidate, 'value') ? { value: structuredClone(candidate.value) } : {}),
        })),
      }])),
    });
  });
}

export async function migrateTaskCurrentState(input: { decisionOsRoot: string; projectId: string; tasksLedgerFile: string; backupRoot?: string }): Promise<{ backup: string; root: string; baselineRoot: string }> {
  const activeRoot = resolve(input.decisionOsRoot, 'task-state', input.projectId);
  if (existsSync(resolve(activeRoot, 'format.json'))) throw new Error('task_current_state_already_migrated');
  const source = projectionSource(activeRoot, input.tasksLedgerFile);
  const ledger = hydrateLedgerThreadNotes(structuredClone(source.ledger ?? {}), input.decisionOsRoot);
  const backup = resolve(input.backupRoot ?? resolve(input.decisionOsRoot, 'task-state-rollback'), `${input.projectId}-${new Date().toISOString().replaceAll(':', '-')}`);
  await mkdir(dirname(backup), { recursive: true });
  if (existsSync(activeRoot)) await rename(activeRoot, backup);

  const store = createTaskCurrentStateStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId, initializeLedger: ledger });
  await rm(store.formatFile, { force: true });
  const conflicts = conflictEntities(input.projectId, source.conflicts ?? []);
  if (conflicts.length > 0) await store.merge({ version: 2, projectId: input.projectId, entities: conflicts });

  const objects = createTaskContentObjectStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId });
  const manifest = buildFederationContentManifest({ projectId: input.projectId, decisionOsRoot: input.decisionOsRoot, ledger });
  const heads = (await Promise.all(manifest.resources.filter((resource) => resource.type !== 'thread-markdown').map((resource) => objects.capture(resource.key)))).filter((head) => head !== null);
  if (heads.length > 0) await store.mutate({ replicaId: 'baseline-content', changes: heads.map((head) => ({ entityType: 'resource', entityId: head.key, changes: [{ path: 'head', operation: 'set', value: head }] })) });
  await store.flush();
  await store.commitFormat();
  const format = JSON.parse(readFileSync(store.formatFile, 'utf8')) as { baselineRoot: string };
  return { backup, root: store.root, baselineRoot: format.baselineRoot };
}
