/**
 * WHAT: Proves a task-bound Codex session publishes its complete causal lifecycle to another replica.
 * WHY: Active process memory and queue files exist only on the executor node.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startThreadCodexProcessController } from '@backend/business/codex/controller/start-thread-codex-process-controller.js';
import { createTaskExecutionRouter } from '@backend/business/codex/helper/task-execution-router.js';
import { createProjectTaskState, type ProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskStateDelta } from '@backend/business/task-state/helper/task-current-state-types.js';

test('queued and terminal task Codex session state converges on a second replica', async (context) => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-task-codex-replication-'));
  const remoteWorkspace = mkdtempSync(join(tmpdir(), 'decision-os-task-codex-remote-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const remoteDecisionOsRoot = join(remoteWorkspace, '.decision-os');
  const cardId = 'card-a';
  const threadId = `thread-${cardId}`;
  const cardRef = `.decision-os/cards/tasks/${cardId}.md`;
  const threadRef = `.decision-os/threads/tasks/${threadId}.md`;
  const initialLedger = {
    cards: [{
      id: cardId,
      title: 'Replicated task run',
      status: 'todo',
      labels: ['master-task'],
      assignment: { nodeId: 'workstation', changedAt: '2026-07-22T09:00:00.000Z', revision: 1 },
      comment: { contentFile: cardRef },
    }],
    annotations: [], relationships: [], notes: {}, threadFiles: { [threadId]: threadRef },
  };
  for (const root of [decisionOsRoot, remoteDecisionOsRoot]) {
    mkdirSync(join(root, 'cards', 'tasks'), { recursive: true });
    mkdirSync(join(root, 'threads', 'tasks'), { recursive: true });
    writeFileSync(join(root, 'state.json'), `${JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }, null, 2)}\n`);
    writeFileSync(join(root, 'tasks.json'), `${JSON.stringify(initialLedger, null, 2)}\n`);
    writeFileSync(join(root, 'cards', 'tasks', `${cardId}.md`), '# Replicated task run\n');
    writeFileSync(join(root, 'threads', 'tasks', `${threadId}.md`), '# OPERATOR\n<!-- decision-os:note {"id":"note-a","timestamp":"2026-07-22T10:00:00.000Z"} -->\n\nRun this task.\n');
  }
  const deltas: TaskStateDelta[] = [];
  let local: ProjectTaskState | null = null;
  let remote: ProjectTaskState | null = null;
  context.after(async () => {
    await local?.flush();
    await remote?.flush();
    rmSync(workspace, { recursive: true, force: true });
    rmSync(remoteWorkspace, { recursive: true, force: true });
  });
  local = createProjectTaskState({
    projectId: 'project-a', writerId: 'workstation', decisionOsRoot, tasksLedgerFile: join(decisionOsRoot, 'tasks.json'), initialize: true,
    publish: (delta) => { deltas.push(delta); },
  });
  remote = createProjectTaskState({
    projectId: 'project-a', writerId: 'phone', decisionOsRoot: remoteDecisionOsRoot, tasksLedgerFile: join(remoteDecisionOsRoot, 'tasks.json'), initialize: true,
  });
  const runtime: Record<string, unknown> = {
    decisionOsRoot,
    projectId: 'project-a',
    decisionOsSettings: { federationNodeId: 'workstation' },
    readTaskLedgerProjection: () => local!.projection().ledger,
    taskExecutionState: local,
    scheduleCodexProcesses: async () => ({ launched: [] }),
  };
  runtime.taskExecutionRouter = createTaskExecutionRouter({
    projectId: 'project-a',
    state: () => local!,
    localNodeId: () => 'workstation',
    peer: () => null,
    localCapacity: () => 1,
    dispatchRemote: async () => { throw new Error('unexpected_remote_dispatch'); },
  });

  const started = await startThreadCodexProcessController({
    action_payload: { ledgerId: 'tasks', threadId, cardId },
    runtime_state: runtime,
  });
  assert.equal(started.ok, true);
  const run = started.run as Record<string, unknown>;
  for (const delta of deltas.splice(0)) await remote.store.merge(delta);
  const remoteQueued = remote.executions.find(String(run.executionId));
  assert.equal(remoteQueued?.metadata.sessionId, run.id);
  assert.equal(remoteQueued?.metadata.taskId, cardId);
  assert.equal(remoteQueued?.lifecycle.phase, 'queued');
  assert.equal(remoteQueued?.lifecycle.executorNodeId, 'workstation');

  await local.executions.transition(String(run.executionId), { phase: 'starting' });
  await local.executions.transition(String(run.executionId), { phase: 'running' });
  await local.executions.transition(String(run.executionId), {
    phase: 'succeeded',
    result: { status: 'succeeded', summary: 'Completed.' },
  });
  for (const delta of deltas.splice(0)) await remote.store.merge(delta);
  const remoteTerminal = remote.executions.find(String(run.executionId));
  assert.equal(remoteTerminal?.lifecycle.phase, 'succeeded');
  assert.equal(remoteTerminal?.lifecycle.result?.summary, 'Completed.');
});
