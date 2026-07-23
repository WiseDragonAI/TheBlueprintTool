/**
 * WHAT: Verifies detailed terminal status from replicated lifecycle and exact-hash artifact objects.
 * WHY: Terminal reads must not depend on mutable card leases, runtime maps, or executor-local source paths.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { readCardSkillRunController } from '../../src/business/codex/controller/read-card-skill-run-controller.js';
import { createProjectTaskState } from '../../src/business/task-state/helper/project-task-state.js';

test('reads a terminal execution from immutable artifact heads', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-terminal-execution-read-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const ledgerPath = join(decisionOsRoot, 'tasks.json');
  const stdoutFile = join(decisionOsRoot, 'runs', 'execution-a.jsonl');
  const stderrFile = join(decisionOsRoot, 'runs', 'execution-a.log');
  try {
    mkdirSync(join(decisionOsRoot, 'runs'), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({
      cards: [{ id: 'master', title: 'Master', labels: ['master-task'] }],
      annotations: [],
      relationships: [],
    }));
    writeFileSync(stdoutFile, [
      JSON.stringify({ type: 'thread.started', thread_id: 'provider-thread' }),
      JSON.stringify({ type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: 'Done.' } }),
      JSON.stringify({ type: 'turn.completed' }),
      '',
    ].join('\n'));
    writeFileSync(stderrFile, '');
    const state = createProjectTaskState({
      projectId: 'project-a',
      writerId: 'workstation',
      decisionOsRoot,
      tasksLedgerFile: ledgerPath,
      initialize: true,
    });
    await state.executions.admit({
      executorNodeId: 'workstation',
      metadata: {
        executionId: 'execution-a',
        requestId: 'request-a',
        sessionId: 'session-a',
        projectId: 'project-a',
        ledgerId: 'tasks',
        taskId: 'master',
        sourceCardId: 'master',
        ownerCardId: 'master',
        kind: 'thread',
        requestedAt: '2026-07-23T11:00:00.000Z',
        model: 'gpt-5.6-sol',
        effort: 'medium',
        pipelineRunId: null,
        pipelineStepId: null,
        pipelineSkillRunId: null,
        predecessorExecutionId: null,
        restartOfExecutionId: null,
      },
    });
    await state.executions.transition('execution-a', { phase: 'queued', changedAt: '2026-07-23T11:00:01.000Z' });
    await state.executions.transition('execution-a', { phase: 'starting', changedAt: '2026-07-23T11:00:02.000Z' });
    await state.executions.transition('execution-a', { phase: 'running', changedAt: '2026-07-23T11:00:03.000Z' });
    await state.executions.transition('execution-a', {
      phase: 'succeeded',
      changedAt: '2026-07-23T11:00:04.000Z',
      result: { status: 'succeeded', summary: 'Done.' },
    });
    await state.finalizeExecutionArtifacts('execution-a', { jsonl: stdoutFile, stderr: stderrFile });
    const runtime = {
      decisionOsRoot,
      taskExecutionNodeId: 'workstation',
      taskExecutionState: state,
      taskExecutionArtifactFile: (hash: string) => resolve(state.store.root, 'objects', hash.slice(0, 2), hash),
    };

    const result = await readCardSkillRunController({
      action_payload: { ledgerId: 'tasks', cardId: 'master', runId: 'session-a', since: 0 },
      runtime_state: runtime,
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'complete');
    assert.equal(result.phase, 'succeeded');
    assert.equal(result.executorNodeId, 'workstation');
    assert.equal(result.lifecycleRevision, 5);
    assert.equal(result.lineCount, 3);
    assert.equal((result.events as unknown[]).length, 3);
    const jsonl = (result.artifacts as { jsonl: { hash: string } }).jsonl;
    assert.ok(jsonl.hash);
    assert.equal(existsSync(runtime.taskExecutionArtifactFile(jsonl.hash)), true);
    await state.flush();
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
