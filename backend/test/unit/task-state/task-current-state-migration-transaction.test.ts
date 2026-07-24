/**
 * WHAT: Injects failures at the node migration commit boundary.
 * WHY: Epoch cutover is safe only when partial swaps restore byte-identical legacy state and interrupted journals recover deterministically.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  buildTaskCurrentStateMigrationShadow,
  prepareTaskCurrentStateMigrationPlan,
  type TaskCurrentStateMigrationPlan,
} from '../../../src/business/task-state/helper/task-current-state-migration.js';
import {
  recoverTaskCurrentStateMigrationTransaction,
  runTaskCurrentStateMigrationTransaction,
  TaskCurrentStateMigrationInterruption,
  verifyTaskCurrentStateMigrationTransaction,
} from '../../../src/business/task-state/helper/task-current-state-migration-transaction.js';

function fixture(prefix: string, projectId: string): { root: string; tasksFile: string; formatFile: string; tasksBytes: Buffer } {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  const stateRoot = resolve(root, 'task-state', projectId);
  const tasksFile = resolve(root, 'tasks.json');
  const formatFile = resolve(stateRoot, 'format.json');
  const ledger = { cards: [{ id: `${projectId}-card`, title: projectId }], annotations: [], relationships: [] };
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(tasksFile, JSON.stringify(ledger));
  writeFileSync(resolve(stateRoot, 'projection.json'), JSON.stringify({ version: 3, projectId, ledger, conflicts: [] }));
  writeFileSync(formatFile, JSON.stringify({ stateProtocol: 'decision-os-task-state/3', stateSchema: 3, baselineEpoch: 3, projectId, baselineRoot: `${projectId}-legacy` }));
  return { root, tasksFile, formatFile, tasksBytes: readFileSync(tasksFile) };
}

async function plan(value: ReturnType<typeof fixture>, projectId: string): Promise<TaskCurrentStateMigrationPlan> {
  return prepareTaskCurrentStateMigrationPlan({
    decisionOsRoot: value.root,
    projectId,
    nodeId: 'workstation',
    targetEpoch: 4,
    defaultAssignedNodeId: 'workstation',
    tasksLedgerFile: value.tasksFile,
  });
}

test('a failure after the second project swap restores every project and sidecar', async (context) => {
  const first = fixture('decision-os-transaction-first-', 'project-a');
  const second = fixture('decision-os-transaction-second-', 'project-b');
  const backupRoot = `${first.root}-backup`;
  context.after(() => [first.root, second.root, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const plans = [await plan(first, 'project-a'), await plan(second, 'project-b')];

  await assert.rejects(runTaskCurrentStateMigrationTransaction({
    backupRoot,
    plans,
    build: buildTaskCurrentStateMigrationShadow,
    checkpoint: ({ phase, projectId }) => {
      if (phase === 'state-installed' && projectId === 'project-b') throw new Error('injected_second_project_commit_failure');
    },
  }), /injected_second_project_commit_failure/);

  assert.equal(JSON.parse(readFileSync(first.formatFile, 'utf8')).stateSchema, 3);
  assert.equal(JSON.parse(readFileSync(second.formatFile, 'utf8')).stateSchema, 3);
  assert.deepEqual(readFileSync(first.tasksFile), first.tasksBytes);
  assert.deepEqual(readFileSync(second.tasksFile), second.tasksBytes);
  assert.equal(JSON.parse(readFileSync(resolve(backupRoot, 'transaction.json'), 'utf8')).phase, 'rolled-back');
});

test('an interrupted commit is recovered from its durable journal and a verified rerun is idempotent', async (context) => {
  const value = fixture('decision-os-transaction-interruption-', 'project-a');
  const backupRoot = `${value.root}-backup`;
  context.after(() => [value.root, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
  const prepared = await plan(value, 'project-a');

  await assert.rejects(runTaskCurrentStateMigrationTransaction({
    backupRoot,
    plans: [prepared],
    build: buildTaskCurrentStateMigrationShadow,
    checkpoint: ({ phase }) => {
      if (phase === 'sidecar-applied') throw new TaskCurrentStateMigrationInterruption();
    },
  }), TaskCurrentStateMigrationInterruption);
  assert.equal(JSON.parse(readFileSync(value.formatFile, 'utf8')).stateSchema, 4);

  assert.equal(await recoverTaskCurrentStateMigrationTransaction(backupRoot), 'rolled-back');
  assert.equal(JSON.parse(readFileSync(value.formatFile, 'utf8')).stateSchema, 3);
  assert.deepEqual(readFileSync(value.tasksFile), value.tasksBytes);

  const secondBackup = `${value.root}-verified-backup`;
  context.after(() => rmSync(secondBackup, { recursive: true, force: true }));
  const secondPlan = await plan(value, 'project-a');
  const completed = await runTaskCurrentStateMigrationTransaction({ backupRoot: secondBackup, plans: [secondPlan], build: buildTaskCurrentStateMigrationShadow });
  const repeated = await runTaskCurrentStateMigrationTransaction({ backupRoot: secondBackup, plans: [], build: buildTaskCurrentStateMigrationShadow });
  assert.deepEqual(repeated, completed);
  assert.deepEqual(await verifyTaskCurrentStateMigrationTransaction(secondBackup), completed);
});

for (const phase of ['state-archive-intent', 'state-install-intent', 'sidecar-intent'] as const) {
  test(`write-ahead recovery is byte-identical when interrupted at ${phase}`, async (context) => {
    const value = fixture(`decision-os-transaction-${phase}-`, 'project-a');
    const backupRoot = `${value.root}-backup`;
    context.after(() => [value.root, backupRoot].forEach((entry) => rmSync(entry, { recursive: true, force: true })));
    const prepared = await plan(value, 'project-a');

    await assert.rejects(runTaskCurrentStateMigrationTransaction({
      backupRoot,
      plans: [prepared],
      build: buildTaskCurrentStateMigrationShadow,
      checkpoint: (event) => {
        if (event.phase === phase) throw new TaskCurrentStateMigrationInterruption();
      },
    }), TaskCurrentStateMigrationInterruption);

    assert.equal(await recoverTaskCurrentStateMigrationTransaction(backupRoot), 'rolled-back');
    assert.equal(JSON.parse(readFileSync(value.formatFile, 'utf8')).stateSchema, 3);
    assert.deepEqual(readFileSync(value.tasksFile), value.tasksBytes);
  });
}
