import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearCardCodexExecution } from '@backend/business/codex/helper/clear-card-codex-execution.js';
import { createProjectTaskState, type ProjectTaskState } from '@backend/business/task-state/helper/project-task-state.js';
import type { TaskProjectionCommand } from '@backend/business/task-state/helper/task-mutation-command.js';

function currentTaskRuntime(root: string, ledgerPath: string): { runtime: Record<string, unknown>; state: ProjectTaskState } {
  const runtime: Record<string, unknown> = { projectId: 'project' };
  const state = createProjectTaskState({ projectId: 'project', writerId: 'test', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
  runtime.readTaskLedgerProjection = () => state.projection().ledger;
  runtime.persistTaskLedgerProjection = (ledger: Record<string, unknown>, command: TaskProjectionCommand) => state.executeProjectionCommand(command, ledger);
  return { runtime, state };
}

test('clears only the execution still owned by the settling run', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-clear-execution-'));
  const ledgerPath = join(root, 'tasks.json');
  let state: ProjectTaskState | null = null;
  try {
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{
        id: 'master', codexActiveRunId: 'direct-run', codexActiveExecutionId: 'direct-execution',
        executionStatus: 'pending', executionRunId: 'newer-pipeline',
      }],
    }));

    const authority = currentTaskRuntime(root, ledgerPath);
    const runtime = authority.runtime;
    state = authority.state;
    assert.equal(await clearCardCodexExecution({ decisionOsRoot: root, ledgerId: 'tasks', ledgerPath, cardId: 'master', runId: 'direct-run', executionId: 'direct-execution', runtime }), true);
    const card = ((runtime.readTaskLedgerProjection as () => { cards: Array<Record<string, unknown>> })()).cards[0];
    assert.equal(card.codexActiveRunId, undefined);
    assert.equal(card.executionStatus, 'pending');
    assert.equal(card.executionRunId, 'newer-pipeline');
  } finally {
    await state?.flush();
    rmSync(root, { recursive: true, force: true });
  }
});

test('removes status and ownership when the settling run still owns execution', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-clear-owned-execution-'));
  const ledgerPath = join(root, 'tasks.json');
  let state: ProjectTaskState | null = null;
  try {
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{
        id: 'master', codexActiveRunId: 'direct-run', codexActiveExecutionId: 'direct-execution',
        executionStatus: 'running', executionRunId: 'direct-run',
        executionIntent: { id: 'voice-note', state: 'running' },
      }],
    }));

    const authority = currentTaskRuntime(root, ledgerPath);
    const runtime = authority.runtime;
    state = authority.state;
    assert.equal(await clearCardCodexExecution({ decisionOsRoot: root, ledgerId: 'tasks', ledgerPath, cardId: 'master', runId: 'direct-run', executionId: 'direct-execution', runtime }), true);
    const card = ((runtime.readTaskLedgerProjection as () => { cards: Array<Record<string, unknown>> })()).cards[0];
    assert.equal(card.codexActiveRunId, undefined);
    assert.equal(card.executionStatus, undefined);
    assert.equal(card.executionRunId, undefined);
    const intent = card.executionIntent as Record<string, unknown>;
    assert.equal(intent.state, 'terminal');
    assert.equal(typeof intent.changedAt, 'string');
    assert.equal(intent.settledAt, intent.changedAt);
    assert.equal(intent.error, null);
  } finally {
    await state?.flush();
    rmSync(root, { recursive: true, force: true });
  }
});

test('does not let an older execution callback clear a continued session', async () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-clear-stale-execution-'));
  const ledgerPath = join(root, 'tasks.json');
  let state: ProjectTaskState | null = null;
  try {
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{
        id: 'master', codexActiveRunId: 'shared-session', codexActiveExecutionId: 'execution-b',
        executionStatus: 'running', executionRunId: 'shared-session',
      }],
    }));

    const authority = currentTaskRuntime(root, ledgerPath);
    const runtime = authority.runtime;
    state = authority.state;
    assert.equal(await clearCardCodexExecution({ decisionOsRoot: root, ledgerId: 'tasks', ledgerPath, cardId: 'master', runId: 'shared-session', executionId: 'execution-a', runtime }), false);
    const card = (state.projection().ledger.cards as Array<Record<string, unknown>>)[0];
    assert.equal(card.codexActiveRunId, 'shared-session');
    assert.equal(card.codexActiveExecutionId, 'execution-b');
    assert.equal(card.executionStatus, 'running');
  } finally {
    await state?.flush();
    rmSync(root, { recursive: true, force: true });
  }
});
