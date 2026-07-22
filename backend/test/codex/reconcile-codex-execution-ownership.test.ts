import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { enqueueCodexContinuation } from '../../src/business/codex/helper/codex-process-queue.js';
import { reconcileCodexExecutionOwnership } from '../../src/business/codex/helper/reconcile-codex-execution-ownership.js';
import { createProjectTaskState, type ProjectTaskState } from '../../src/business/task-state/helper/project-task-state.js';
import type { TaskProjectionCommand } from '../../src/business/task-state/helper/task-mutation-command.js';

test('startup ownership migration clears unmatched leases, maps moved artifacts, and is idempotent', async () => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'decision-os-ownership-migration-'));
  const root = resolve(workspace, '.decision-os');
  const ledgerPath = resolve(root, 'tasks.json');
  const runDirectory = resolve(root, 'runs', 'codex-skills', 'specs');
  let taskState: ProjectTaskState | null = null;
  try {
    mkdirSync(runDirectory, { recursive: true });
    writeFileSync(resolve(root, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
    writeFileSync(resolve(runDirectory, 'historical-run.md'), '# Historical run\n');
    writeFileSync(ledgerPath, JSON.stringify({ cards: [
      {
        id: 'stale',
        codexActiveRunId: 'stale-run',
        executionStatus: 'running',
        executionRunId: 'stale-run',
        executionIntent: { id: 'stale-run', state: 'running', changedAt: '2026-07-18T00:00:00.000Z' },
      },
      {
        id: 'active',
        codexActiveRunId: 'active-run',
        codexActiveExecutionId: 'active-execution',
        executionIntent: { id: 'active-run', state: 'queued', changedAt: '2026-07-19T00:00:00.000Z' },
      },
      { id: 'intent-only', executionIntent: { id: 'lost-run', state: 'waiting', changedAt: '2026-07-18T00:00:00.000Z' } },
      { id: 'queued-without-lease', executionIntent: { id: 'queued-run', state: 'queued', changedAt: '2026-07-19T00:00:00.000Z' } },
      { id: 'moved', codexThreadRunId: 'historical-run', codexThreadRunIds: ['historical-run'] },
    ] }));
    enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'queue-active',
      createdAt: '2026-07-19T00:00:00.000Z',
      payload: { ledgerId: 'tasks', cardId: 'active', runId: 'active-run', executionId: 'active-execution' },
    });
    enqueueCodexContinuation({
      decisionOsRoot: root,
      id: 'queue-without-lease',
      createdAt: '2026-07-19T00:00:01.000Z',
      payload: { ledgerId: 'tasks', cardId: 'queued-without-lease', runId: 'queued-run', executionId: 'queued-execution' },
    });

    const runtime: Record<string, unknown> = { projectId: 'project' };
    taskState = createProjectTaskState({ projectId: 'project', writerId: 'test', decisionOsRoot: root, tasksLedgerFile: ledgerPath, initialize: true });
    runtime.readTaskLedgerProjection = () => taskState!.projection().ledger;
    runtime.persistTaskLedgerProjection = (ledger: Record<string, unknown>, command: TaskProjectionCommand) => taskState!.executeProjectionCommand(command, ledger);
    assert.deepEqual(await reconcileCodexExecutionOwnership({ decisionOsRoot: root, runtime }), {
      ledgersChanged: 1,
      leasesCleared: 1,
      intentsSettled: 2,
      artifactMappingsAdded: 1,
    });
    const cards = ((runtime.readTaskLedgerProjection as () => { cards: Array<Record<string, unknown>> })()).cards;
    assert.equal(cards.find((card) => card.id === 'stale')?.codexActiveRunId, undefined);
    assert.equal(cards.find((card) => card.id === 'stale')?.executionStatus, undefined);
    assert.deepEqual(cards.find((card) => card.id === 'stale')?.executionIntent, {
      id: 'stale-run',
      state: 'failed',
      changedAt: (cards.find((card) => card.id === 'stale')?.executionIntent as Record<string, unknown>).changedAt,
      startedAt: null,
      settledAt: (cards.find((card) => card.id === 'stale')?.executionIntent as Record<string, unknown>).settledAt,
      error: 'Execution ownership was not recoverable during startup.',
    });
    assert.equal(cards.find((card) => card.id === 'active')?.codexActiveExecutionId, 'active-execution');
    assert.equal((cards.find((card) => card.id === 'active')?.executionIntent as Record<string, unknown>).state, 'queued');
    assert.equal((cards.find((card) => card.id === 'intent-only')?.executionIntent as Record<string, unknown>).state, 'failed');
    assert.equal((cards.find((card) => card.id === 'queued-without-lease')?.executionIntent as Record<string, unknown>).state, 'queued');
    assert.deepEqual(cards.find((card) => card.id === 'moved')?.codexThreadRunOutputFiles, { 'historical-run': '.decision-os/runs/codex-skills/specs/historical-run.md' });
    assert.deepEqual(await reconcileCodexExecutionOwnership({ decisionOsRoot: root, runtime }), {
      ledgersChanged: 0,
      leasesCleared: 0,
      intentsSettled: 0,
      artifactMappingsAdded: 0,
    });
  } finally {
    await taskState?.flush();
    rmSync(workspace, { recursive: true, force: true });
  }
});
