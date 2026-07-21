import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admitProjectSyncMasterTask } from '../../../src/business/project-sync/effect/admit-project-sync-master-task.js';
import type { DecisionOsProject } from '../../../src/business/server/helper/project-catalog.js';
import { createProjectTaskState, type ProjectTaskState } from '../../../src/business/task-state/helper/project-task-state.js';
import type { TaskProjectionCommand } from '../../../src/business/task-state/helper/task-mutation-command.js';

test('admits one deterministic synchronization-labeled master task', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-sync-task-'));
  const decisionOsRoot = join(root, '.decision-os');
  const specsLedgerPath = join(decisionOsRoot, 'specs.json');
  const ledgerPath = join(decisionOsRoot, 'tasks.json');
  let taskState: ProjectTaskState | null = null;
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(specsLedgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
    writeFileSync(ledgerPath, JSON.stringify({ cards: [], annotations: [], relationships: [] }));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [
      { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
      { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' },
    ] }));
    const project: DecisionOsProject = {
      id: 'project-a', name: 'Project A', relativePath: '.', root, decisionOsRoot,
      description: '', color: '#000000', available: true, diagnostic: '',
      ledgers: [
        { id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' },
        { id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' },
      ],
    };
    const runtime: Record<string, unknown> = { projectId: 'project-a' };
    taskState = createProjectTaskState({ projectId: 'project-a', writerId: 'test', decisionOsRoot, tasksLedgerFile: ledgerPath, initialize: true });
    runtime.readTaskLedgerProjection = () => taskState!.projection().ledger;
    runtime.persistTaskLedgerProjection = (ledger: Record<string, unknown>, command: TaskProjectionCommand) => taskState!.executeProjectionCommand(command, ledger);
    const input = { project, runtime, sourceProjectId: 'source-b', sourceProjectName: 'Source B', sourceProjectColor: '#d94f70', originFingerprint: 'f'.repeat(64), syncId: 'sync-1', waitingSince: '2026-07-18T06:00:00.000Z' };
    const first = await admitProjectSyncMasterTask(input);
    const duplicate = await admitProjectSyncMasterTask(input);
    assert.deepEqual(duplicate, first);
    const ledger = (runtime.readTaskLedgerProjection as () => { cards: Array<Record<string, unknown>>; annotations: Array<Record<string, unknown>> })();
    assert.equal(ledger.cards.length, 1);
    assert.deepEqual(ledger.cards[0].labels, ['master-task', 'synchronization']);
    assert.equal(ledger.cards[0].status, 'todo');
    assert.match(readFileSync(join(decisionOsRoot, 'cards', 'tasks', `${first.masterCardId}.md`), 'utf8'), /Waiting since: 2026-07-18T06:00:00.000Z/);
    assert.equal(ledger.annotations.length, 1);
    assert.equal(ledger.annotations[0].color, '#d94f70');
    assert.equal(first.ledgerId, 'tasks');
    assert.equal(existsSync(join(decisionOsRoot, 'cards', 'tasks', `${first.masterCardId}.md`)), true);
    assert.deepEqual(JSON.parse(readFileSync(specsLedgerPath, 'utf8')).cards, []);
  } finally {
    await taskState?.flush();
    rmSync(root, { recursive: true, force: true });
  }
});
