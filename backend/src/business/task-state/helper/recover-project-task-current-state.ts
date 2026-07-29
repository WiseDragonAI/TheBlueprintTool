/**
 * WHAT: Recovers one compatible legacy project task-state root through the existing migration transaction.
 * WHY: A project-owned format gate must recover without requiring a node restart or a second recovery store.
 */
import { resolve } from 'node:path';
import {
  buildTaskCurrentStateMigrationShadow,
  prepareTaskCurrentStateMigrationPlan,
} from './task-current-state-migration.js';
import { runTaskCurrentStateMigrationTransaction } from './task-current-state-migration-transaction.js';

export async function recoverProjectTaskCurrentState(input: {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  defaultAssignedNodeId: string;
  tasksLedgerFile: string;
  admissionMarker: string;
  contentObjectRoots?: string[];
}): Promise<{ sourceFingerprint: string; backupRoot: string }> {
  const plan = await prepareTaskCurrentStateMigrationPlan({
    decisionOsRoot: input.decisionOsRoot,
    projectId: input.projectId,
    nodeId: input.nodeId,
    defaultAssignedNodeId: input.defaultAssignedNodeId,
    tasksLedgerFile: input.tasksLedgerFile,
    contentObjectRoots: input.contentObjectRoots,
  });
  const backupRoot = resolve(
    input.decisionOsRoot,
    '..',
    '.decision-os-task-state-recovery',
    input.projectId,
    plan.sourceFingerprint,
  );
  try {
    await runTaskCurrentStateMigrationTransaction({
      backupRoot,
      plans: [plan],
      build: buildTaskCurrentStateMigrationShadow,
      admissionMarker: input.admissionMarker,
    });
  } catch (error) {
    if (error && typeof error === 'object') {
      Object.assign(error, { sourceFingerprint: plan.sourceFingerprint, backupRoot });
    }
    throw error;
  }
  return { sourceFingerprint: plan.sourceFingerprint, backupRoot };
}
